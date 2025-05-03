import { z } from "zod";

import { GoogleSheetsClient } from "../clients/sheets.client";
import env from "../env";
import { asMutable } from "../types/generic.types";
import { SystemDateClient } from "../utils/date.utils";
import { isBlankOrNumeric, toCount } from "../utils/formatting.utils";
import { SheetsService } from "./sheets.service";

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
  Cap3,
  Cap4,
  Cap5,
  Cap6,
  Cap7,
  Cap8,
  Cap9,
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
] as const;

const TrackerSchema = z.tuple(asMutable(trackerFields)).rest(z.any());

type TrackerRow = z.infer<typeof TrackerSchema>;

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

export class TutoringSheetsService extends SheetsService<TutoringData, "name"> {
  protected override async *parseData(
    rows: string[][],
  ): AsyncIterable<TutoringData> {
    yield* this.parseRowWise({
      rows,
      filter: (index) => index >= 1, // Skip header row.
      schema: TrackerSchema,
      transformer: (validatedRow) => this.parseRow(validatedRow),
    });
  }

  private parseRow(validatedRow: TrackerRow): TutoringData {
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

// Dependency inject the production clients.
const sheetsClient = GoogleSheetsClient.fromCredentialsFile(
  env.TUTORING_TRACKER_SPREADSHEET_ID,
  "Actual Count",
)
export default new TutoringSheetsService(sheetsClient, new SystemDateClient());
