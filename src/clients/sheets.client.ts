import fs from "node:fs";

import { google, type sheets_v4 } from "googleapis";
import { z } from "zod";

import type { ISheetsClient } from "../interfaces/sheets.interface";
import type { UrlString } from "../types/branded.types";
import { PROJECT_ASSETS_ROOT, resolvePath } from "../utils/paths.utils";

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

export function loadServiceAccountCredentials(): ServiceAccountCredentials {
  const content = fs.readFileSync(
    GOOGLE_CREDENTIALS_PATH,
    { encoding: "utf-8" },
  );
  const json = JSON.parse(content);
  const validated = ServiceAccountCredentialsSchema.parse(json);
  return validated;
}

export function initGoogleSheetsClient(
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

export class SheetsGetError extends Error {
  constructor(
    public readonly spreadsheetId: string,
    public readonly sheetName: string,
  ) {
    super(
      `couldn't read data from sheet ${sheetName} ` +
      `of spreadsheet ${spreadsheetId}`,
    );
  }
}

export class GoogleSheetsClient implements ISheetsClient {
  constructor(
    private readonly googleClient: sheets_v4.Sheets,
    public readonly spreadsheetId: string,
    public readonly sheetName: string,
  ) { }

  public static fromCredentialsFile(
    spreadsheetId: string,
    sheetName: string,
  ): GoogleSheetsClient {
    const credentials = loadServiceAccountCredentials();
    const googleClient = initGoogleSheetsClient(
      credentials.client_email,
      credentials.private_key
    );
    return new GoogleSheetsClient(googleClient, spreadsheetId, sheetName);
  }

  public static idToUrl(spreadsheetId: string): UrlString {
    return (
      `https://docs.google.com/spreadsheets/d/${spreadsheetId}`
    ) as UrlString;
  }

  public async getRows(cellRange?: string): Promise<string[][]> {
    const range = this.formatA1Notation(this.sheetName, cellRange);
    const response = await this.googleClient.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range,
    });
    if (!response.data.values) {
      throw new SheetsGetError(this.spreadsheetId, this.sheetName);
    }
    return response.data.values ?? null;
  }

  private formatA1Notation(
    sheetName: string,
    cellRange?: string
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
