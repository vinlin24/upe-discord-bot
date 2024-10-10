import fs from "node:fs";

import { google } from "googleapis";
import type { sheets_v4 } from "googleapis/build/src/apis/sheets/v4";
import { z } from "zod";

const ServiceAccountCredentialsSchema = z.object({
  client_email: z.string().email(),
  private_key: z.string(),
});

export type ServiceAccountCredentials =
  z.infer<typeof ServiceAccountCredentialsSchema>;

export function loadServiceAccountCredentials(
  jsonPath: string,
): ServiceAccountCredentials {
  const content = fs.readFileSync(jsonPath, { encoding: "utf-8" });
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

export class GoogleSheetsService {
  constructor(
    private readonly client: sheets_v4.Sheets,
    private readonly spreadsheetId: string,
  ) { }

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
