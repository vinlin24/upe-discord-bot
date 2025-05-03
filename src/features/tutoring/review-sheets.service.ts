import { DateTime } from "luxon";
import { z } from "zod";

import { SheetsService } from "../../abc/sheets.abc";
import { GoogleSheetsClient } from "../../clients/sheets.client";
import env from "../../env";
import type { Seconds } from "../../types/branded.types";
import { asMutable } from "../../types/generic.types";
import { SystemDateClient } from "../../utils/date.utils";
import { toCount } from "../../utils/formatting.utils";

enum Column {
  Event = 0,
  Professor,
  EventDate,
  TestDate,
  Location,
  LeadHosts,
  Hosts,
  BackupHosts,
  ExpectedAttendance,
}

const REVIEW_EVENT_ROW_FIELDS = [
  z.string().trim(), // Event name; (blank).
  z.string().trim(), // Professor email; Professor name.
  z.string().trim(), // Event date; (day of the week).
  z.string().trim(), // Test date; (day of the week).
  z.string().trim(), // Location; (blank).
  z.string().trim(), // Lead host 1; Lead host 2.
  z.string().trim(), // Host 1; Host 2.
  z.string().trim(), // Backup host 1; Backup host 2.
  z.string().trim(), // Expected attendance; (blank).
] as const;

const ReviewEventRowSchema = z.tuple(
  asMutable(REVIEW_EVENT_ROW_FIELDS),
).rest(z.any());

export type ReviewEvent = {
  name: string;
  professor: {
    name: string;
    email: string;
  };
  eventDate?: DateTime<true>;
  testDate?: DateTime<true>;
  location: string;
  leadHosts: string[];
  hosts: string[];
  backupHosts: string[];
  expectedAttendance?: number;
};

export class ReviewEventSheetsService
  extends SheetsService<ReviewEvent, "name"> {

  protected override readonly key = "name";

  // This spreadsheet doesn't change very often.
  protected override refreshInterval = 3600 as Seconds;

  protected override async *parseData(
    rows: string[][],
  ): AsyncIterable<ReviewEvent> {
    // Start at 1 to skip the header row.
    for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 2) {
      const row1 = rows[rowIndex];
      const row2 = rows[rowIndex + 1];
      // Start of comments.
      if (row1.length === 0) {
        break;
      }
      const entry = this.parseEntry(row1, row2);
      if (entry !== null) {
        yield entry;
      }
    }
  }

  private parseEntry(row1: string[], row2: string[]): ReviewEvent | null {
    const paddedRow1 = this.padRow(row1, REVIEW_EVENT_ROW_FIELDS.length);
    const paddedRow2 = this.padRow(row2, REVIEW_EVENT_ROW_FIELDS.length);

    const validatedRow1 = ReviewEventRowSchema.safeParse(paddedRow1);
    const validatedRow2 = ReviewEventRowSchema.safeParse(paddedRow2);
    if (!validatedRow1.success || !validatedRow2.success) {
      return null;
    }

    const { data: data1 } = validatedRow1;
    const { data: data2 } = validatedRow2;

    const eventName = data1[Column.Event];
    const professor = {
      name: data2[Column.Professor],
      email: data1[Column.Professor],
    };
    const eventDate = this.resolveDateString(data1[Column.EventDate]);
    const location = data1[Column.Location];
    const testDate = this.resolveDateString(data1[Column.TestDate]);
    const leadHosts = [
      data1[Column.LeadHosts],
      data2[Column.LeadHosts],
    ].filter(Boolean);
    const hosts = [
      data1[Column.Hosts],
      data2[Column.Hosts],
    ].filter(Boolean);
    const backupHosts = [
      data1[Column.BackupHosts],
      data2[Column.BackupHosts],
    ].filter(Boolean);
    const expectedAttendance = toCount(data1[Column.ExpectedAttendance]);

    return {
      name: eventName,
      professor,
      eventDate: eventDate ?? undefined,
      testDate: testDate ?? undefined,
      location,
      leadHosts,
      hosts,
      backupHosts,
      expectedAttendance: expectedAttendance ?? undefined,
    };
  }

  private resolveDateString(text: string): DateTime<true> | null {
    // Ref: https://moment.github.io/luxon/#/parsing?id=table-of-tokens.
    const format1 = "M/d";
    const format2 = "M/d/y";
    let dateTime = DateTime.fromFormat(text, format1);
    if (dateTime.isValid) {
      return dateTime;
    }
    dateTime = DateTime.fromFormat(text, format2);
    if (dateTime.isValid) {
      return dateTime;
    }
    return null;
  }
}

// Dependency-inject the production clients.
const sheetsClient = GoogleSheetsClient.fromCredentialsFile(
  env.REVIEW_EVENTS_SPREADSHEET_ID,
  env.QUARTER_NAME,
);
export default new ReviewEventSheetsService(
  sheetsClient,
  new SystemDateClient(),
);
