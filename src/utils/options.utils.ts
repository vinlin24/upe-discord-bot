import { SlashCommandBuilder } from "discord.js";

/**
 * For some reason, some of the methods on a `SlashCommandBuilder` cause it to
 * become the `Omit<...>` type, so this union accounts for that.
 */
type AnySlashCommandBuilder =
  | SlashCommandBuilder
  | Omit<SlashCommandBuilder, "addSubcommand" | "addSubcommandGroup">;

/** @deprecated Use the extended builder class instead. */
export function addBroadcastOption(
  commandDefinition: AnySlashCommandBuilder,
  required: boolean = false,
): void {
  commandDefinition.addBooleanOption(input => input
    .setName("broadcast")
    .setDescription("Whether to respond publicly instead of ephemerally.")
    .setRequired(required)
  );
}

export class ExtendedSlashCommandBuilder extends SlashCommandBuilder {
  public addBroadcastOption(required: boolean = false) {
    return this.addBooleanOption(input => input
      .setName("broadcast")
      .setDescription("Whether to respond publicly instead of ephemerally.")
      .setRequired(required)
    );
  }
}
