import assert from "node:assert";

import { Collection } from "discord.js";
import { z } from "zod";

import { RowWiseSheetsService, SheetsRowTransformError } from "../../abc/sheets.abc";
import { GoogleSheetsClient } from "../../clients/sheets.client";
import { UpeMajor } from "../../services/inductee-sheets.service";
import type { Quarter, QuarterName } from "../../types/branded.types";
import { getEnumFromName } from "../../types/generic.types";
import { SystemDateClient } from "../../utils/date.utils";
import {
  getCommitteeFromName,
  getTitleFromName,
  type Committee,
  type CommitteeName,
  type Title,
  type TitleName,
} from "../../utils/upe.utils";
import { cleanProvidedUsername } from "../inductee-role/input.utils";

enum Column {
  Timestamp = 0,
  Email,
  LegalFirst,
  LegalLast,
  PreferredFull,
  Pronouns,
  BoardPosition,
  Major,
  StudentYear,
  GraduationQuarter,
  PreferredEmail,
  PhoneNumber,
  DiscordUsername,
  ActiveQuarters,
  Uid,
}

// For handling slight variations in values meant to map to the UpeMajor enum.
function resolveUpeMajor(value: string): UpeMajor | null {
  const loweredValue = value.toLowerCase();
  if (loweredValue.startsWith("math")) {
    return UpeMajor.MathOfComp;
  }
  if (loweredValue.startsWith("ling")) {
    return UpeMajor.LingCs;
  }
  return getEnumFromName(UpeMajor, value) ?? null;
}

const ColumnSchema = z.tuple([
  z.string().trim(),                                  // Timestamp
  z.string().trim().email(),                          // Email
  z.string().trim(),                                  // LegalFirst
  z.string().trim(),                                  // LegalLast
  z.string().trim(),                                  // PreferredFull
  z.string().trim(),                                  // Pronouns
  z.string().trim(),                                  // BoardPosition
  z.string().trim(),                                  // Major
  z.string().trim(),                                  // StudentYear
  z.string().trim(),                                  // GraduationQuarter
  z.string().trim().email(),                          // PreferredEmail
  z.string().trim(),                                  // PhoneNumber
  z.string().trim().transform(cleanProvidedUsername), // DiscordUsername
  z.string().trim(),                                  // ActiveQuarters
  z.string().trim(),                                  // Uid
]).rest(z.any());

type ResponseRow = z.infer<typeof ColumnSchema>;

export type OfficerData = {
  legalFirst: string;
  legalLast: string;
  preferredName: string;
  pronouns: string;
  committee: Committee;
  title: Title;
  major: UpeMajor;
  graduation: QuarterName;
  preferredEmail: string;
  phoneNumber: string;
  discordUsername: string;
  activeQuarters: Quarter[];
  uid: string;
};

export class OfficersService extends RowWiseSheetsService<
  OfficerData,
  "discordUsername",
  ResponseRow
> {
  protected override readonly key = "discordUsername";
  protected override readonly schema = ColumnSchema;

  protected override acceptRow(rowIndex: number, _row: string[]): boolean {
    return rowIndex >= 1; // Skip header row.
  }

  protected override transformRow(validatedRow: ResponseRow): OfficerData {
    const [
      committee,
      title,
    ] = this.validateBoardPosition(validatedRow[Column.BoardPosition]);

    const upeMajor = this.validateUpeMajor(validatedRow[Column.Major]);

    const graduationQuarter = validatedRow[Column.GraduationQuarter];
    this.assertQuarterName(graduationQuarter);

    const activeQuarters = this.validateActiveQuarters(
      validatedRow[Column.ActiveQuarters],
    );

    return {
      legalFirst: validatedRow[Column.LegalFirst],
      legalLast: validatedRow[Column.LegalLast],
      preferredName: validatedRow[Column.PreferredFull],
      pronouns: validatedRow[Column.Pronouns],
      committee,
      title,
      major: upeMajor,
      graduation: graduationQuarter,
      preferredEmail: validatedRow[Column.PreferredEmail],
      phoneNumber: validatedRow[Column.PhoneNumber],
      discordUsername: validatedRow[Column.DiscordUsername],
      activeQuarters: activeQuarters,
      uid: validatedRow[Column.Uid],
    };
  }

  private validateBoardPosition(
    value: string,
  ): [committee: Committee, title: Title] {
    const tokens = value.split(" ");
    const titleName = tokens.pop() as TitleName;
    const title = getTitleFromName(titleName);
    const committeeName = tokens.join(" ") as CommitteeName;
    const committee = getCommitteeFromName(committeeName);
    return [committee, title];
  }

  private validateUpeMajor(value: string): UpeMajor {
    const major = resolveUpeMajor(value);
    if (major === null) {
      throw new SheetsRowTransformError(
        `'${value}' could not be resolved to a valid UPE major`,
      );
    }
    return major;
  }

  private validateActiveQuarters(value: string): Quarter[] {
    const quarters: Quarter[] = [];
    for (const token of value.split(", ")) {
      this.assertQuarter(token);
      quarters.push(token);
    }
    return quarters;
  }

  // TODO: This kind of validation should probably be promoted next to and kept
  // as single source of truth for their respective branded types.

  private assertQuarterName(value: string): asserts value is QuarterName {
    assert(/^(Fall|Winter|Spring) [0-9]+$/.test(value));
  }

  private assertQuarter(value: string): asserts value is Quarter {
    assert(["Fall", "Winter", "Spring"].includes(value));
  }
}

class OfficersServiceFactory {
  private readonly instances = new Collection<string, OfficersService>();

  public make(spreadsheetId: string): OfficersService {
    let service = this.instances.get(spreadsheetId);
    if (service != undefined) {
      return service;
    }

    // Dependency inject the production clients.
    const sheetsClient = GoogleSheetsClient.fromCredentialsFile(
      spreadsheetId,
      "Form Responses 1",
    );
    service = new OfficersService(sheetsClient, new SystemDateClient());

    this.instances.set(spreadsheetId, service);
    return service;
  }
}

export default new OfficersServiceFactory();
