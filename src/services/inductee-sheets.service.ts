import { z } from "zod";

import { GoogleSheetsClient } from "../clients/sheets.client";
import env from "../env";
import { cleanProvidedUsername } from "../features/inductee-role/input.utils";
import type { Seconds } from "../types/branded.types";
import { SystemDateClient } from "../utils/date.utils";
import { RowWiseSheetsService } from "./sheets.service";

export enum UpeMajor {
  Cs = "Computer Science",
  Cse = "Computer Science & Engineering",
  Ce = "Computer Engineering",
  LingCs = "Linguistics & Computer Science",
  MathOfComp = "Mathematics of Computation",
}

enum QuestionnaireColumn {
  Timestamp = 0,
  Email,
  PreferredEmail,
  UclaId,
  LegalFirst,
  LegalLast,
  PreferredFirst,
  PreferredLast,
  DiscordUsername,
  Major,
}

const QuestionnaireSchema = z.tuple([
  z.string().trim(),                            // Timestamp
  z.string().trim().email(),                    // Email
  z.string().trim().email(),                    // PreferredEmail
  z.string().refine(s => /[0-9]{9}/.test(s)),   // UclaId
  z.string().trim(),                            // LegalFirst
  z.string().trim(),                            // LegalLast
  z.string().trim(),                            // PreferredFirst
  z.string().trim(),                            // PreferredLast
  z.string().transform(cleanProvidedUsername),  // DiscordUsername
  z.nativeEnum(UpeMajor),                       // Major
]).rest(z.any());

type QuestionnaireRow = z.infer<typeof QuestionnaireSchema>;

export type InducteeData = {
  preferredEmail: string;
  legalName: string;
  preferredName?: string;
  discordUsername: string;
  major: UpeMajor;
};

export class InducteeSheetsService extends RowWiseSheetsService<
  InducteeData,
  "discordUsername",
  QuestionnaireRow
> {
  // Don't refresh. Use retries/force instead.
  protected override refreshInterval = Infinity as Seconds;

  protected override readonly schema = QuestionnaireSchema;

  public override async getData(
    username: string,
  ): Promise<InducteeData | null> {
    let data = await super.getData(username);
    if (data === null) {
      data = await super.getData(username, true);
    }
    return data;
  }

  protected override acceptRow(rowIndex: number, _row: string[]): boolean {
    return rowIndex >= 1; // Skip header row.
  }

  protected override transformRow(
    validatedRow: QuestionnaireRow,
  ): InducteeData {
    const legalFirst = validatedRow[QuestionnaireColumn.LegalFirst];
    const legalLast = validatedRow[QuestionnaireColumn.LegalLast];

    // Coalesce preferred name components to legal name components if any are
    // absent. For example, some inductees only provide a preferred first name.
    // This would cause a return of ONLY the first name, which would no longer
    // correctly index into other services like the requirement tracker.
    const preferredFirst
      = validatedRow[QuestionnaireColumn.PreferredFirst] || legalFirst;
    const preferredLast
      = validatedRow[QuestionnaireColumn.PreferredLast] || legalLast;

    return {
      preferredEmail: validatedRow[QuestionnaireColumn.PreferredEmail],
      legalName: `${legalFirst} ${legalLast}`,
      preferredName: `${preferredFirst} ${preferredLast}`.trim() || undefined,
      discordUsername: validatedRow[QuestionnaireColumn.DiscordUsername],
      major: validatedRow[QuestionnaireColumn.Major],
    };
  }
}

// Dependency-inject the production clients.
const sheetsClient = GoogleSheetsClient.fromCredentialsFile(
  env.INDUCTEE_DATA_SPREADSHEET_ID,
  "Form Responses 1",
)
export default new InducteeSheetsService(
  sheetsClient,
  new SystemDateClient(),
);
