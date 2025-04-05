import fs from "node:fs";

import { google } from "googleapis";
import type { sheets_v4 } from "googleapis/build/src/apis/sheets/v4";
import { z } from "zod";

import { Collection } from "discord.js";
import { PROJECT_ASSETS_ROOT, resolvePath } from "../../utils/paths.utils";
import { cleanProvidedUsername } from "./input.utils";

export const GOOGLE_CREDENTIALS_PATH
  = resolvePath(PROJECT_ASSETS_ROOT, "google-credentials.json");

// You know what, assert this at import time. No "find out we forgot this" BS
// late into the runtime.
if (!fs.existsSync(GOOGLE_CREDENTIALS_PATH)) {
  throw new Error(
    `Google Sheets credentials file not found: ${GOOGLE_CREDENTIALS_PATH}`,
  );
}

const ServiceAccountCredentialsSchema = z.object({
  client_email: z.string().email(),
  private_key: z.string(),
});

export type ServiceAccountCredentials =
  z.infer<typeof ServiceAccountCredentialsSchema>;

function loadServiceAccountCredentials(): ServiceAccountCredentials {
  const content = fs.readFileSync(
    GOOGLE_CREDENTIALS_PATH,
    { encoding: "utf-8" },
  );
  const json = JSON.parse(content);
  const validated = ServiceAccountCredentialsSchema.parse(json);
  return validated;
}

function initGoogleSheetsClient(
  clientEmail: string,
  privateKey: string,
  scopes?: string[],
): sheets_v4.Sheets {
  scopes ??= ["https://www.googleapis.com/auth/spreadsheets.readonly"];
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: clientEmail,
      private_key: privateKey,
    },
    scopes,
  });
  const sheets = google.sheets({ version: "v4", auth });
  return sheets;
}

class GoogleSheetsClient {
  constructor(
    private readonly client: sheets_v4.Sheets,
    public readonly spreadsheetId: string,
  ) { }

  public static fromCredentialsFile(spreadsheetId: string): GoogleSheetsClient {
    const credentials = loadServiceAccountCredentials();
    const client = initGoogleSheetsClient(
      credentials.client_email,
      credentials.private_key,
    );
    return new GoogleSheetsClient(client, spreadsheetId);
  }

  public async getValues(
    sheetName: string,
    cellRange?: string,
  ): Promise<string[][] | null> {
    const range = this.formatA1Notation(sheetName, cellRange);
    const response = await this.client.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range,
    });
    return response.data.values ?? null;
  }

  private formatA1Notation(
    sheetName: string,
    cellRange?: string,
  ): string {
    // See: https://developers.google.com/sheets/api/guides/concepts#a1-notation
    const isAlphanumeric = /^[a-zA-Z0-9]+$/.test(sheetName);
    if (!isAlphanumeric) {
      sheetName = `'${sheetName}'`;
    }
    let result = sheetName;
    if (cellRange) {
      result += `!${cellRange}`;
    }
    return result;
  }
}

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

  public async getAllData(): Promise<Collection<string, InducteeData>> {
    await this.updateCache();
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

export const S25_INDUCTEE_DATA_SPREADSHEET_ID // Update every season lol.
  = "1Q3-kzFwhKiwh2zh4Zf_ufzWUaRCDqSwkSEJt2FqFNKM";

export default new InducteeSheetsService(S25_INDUCTEE_DATA_SPREADSHEET_ID);
