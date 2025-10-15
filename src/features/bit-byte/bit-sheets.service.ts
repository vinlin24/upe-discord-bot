import { z } from "zod";

import { RowWiseSheetsService } from "../../abc/sheets.abc";
import { GoogleSheetsClient } from "../../clients/sheets.client";
import env from "../../env";
import type { UserId } from "../../types/branded.types";
import { SystemDateClient } from "../../utils/date.utils";

enum RegistryColumn {
  Family = 0,
  FirstName,
  LastName,
  Email,
  DiscordId,
}

const RegistrySchema = z.tuple([
  z.string().trim(),  // Family
  z.string().trim(),  // FirstName
  z.string().trim(),  // LastName
  z.string().trim(),  // Email
  z.string().trim(),  // DiscordId
]).rest(z.any());

type RegistryRow = z.infer<typeof RegistrySchema>;

/** The DTO passed around outside of this service, to represent a bit. */
export type BitData = {
  /**
   * NOTE: There's no useful "key" to index this data by, but we need one anyway
   * for the sheets service framework. Callers should just use the getAllData()
   * API and iterate over it to get what they need.
   */
  _key: number;
  /** NOTE: Name of family, without the season ID prefix (e.g. `Alice-Bob`). */
  family: string;
  email: string;
  name: string;
  discordId?: UserId;
};

class BitSheetsService extends RowWiseSheetsService<
  BitData,
  "_key",
  RegistryRow
> {
  protected override readonly key = "_key";
  protected override readonly schema = RegistrySchema;

  // AUTOINCREMENT type shi.
  private _key = 0;

  protected override acceptRow(rowIndex: number, _row: string[]): boolean {
    return rowIndex >= 2; // Skip table header rows.
  }

  protected override transformRow(validatedRow: RegistryRow): BitData {
    const fullName = (
      validatedRow[RegistryColumn.FirstName] + " " +
      validatedRow[RegistryColumn.LastName]
    );

    const discordIdText = validatedRow[RegistryColumn.DiscordId].trim();
    const discordId = discordIdText as UserId || undefined;

    const bitData: BitData = {
      _key: this._key,
      email: validatedRow[RegistryColumn.Email],
      family: validatedRow[RegistryColumn.Family],
      name: fullName,
      discordId,
    };

    this._key++;

    return bitData;
  }
}

// Dependency-inject the production clients.
const sheetsClient = GoogleSheetsClient.fromCredentialsFile(
  env.BIT_DATA_SPREADSHEET_ID,
  "Registry",
);
export default new BitSheetsService(sheetsClient, new SystemDateClient());
