import { Collection, type Awaitable } from "discord.js";
import { z } from "zod";

import type { ISheetsClient } from "../interfaces/sheets.interface";
import type { Seconds, UnixSeconds } from "../types/branded.types";
import type { IDateClient } from "../utils/date.utils";

export type ParseRowWiseOptions<ValidatedRow, Data> = {
  rows: string[][];
  schema: z.Schema<ValidatedRow>;
  transformer: (validatedRow: ValidatedRow) => Awaitable<Data>;
  filter?: (index: number) => Awaitable<boolean>;
  sanitizer?: (row: string[]) => Awaitable<unknown[]>;
  handler?: (error: z.ZodError, index?: number) => Awaitable<void>;
};

export abstract class SheetsService<
  Data extends Record<string, any>,
  Key extends keyof Data,
> {
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
    for await (const requirementsData of this.parseData(sheetData)) {
      this.cache.set(requirementsData.name, requirementsData);
    }
    this.lastUpdated = this.dates.getNow();
  }

  /**
   * Extraction and generalization of the most common flow:
   *
   *    1. Skip certain rows, then for each row:
   *    2. Possibly pre-process/sanitize before passing it off to Zod.
   *    3. Parse with Zod schema.
   *    4. Transform with some function.
   */
  protected async *parseRowWise<ValidatedRow extends [unknown, ...unknown[]]>(
    options: ParseRowWiseOptions<ValidatedRow, Data>,
  ): AsyncIterable<Data> {
    const { rows, schema, transformer, handler } = options;
    let { filter, sanitizer } = options;
    filter ??= (_index) => true;
    sanitizer ??= (row) => row;

    for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
      if (!await filter(rowIndex)) {
        continue;
      }
      const row = await sanitizer(rows[rowIndex]);
      try {
        const validatedRow = schema.parse(row);
        yield await transformer(validatedRow);
      }
      catch (error) {
        if (error instanceof z.ZodError) {
          console.error(
            `Error validating data (row ${rowIndex + 1})): ${error.message}`,
          );
          await handler?.(error);
          continue;
        }
        throw error;
      }
    }
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
