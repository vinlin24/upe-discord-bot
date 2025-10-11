import { Collection, type Awaitable } from "discord.js";
import { z } from "zod";

import type { ISheetsClient } from "../interfaces/sheets.interface";
import type { Seconds, UnixSeconds } from "../types/branded.types";
import type { IDateClient } from "../utils/date.utils";

export abstract class SheetsService<
  Data extends Record<string, any>,
  Key extends keyof Data,
> {
  protected abstract readonly key: Key;

  protected readonly cache = new Collection<Data[Key], Data>();
  protected refreshInterval = 300 as Seconds;
  protected lastUpdated = 0 as UnixSeconds;

  public constructor(
    protected readonly sheets: ISheetsClient,
    protected readonly dates: IDateClient,
  ) { }

  public async getData(key: Data[Key], force?: boolean): Promise<Data | null> {
    if (force || this.shouldRefresh()) {
      await this.updateCache();
    }
    return this.cache.get(key) ?? null;
  }

  public async getAllData(
    force?: boolean,
  ): Promise<Collection<Data[Key], Data>> {
    if (force || this.shouldRefresh()) {
      await this.updateCache();
    }
    return this.cache.clone();
  }

  public get lastUpdateTime(): UnixSeconds {
    return this.lastUpdated;
  }

  protected abstract parseData(rows: string[][]): AsyncIterable<Data>;

  protected async updateCache(): Promise<void> {
    const sheetData = await this.sheets.getRows();
    this.cache.clear();
    for await (const requirementsData of this.parseData(sheetData)) {
      this.cache.set(requirementsData[this.key], requirementsData);
    }
    this.lastUpdated = this.dates.getNow();
  }

  protected padRow(
    row: string[],
    lengthNeeded: number,
    padValue: string = "",
  ): string[] {
    // Latter columns are omitted if they're omitted, causing `row` to be
    // shorter than what's expected by the full schema, so we need to pad.
    const paddedRow = row.slice();
    while (paddedRow.length < lengthNeeded) {
      paddedRow.push(padValue);
    }
    return paddedRow;
  }

  private shouldRefresh(): boolean {
    // This would be the (lazy) initialization.
    if (this.lastUpdated === 0) {
      return true;
    }
    const now = this.dates.getNow();
    return now >= this.lastUpdated + this.refreshInterval;
  }
}

export class SheetsRowTransformError extends Error { }

/**
 * Extraction and generalization of the most common sheet parsing flow:
 *
 *    1. Skip certain rows, then for each row:
 *    2. Possibly pre-process/sanitize before passing it off to Zod.
 *    3. Parse with Zod schema.
 *    4. Handle possible parse error.
 *    5. Transform validated row into DTO with some function.
 */
export abstract class RowWiseSheetsService<
  Data extends Record<string, any>,
  Key extends keyof Data,
  ValidatedRow extends [unknown, ...unknown[]],
> extends SheetsService<Data, Key> {

  protected abstract readonly schema: z.Schema<ValidatedRow>;

  protected override async *parseData(
    rows: string[][],
  ): AsyncIterable<Data> {
    for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
      const rawRow = rows[rowIndex];

      if (!await this.acceptRow(rowIndex, rawRow)) {
        continue;
      }

      const sanitizedRow = await this.sanitizeRow(rawRow);

      try {
        const validatedRow = this.schema.parse(sanitizedRow);
        yield await this.transformRow(validatedRow);
      }
      catch (error) {
        if (error instanceof z.ZodError) {
          await this.handleParseError(error, rowIndex);
          continue;
        }
        if (error instanceof SheetsRowTransformError) {
          await this.handleTransformError(error, rowIndex);
          continue;
        }
        throw error;
      }
    }
  }

  protected abstract transformRow(validatedRow: ValidatedRow): Awaitable<Data>;

  protected acceptRow(rowIndex: number, row: string[]): Awaitable<boolean> {
    return true;
  }

  protected sanitizeRow(row: string[]): Awaitable<unknown[]> {
    return row;
  }

  protected handleParseError(
    error: z.ZodError,
    rowIndex: number,
  ): Awaitable<void> {
    console.error(
      `Error validating data (row ${rowIndex + 1}): ${error.message}`,
    );
  }

  protected handleTransformError(
    error: SheetsRowTransformError,
    rowIndex: number,
  ): Awaitable<void> {
    console.error(
      `Error transforming data (row ${rowIndex + 1}): ${error.message}`,
    );
  }
}
