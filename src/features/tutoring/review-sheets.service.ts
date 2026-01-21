import { GuildTextBasedChannel, Role, type Guild } from "discord.js";
import { DateTime } from "luxon";
import { z } from "zod";

import { SheetsService } from "../../abc/sheets.abc";
import { GoogleSheetsClient } from "../../clients/sheets.client";
import env from "../../env";
import type { Seconds } from "../../types/branded.types";
import { asMutable } from "../../types/generic.types";
import { SystemDateClient, getNextMidnight } from "../../utils/date.utils";
import { toCount } from "../../utils/formatting.utils";
import {
  EMERITUS_ROLE_ID,
  TUTORING_CHANNEL_ID,
  TUTORING_ROLE_ID,
} from "src/utils/snowflakes.utils";
import channelsService from "../../services/channels.service";

enum Column {
  Event = 0,
  Professor,
  EmailDate,
  EmailCheckbox,
  PublicityDate,
  PublicityCheckbox,
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
  z.string().trim(), // Email date; (blank).
  z.string().trim(), // Email checkbox; (blank).
  z.string().trim(), // Publicity date; (blank).
  z.string().trim(), // Publicity checkbox; (blank).
  z.string().trim(), // Event date; (day of the week).
  z.string().trim(), // Test date; (day of the week).
  z.string().trim(), // Location; (blank).
  z.string().trim(), // Lead host 1; Lead host 2.
  z.string().trim(), // Host 1; Host 2.
  z.string().trim(), // Backup host 1; Backup host 2.
  z.string().trim(), // Expected attendance; (blank).
] as const;

const ReviewEventRowSchema = z
  .tuple(asMutable(REVIEW_EVENT_ROW_FIELDS))
  .rest(z.any());

export type ReviewEvent = {
  name: string;
  professor: {
    name: string;
    email: string;
  };
  emailDate?: DateTime<true>;
  emailDone?: boolean;
  publicityDate?: DateTime<true>;
  publicityDone?: boolean;
  eventDate?: DateTime<true>;
  testDate?: DateTime<true>;
  location: string;
  leadHosts: string[];
  hosts: string[];
  backupHosts: string[];
  expectedAttendance?: number;
};

export class ReviewEventSheetsService extends SheetsService<
  ReviewEvent,
  "name"
