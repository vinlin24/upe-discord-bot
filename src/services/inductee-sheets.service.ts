import { Collection } from "discord.js";
import { configDotenv } from "dotenv";
import { z } from "zod";

import { GoogleSheetsClient } from "../clients/sheets.client";
import { cleanProvidedUsername } from "../features/inductee-role/input.utils";

configDotenv();

export const { INDUCTEE_DATA_SPREADSHEET_ID } = process.env;

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
  z.string().email(),                           // Email
  z.string().email(),                           // PreferredEmail
  z.string().refine(s => /[0-9]{9}/.test(s)),   // UclaId
  z.string().trim(),                            // LegalFirst
  z.string().trim(),                            // LegalLast
  z.string().trim(),                            // PreferredFirst
  z.string().trim(),                            // PreferredLast
  z.string().transform(cleanProvidedUsername),  // DiscordUsername
  z.nativeEnum(UpeMajor),                       // Major
]).rest(z.any());

export type InducteeData = {
  preferredEmail: string;
  legalName: string;
  preferredName?: string;
  discordUsername: string;
  major: UpeMajor;
};

export class InducteeSheetsService {
  private readonly client: GoogleSheetsClient;
  private readonly inducteesCache = new Collection<string, InducteeData>();
  private updatedOnceYet = false;

  public constructor(spreadsheetId: string) {
    this.client = GoogleSheetsClient.fromCredentialsFile(spreadsheetId);
  }

  public async getData(username: string): Promise<InducteeData | null> {
    const data = this.inducteesCache.get(username);
    if (data === undefined) {
      console.log(`${username} not found in inductees cache, updating cache.`);
      await this.updateCache();
    }
    else {
      console.log(`${username} found in inductees cache.`);
      return data;
    }

    const dataRetry = this.inducteesCache.get(username);
    if (dataRetry === undefined) {
      console.log(
        `${username} still not found in inductees cache, ` +
        "assuming not an inductee.",
      );
      return null;
    }
    console.log(`${username} found in updated inductees cache.`);
    return dataRetry;
  }

  public async getAllData(
    force: boolean = true,
  ): Promise<Collection<string, InducteeData>> {
    if (force || !this.updatedOnceYet) {
      await this.updateCache();
    }
    return this.inducteesCache.clone();
  }

  private async updateCache(): Promise<void> {
    // No one better rename the sheet lol.
    const SHEET_NAME = "Form Responses 1";
    const sheetData = await this.client.getValues(SHEET_NAME);
    if (sheetData === null) {
      console.error(
        `Couldn't read data from sheet ${SHEET_NAME} ` +
        `of spreadsheet ${this.client.spreadsheetId}`,
      )
      return;
    }

    // Start at 1 to skip the header row.
    for (let rowIndex = 1; rowIndex < sheetData.length; rowIndex++) {
      const row = sheetData[rowIndex];
      try {
        const inducteeData = this.parseRow(row);
        this.inducteesCache.set(inducteeData.discordUsername, inducteeData);
      }
      catch (error) {
        if (error instanceof z.ZodError) {
          console.error(
            `Error validating inductee response data (row ${rowIndex + 1}): ` +
            error.message,
          )
          continue;
        }
        throw error;
      }
    }

    this.updatedOnceYet = true;
  }

  private parseRow(row: string[]): InducteeData {
    const validatedRow = QuestionnaireSchema.parse(row);

    return {
      preferredEmail: validatedRow[QuestionnaireColumn.PreferredEmail],
      legalName: (
        validatedRow[QuestionnaireColumn.LegalFirst] + " " +
        validatedRow[QuestionnaireColumn.LegalLast]
      ),
      preferredName: (
        validatedRow[QuestionnaireColumn.PreferredFirst] + " " +
        validatedRow[QuestionnaireColumn.PreferredLast]
      ).trim() || undefined,
      discordUsername: validatedRow[QuestionnaireColumn.DiscordUsername],
      major: validatedRow[QuestionnaireColumn.Major],
    };
  }
}

export default new InducteeSheetsService(INDUCTEE_DATA_SPREADSHEET_ID);
