export interface ISheetsClient {
  spreadsheetId: string;
  sheetName: string;
  getRows(): Promise<string[][]>;
}