> {
  protected override readonly key = "name";

  // This spreadsheet doesn't change very often.
  protected override refreshInterval = 3600 as Seconds;

  public async initialize(upe: Guild): Promise<void> {
    const tutoring = await upe.channels.fetch(TUTORING_CHANNEL_ID);
    if (tutoring === null || !tutoring.isTextBased()) {
      const errorMessage =
        `tutoring officers channel (ID ${TUTORING_CHANNEL_ID}) is invalid: ` +
        `${tutoring}`;
      console.error(errorMessage);
      await channelsService.sendDevError(errorMessage);
      return;
    }

    const tutoringRole = await upe.roles.fetch(TUTORING_ROLE_ID);
    if (tutoringRole === null) {
      const errorMessage = `failed to get tutoring officers role (ID: ${TUTORING_ROLE_ID})`;
      console.error(errorMessage);
      await channelsService.sendDevError(errorMessage);
      return;
    }

    const now = this.dates.getNow();
    const nextMidnight = getNextMidnight(now, this.dates);
    const msecLeft = (nextMidnight - now) * 1000;
    // Schedule the first reminder.
    setTimeout(
      async () => await this.sendReminder(tutoring, tutoringRole),
      msecLeft,
    );
  }

  private async sendReminder(
    tutoring: GuildTextBasedChannel,
    tutoringRole: Role,
  ): Promise<void> {
    try {
      const reminder = await this.getReminder(tutoringRole);

      if (reminder !== null) {
        await tutoring.send(reminder);
      }
    } catch (error) {
      // This callback is outside of our standard execution pipeline, so manually
      // suppress exceptions to prevent bringing down the bot.
      console.error("failed to complete daily reminder:", error);
      if (error instanceof Error) {
        await channelsService.sendDevError(error);
      }
    }

    // Schedule next reminder.
    const ONE_DAY_MSEC = 3600 * 24 * 1000;
    setTimeout(
      async () => this.sendReminder(tutoring, tutoringRole),
      ONE_DAY_MSEC,
    );
  }

  private async getReminder(tutoringRole: Role): Promise<string | null> {
    const messageSections = [];

    const todayNormalized = this.dates
      .getDateTime(this.dates.getNow())
      .startOf("day");
    const eventsData = await this.getAllData();
    for (const event of eventsData.values()) {
      // Email to professor is due today and not done.
      if (
        event.emailDate &&
        event.emailDate <= todayNormalized &&
        !event.emailDone
      ) {
        messageSections.push(
          `${event.name} - Email to ${event.professor.name} via ${event.professor.email} is due! ${this.getPings(tutoringRole, event.leadHosts)}`,
        );
      }

      // Publicity request is due today and not done.
      if (
        event.publicityDate &&
        event.publicityDate <= todayNormalized &&
        !event.publicityDone
      ) {
        messageSections.push(
          `${event.name} - Email to ${event.professor.name} via ${event.professor.email} is due! ${this.getPings(tutoringRole, event.leadHosts)}`,
        );
      }

      // Event is tomorrow/today.
      if (
        event.eventDate &&
        todayNormalized.plus({ days: 1 }) == event.eventDate
      ) {
        messageSections.push(
          `${event.name} is tomorrow! ${this.getPings(tutoringRole, event.leadHosts.concat(event.hosts, event.backupHosts))}`,
        );
      } else if (event.eventDate && todayNormalized == event.eventDate) {
        messageSections.push(
          `${event.name} is today! ${this.getPings(tutoringRole, event.leadHosts.concat(event.hosts, event.backupHosts))}`,
        );
      }
    }

    if (messageSections.length !== 0) {
      return `Tutoring Reminder ${todayNormalized.toFormat("DDD")}
      
      ${messageSections.join("\n")}`;
    }
    return null;
  }

  private getPings(tutoringRole: Role, names: string[]) {
    const pings = [];
    for (const name of names) {
      let located = false;
      for (const officer of tutoringRole.members.values()) {
        if (officer.roles.cache.has(EMERITUS_ROLE_ID)) {
          continue;
        }

        if (officer.displayName.startsWith(name)) {
          pings.push(officer);
          located = true;
          break;
        }
      }

      if (!located) {
        pings.push(name);
      }
    }

    return pings.join(" ");
  }

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
    const emailDate = this.resolveDateString(data1[Column.EmailDate]);
    const emailDone = data1[Column.EmailCheckbox] === "TRUE";
    const publicityDate = this.resolveDateString(data1[Column.PublicityDate]);
    const publicityDone = data1[Column.PublicityCheckbox] === "TRUE";
    const eventDate = this.resolveDateString(data1[Column.EventDate]);
    const location = data1[Column.Location];
    const testDate = this.resolveDateString(data1[Column.TestDate]);
    const leadHosts = [data1[Column.LeadHosts], data2[Column.LeadHosts]].filter(
      Boolean,
    );
    const hosts = [data1[Column.Hosts], data2[Column.Hosts]].filter(Boolean);
    const backupHosts = [
      data1[Column.BackupHosts],
      data2[Column.BackupHosts],
    ].filter(Boolean);
    const expectedAttendance = toCount(data1[Column.ExpectedAttendance]);

    return {
      name: eventName,
      professor,
      emailDate: emailDate ?? undefined,
      emailDone: emailDone ?? undefined,
      publicityDate: publicityDate ?? undefined,
      publicityDone: publicityDone ?? undefined,
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
    const formats = ["M/d", "M/d/y", "DD"];
    for (const format of formats) {
      let dateTime = DateTime.fromFormat(text, format);
      if (dateTime.isValid) {
        return dateTime;
      }
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
