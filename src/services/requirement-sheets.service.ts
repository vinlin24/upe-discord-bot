import { Collection } from "discord.js";
import { z } from "zod";

import { GoogleSheetsClient } from "../clients/sheets.client";
import env from "../env";
import type { UnixSeconds } from "../types/branded.types";
import { assertNonEmptyArray } from "../types/generic.types";
import { SystemDateClient, type IDateClient } from "../utils/date.utils";
import { isBlankOrNumeric, toCount } from "../utils/formatting.utils";
import type { TutoringData } from "./tutoring-sheets.service";
import tutoringSheetsService from "./tutoring-sheets.service";

const { PRIVATE_REQUIREMENT_TRACKER_SPREADSHEET_ID } = env;

enum TrackerColumn {
  Name = 0,
  Fraction,
  Tutoring,
  Demographics,
  Professional,
  Social,
  Ethics,
  OneOnOnes,
  BitByteChallenge,
  TownHall,
  Interview,
  Tests,
  Fee,
  Ceremony,
}

const trackerFields = [
  z.string().trim(),                    // Name
  z.string(),                           // Fraction
  z.string(),                           // Tutoring
  z.string().refine(isBlankOrNumeric),  // Demographics
  z.string().refine(isBlankOrNumeric),  // Professional
  z.string().refine(isBlankOrNumeric),  // Social
  z.string().refine(isBlankOrNumeric),  // Ethics
  z.string().refine(isBlankOrNumeric),  // OneOnOnes
  z.string().refine(isBlankOrNumeric),  // BitByteChallenge
  z.string().refine(isBlankOrNumeric),  // TownHall
  z.string().refine(isBlankOrNumeric),  // Interview
  z.string(),                           // Tests
  z.string().refine(isBlankOrNumeric),  // Fee
  z.string(),                           // Ceremony
];
assertNonEmptyArray(trackerFields);
const TrackerSchema = z.tuple(trackerFields).rest(z.any());

export type RequirementsData = {
  name: string;
  /** `null` means parsing from the separate tutoring sheet failed. */
  tutoring: TutoringData | null;
  demographics: boolean;
  professional: number;
  social: number;
  ethics: boolean;
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

  public get lastUpdateTime(): UnixSeconds {
    return this.lastUpdated;
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
      // Separately fetch tutoring data.
      const tutoringData = await this.getTutoringData(requirementsData.name);
      requirementsData.tutoring = tutoringData;
      this.cache.set(requirementsData.name, requirementsData);
    }

    this.lastUpdated = now;
  }

  private async getTutoringData(name: string): Promise<TutoringData | null> {
    return await tutoringSheetsService.getData(name);
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
    // Latter columns are omitted if they're omitted, causing `row` to be
    // shorter than what's expected by the full schema, so we need to pad.
    const paddedRow = row.slice();
    while (paddedRow.length < trackerFields.length) {
      paddedRow.push("");
    }

    const validatedRow = TrackerSchema.parse(paddedRow);

    return {
      name: validatedRow[TrackerColumn.Name],
      tutoring: null, // To be populated via separate service.
      demographics: !!validatedRow[TrackerColumn.Demographics],
      professional: toCount(validatedRow[TrackerColumn.Professional]),
      social: toCount(validatedRow[TrackerColumn.Social]),
      ethics: !!validatedRow[TrackerColumn.Ethics],
      oneOnOnes: toCount(validatedRow[TrackerColumn.OneOnOnes]),
      bitByteChallenge: !!validatedRow[TrackerColumn.BitByteChallenge],
      townHall: !!validatedRow[TrackerColumn.TownHall],
      interview: !!validatedRow[TrackerColumn.Interview],
      tests: toCount(validatedRow[TrackerColumn.Tests]),
      fee: !!validatedRow[TrackerColumn.Fee],
      ceremony: !!validatedRow[TrackerColumn.Ceremony],
    };
  }
}

export default new RequirementSheetsService(
  PRIVATE_REQUIREMENT_TRACKER_SPREADSHEET_ID,
  new SystemDateClient(),
);
