import { z } from "zod";

import { RowWiseSheetsService } from "../abc/sheets.abc";
import { GoogleSheetsClient } from "../clients/sheets.client";
import env from "../env";
import { asMutable } from "../types/generic.types";
import { SystemDateClient, type IDateClient } from "../utils/date.utils";
import { isBlankOrNumeric, toCount } from "../utils/formatting.utils";
import type {
  TutoringData,
  TutoringSheetsService,
} from "./tutoring-sheets.service";
import tutoringSheetsService from "./tutoring-sheets.service";

enum TrackerColumn {
  Name = 0,
  Fraction,
  Tutoring,
  Demographics,
  Professional,
  Social,
  Ethics,
  OneOnOnes,
  TownHall,
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
  z.string().refine(isBlankOrNumeric),  // TownHall
  z.string(),                           // Tests
  z.string().refine(isBlankOrNumeric),  // Fee
  z.string(),                           // Ceremony
] as const;

const TrackerSchema = z.tuple(asMutable(trackerFields)).rest(z.any());

type TrackerRow = z.infer<typeof TrackerSchema>;

export type RequirementsData = {
  name: string;
  /** `null` means parsing from the separate tutoring sheet failed. */
  tutoring: TutoringData | null;
  demographics: boolean;
  professional: number;
  social: number;
  ethics: boolean;
  oneOnOnes: number;
  townHall: boolean;
  /** NOTE: This is handled by Web at the moment. */
  tests: number;
  fee: boolean;
  ceremony: boolean;
};

export class RequirementSheetsService
  extends RowWiseSheetsService<RequirementsData, "name", TrackerRow> {

  protected override readonly key = "name";

  public constructor(
    sheets: GoogleSheetsClient,
    dates: IDateClient,
    private readonly tutoringService: TutoringSheetsService,
  ) { super(sheets, dates); }

  protected override readonly schema = TrackerSchema;

  protected override acceptRow(rowIndex: number, _row: string[]): boolean {
    return rowIndex >= 2; // Skip header & fraction rows.
  }

  protected override sanitizeRow(row: string[]): string[] {
    return this.padRow(row, trackerFields.length);
  }

  protected override async transformRow(
    validatedRow: TrackerRow,
  ): Promise<RequirementsData> {
    const data: RequirementsData = {
      name: validatedRow[TrackerColumn.Name],
      tutoring: null, // To be populated via separate service.
      demographics: !!validatedRow[TrackerColumn.Demographics],
      professional: toCount(validatedRow[TrackerColumn.Professional]),
      social: toCount(validatedRow[TrackerColumn.Social]),
      ethics: !!validatedRow[TrackerColumn.Ethics],
      oneOnOnes: toCount(validatedRow[TrackerColumn.OneOnOnes]),
      townHall: !!validatedRow[TrackerColumn.TownHall],
      tests: toCount(validatedRow[TrackerColumn.Tests]),
      fee: !!validatedRow[TrackerColumn.Fee],
      ceremony: !!validatedRow[TrackerColumn.Ceremony],
    };

    // Separately fetch tutoring data.
    const tutoringData = await this.tutoringService.getData(data.name);
    data.tutoring = tutoringData;

    return data;
  }
}

// Dependency-inject the production clients.
const sheetsClient = GoogleSheetsClient.fromCredentialsFile(
  env.PRIVATE_REQUIREMENT_TRACKER_SPREADSHEET_ID,
  "Tracker",
);
export default new RequirementSheetsService(
  sheetsClient,
  new SystemDateClient(),
  tutoringSheetsService,
);
