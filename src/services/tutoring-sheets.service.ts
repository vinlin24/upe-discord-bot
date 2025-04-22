import { Collection } from "discord.js";
import { z } from "zod";

import { GoogleSheetsClient } from "../clients/sheets.client";
import env from "../env";
import type { UnixSeconds } from "../types/branded.types";
import { assertNonEmptyArray } from "../types/generic.types";
import { SystemDateClient, type IDateClient } from "../utils/date.utils";
import { isBlankOrNumeric, toCount } from "../utils/formatting.utils";

const { TUTORING_TRACKER_SPREADSHEET_ID } = env;

enum TrackerColumn {
  Email = 0,
  Name,
  RequiredCount,
  Week3,
  Week4,
  Week5,
  Week6,
  Week7,
  Week8,
  Week9,
  ActualTotal,
  CappedTotal,
}

const trackerFields = [
  z.string(),                           // Email
  z.string(),                           // Name
  z.string().refine(isBlankOrNumeric),  // RequiredCount
  z.string().refine(isBlankOrNumeric),  // Week3
  z.string().refine(isBlankOrNumeric),  // Week4
  z.string().refine(isBlankOrNumeric),  // Week5
  z.string().refine(isBlankOrNumeric),  // Week6
  z.string().refine(isBlankOrNumeric),  // Week7
  z.string().refine(isBlankOrNumeric),  // Week8
  z.string().refine(isBlankOrNumeric),  // Week9
  z.string().refine(isBlankOrNumeric),  // ActualTotal
  z.string().refine(isBlankOrNumeric),  // CappedTotal
];
assertNonEmptyArray(trackerFields);
const TrackerSchema = z.tuple(trackerFields).rest(z.any())

export type TutoringData = {
  name: string;
  requiredCount: number;
  cappedTotal: number;
  week3: boolean;
  week4: boolean;
  week5: boolean;
  week6: boolean;
  week7: boolean;
  week8: boolean;
  week9: boolean;
};

// TODO: Much overlap with RequirementSheetsService, could refactor into generic
// sheets helper (or whole framework, with the above enum pattern, etc.).
export class TutoringSheetsService {
  private readonly client: GoogleSheetsClient;
  private readonly cache = new Collection<string, TutoringData>();
  private lastUpdated = 0 as UnixSeconds;

  private static readonly REFRESH_INTERVAL = 300 as UnixSeconds;

  public constructor(
    spreadsheetId: string,
    private readonly dateClient: IDateClient,
  ) {
    this.client = GoogleSheetsClient.fromCredentialsFile(spreadsheetId);
  }

  public get lastUpdateTime(): UnixSeconds {
    return this.lastUpdated;
  }

  public async getData(name: string): Promise<TutoringData | null> {
    await this.updateCacheIfNotRecently();
    return this.cache.get(name) ?? null;
  }

  private async updateCacheIfNotRecently(): Promise<void> {
    const now = this.dateClient.getNow();
    if (now < this.lastUpdated + TutoringSheetsService.REFRESH_INTERVAL) {
      return;
    }

    const SHEET_NAME = "Actual Count";
    const sheetData = await this.client.getValues(SHEET_NAME);
    if (sheetData === null) {
      console.error(
        `Couldn't read data from sheet ${SHEET_NAME} ` +
        `of spreadsheet ${this.client.spreadsheetId}`,
      )
      return;
    }

    for (const tutoringData of this.parseData(sheetData)) {
      this.cache.set(tutoringData.name, tutoringData);
    }

    this.lastUpdated = now;
  }

  private *parseData(rows: string[][]): Generator<TutoringData> {
    // Start at 1 to skip the header row.
    for (let rowIndex = 1; rowIndex < rows.length; rowIndex++) {
      try {
        yield this.parseRow(rows[rowIndex]);
      }
      catch (error) {
        if (error instanceof z.ZodError) {
          console.error(
            "Error validating requirement tracker data " +
            `(row ${rowIndex + 1}): ${error.message}`,
          );
          continue;
        }
        throw error;
      }
    }
  }

  private parseRow(row: string[]): TutoringData {
    const validatedRow = TrackerSchema.parse(row);

    return {
      name: validatedRow[TrackerColumn.Name],
      requiredCount: toCount(validatedRow[TrackerColumn.RequiredCount]),
      cappedTotal: toCount(validatedRow[TrackerColumn.CappedTotal]),
      week3: validatedRow[TrackerColumn.Week3] !== "0",
      week4: validatedRow[TrackerColumn.Week4] !== "0",
      week5: validatedRow[TrackerColumn.Week5] !== "0",
      week6: validatedRow[TrackerColumn.Week6] !== "0",
      week7: validatedRow[TrackerColumn.Week7] !== "0",
      week8: validatedRow[TrackerColumn.Week8] !== "0",
      week9: validatedRow[TrackerColumn.Week9] !== "0",
    };
  }
}

export default new TutoringSheetsService(
  TUTORING_TRACKER_SPREADSHEET_ID,
  new SystemDateClient(),
);
