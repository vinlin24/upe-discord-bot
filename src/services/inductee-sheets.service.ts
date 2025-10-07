import { z } from "zod";

import { RowWiseSheetsService } from "../abc/sheets.abc";
import { GoogleSheetsClient } from "../clients/sheets.client";
import env from "../env";
import type { Seconds, UserId } from "../types/branded.types";
import { SystemDateClient } from "../utils/date.utils";

// NOTE: The value side of the enum is the "full name" of the major used in thes
// Google Forms/Sheets.
export enum UpeMajor {
  Cs = "Computer Science",
  Cse = "Computer Science & Engineering",
  Ce = "Computer Engineering",
  LingCs = "Linguistics & Computer Science",
  MathOfComp = "Mathematics of Computation",
  CompBio = "Computational and Systems Biology",
}

enum RegistryColumn {
  PreferredEmail = 0,
  LegalFirst,
  LegalLast,
  PreferredFirst,
  PreferredLast,
  DiscordId,
  Major,
}

const RegistrySchema = z.tuple([
  z.string().trim(),      // PreferredEmail
  z.string().trim(),      // LegalFirst
  z.string().trim(),      // LegalLast
  z.string().trim(),      // PreferredFirst
  z.string().trim(),      // PreferredLast
  z.string().trim(),      // DiscordId
  z.nativeEnum(UpeMajor), // Major
]).rest(z.any());

type RegistryRow = z.infer<typeof RegistrySchema>;

/** The DTO passed around outside of this service, to represent an inductee. */
export type InducteeData = {
  preferredEmail: string;
  legalName: string;
  preferredName?: string;
  discordId: UserId;
  major: UpeMajor;
};

export class InducteeSheetsService extends RowWiseSheetsService<
  InducteeData,
  "discordId",
  RegistryRow
> {
  // Don't refresh. Use retries/force instead.
  protected override refreshInterval = Infinity as Seconds;

  protected override readonly key = "discordId";
  protected override readonly schema = RegistrySchema;

  public override async getData(userId: UserId): Promise<InducteeData | null> {
    let data = await super.getData(userId);
    if (data === null) {
      data = await super.getData(userId, true);
    }
    return data;
  }

  protected override acceptRow(rowIndex: number, _row: string[]): boolean {
    return rowIndex >= 3; // Skip two comment rows & header rows.
  }

  protected override transformRow(
    validatedRow: RegistryRow,
  ): InducteeData {
    const legalFirst = validatedRow[RegistryColumn.LegalFirst];
    const legalLast = validatedRow[RegistryColumn.LegalLast];

    // Coalesce preferred name components to legal name components if any are
    // absent. For example, some inductees only provide a preferred first name.
    // Previously, this would cause a return of ONLY the first name, which would
    // be inconsistent with how they appear in other places like the requirement
    // tracker.
    const preferredFirst
      = validatedRow[RegistryColumn.PreferredFirst] || legalFirst;
    const preferredLast
      = validatedRow[RegistryColumn.PreferredLast] || legalLast;

    return {
      preferredEmail: validatedRow[RegistryColumn.PreferredEmail],
      legalName: `${legalFirst} ${legalLast}`,
      preferredName: `${preferredFirst} ${preferredLast}`.trim() || undefined,
      discordId: validatedRow[RegistryColumn.DiscordId] as UserId,
      major: validatedRow[RegistryColumn.Major],
    };
  }
}

// Dependency-inject the production clients.
const sheetsClient = GoogleSheetsClient.fromCredentialsFile(
  env.INDUCTEE_DATA_SPREADSHEET_ID,
  "Inductee Registry",
)
export default new InducteeSheetsService(
  sheetsClient,
  new SystemDateClient(),
);
