import { Collection } from "discord.js";
import { configDotenv } from "dotenv";

import { z } from "zod";
import { GoogleSheetsClient } from "../clients/sheets.client";
import type { UnixSeconds } from "../types/branded.types";
import { SystemDateClient, type IDateClient } from "../utils/date.utils";

configDotenv();

export const { REQUIREMENT_TRACKER_SPREADSHEET_ID } = process.env;

function isBlankOrNumeric(s: string): boolean {
  return s === "" || /^([0-9]|[1-9][0-9]*)$/.test(s);
}

enum TrackerColumn {
  Name = 0,
  Fraction,
  Tutoring,
  Demographics,
  Professional,
  Social,
  Dei,
  OneOnOnes,
  BitByteChallenge,
  TownHall,
  Interview,
  Tests,
  Fee,
  Ceremony,
}

const TrackerSchema = z.tuple([
  z.string().trim(),                    // Name
  z.string(),                           // Fraction
  z.string(),                           // Tutoring
  z.string().refine(isBlankOrNumeric),  // Demographics
  z.string().refine(isBlankOrNumeric),  // Professional
  z.string().refine(isBlankOrNumeric),  // Social
  z.string().refine(isBlankOrNumeric),  // Dei
  z.string().refine(isBlankOrNumeric),  // OneOnOnes
  z.string().refine(isBlankOrNumeric),  // BitByteChallenge
  z.string().refine(isBlankOrNumeric),  // TownHall
  z.string().refine(isBlankOrNumeric),  // Interview
  z.string(),                           // Tests
  z.string().refine(isBlankOrNumeric),  // Fee
  z.string(),                           // Ceremony
]).rest(z.any());

export type RequirementsData = {
  name: string;
  tutoring: boolean;
  demographics: boolean;
  professional: number;
  social: number;
  dei: boolean;
  oneOnOnes: number;
  bitByteChallenge: boolean;
  townHall: boolean;
  interview: boolean;
  /** NOTE: This is handled by Web at the moment. */
  tests: number;
  fee: boolean;
  ceremony: boolean;
};

export class RequirementSheetsService {
  private readonly client: GoogleSheetsClient;
  private readonly cache = new Collection<string, RequirementsData>();
  private lastUpdated = 0 as UnixSeconds;

  private static readonly REFRESH_INTERVAL = 300 as UnixSeconds;

  public constructor(
    spreadsheetId: string,
    private readonly dateClient: IDateClient,
  ) {
    this.client = GoogleSheetsClient.fromCredentialsFile(spreadsheetId);
  }

  public async getData(name: string): Promise<RequirementsData | null> {
    await this.updateCacheIfNotRecently();
    return this.cache.get(name) ?? null;
  }

  private async updateCacheIfNotRecently(): Promise<void> {
    const now = this.dateClient.getNow();
    if (now < this.lastUpdated + RequirementSheetsService.REFRESH_INTERVAL) {
      return;
    }

    // No one better rename this sheet lol.
    const SHEET_NAME = "Tracker";
    const sheetData = await this.client.getValues(SHEET_NAME);
    if (sheetData === null) {
      console.error(
        `Couldn't read data from sheet ${SHEET_NAME} ` +
        `of spreadsheet ${this.client.spreadsheetId}`,
      )
      return;
    }

    for (const requirementsData of this.parseData(sheetData)) {
      this.cache.set(requirementsData.name, requirementsData);
    }

    this.lastUpdated = now;
  }

  private *parseData(rows: string[][]): Generator<RequirementsData> {
    // Start at 2 to skip the header & fraction rows.
    for (let rowIndex = 2; rowIndex < rows.length; rowIndex++) {
      try {
        yield this.parseRow(rows[rowIndex]);
      }
      catch (error) {
        if (error instanceof z.ZodError) {
          console.error(
            "Error validating requirement tracker data " +
            `(row ${rowIndex + 1}): ${error.message}`,
          )
          continue;
        }
        throw error;
      }
    }
  }

  private parseRow(row: string[]): RequirementsData {
    const validatedRow = TrackerSchema.parse(row);

    return {
      name: validatedRow[TrackerColumn.Name],
      tutoring: !!validatedRow[TrackerColumn.Tutoring],
      demographics: !!validatedRow[TrackerColumn.Demographics],
      professional: this.toCount(validatedRow[TrackerColumn.Professional]),
      social: this.toCount(validatedRow[TrackerColumn.Social]),
      dei: !!validatedRow[TrackerColumn.Dei],
      oneOnOnes: this.toCount(validatedRow[TrackerColumn.OneOnOnes]),
      bitByteChallenge: !!validatedRow[TrackerColumn.BitByteChallenge],
      townHall: !!validatedRow[TrackerColumn.TownHall],
      interview: !!validatedRow[TrackerColumn.Interview],
      tests: this.toCount(validatedRow[TrackerColumn.Tests]),
      fee: !!validatedRow[TrackerColumn.Fee],
      ceremony: !!validatedRow[TrackerColumn.Ceremony],
    };
  }

  private toCount(cell: string): number {
    const value = Number.parseInt(cell);
    if (Number.isNaN(value)) {
      return 0;
    }
    return value;
  }
}

export default new RequirementSheetsService(
  REQUIREMENT_TRACKER_SPREADSHEET_ID,
  new SystemDateClient(),
);
