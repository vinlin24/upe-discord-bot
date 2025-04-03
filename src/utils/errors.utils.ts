import { Colors, DiscordAPIError, EmbedBuilder } from "discord.js";
import { MongoError } from "mongodb";

/**
 * See: https://discord.com/developers/docs/topics/opcodes-and-status-codes
 */
export type DiscordAPIErrorWithCode<Opcode extends number>
  = DiscordAPIError & { code: Opcode };

/**
 * DiscordAPIError[50001]: `Missing access`. This can happen if the bot is
 * missing the required role permissions. Confusingly, this is distinct from
 * DiscordAPIError[50013]: `You lack permissions to perform that action`.
 */
export function isMissingAccessError(
  error: unknown,
): error is DiscordAPIErrorWithCode<50001> {
  return error instanceof DiscordAPIError && error.code === 50001;
}

/**
 * DiscordAPIError[50013]: `You lack permissions to perform that action`. This
 * can happen if, for example, the bot tries to moderate a user whose highest
 * role is higher than the bot's highest role.
 */
export function isMissingPermissionsError(
  error: unknown,
): error is DiscordAPIErrorWithCode<50013> {
  return error instanceof DiscordAPIError && error.code === 50013;
}

export function makeErrorEmbed(message: string): EmbedBuilder;
export function makeErrorEmbed(title: string, message: string): EmbedBuilder;
export function makeErrorEmbed(
  arg1: string,
  arg2?: string,
): EmbedBuilder {
  let message: string;
  let title: string | undefined;

  if (arg2 === undefined) {
    message = arg1;
    title = undefined;
  } else {
    message = arg2;
    title = arg1;
  }

  const embed = new EmbedBuilder()
    .setDescription(message)
    .setColor(Colors.Red);

  if (title) {
    embed.setTitle(title);
  }

  return embed;
}

export type MongoErrorWithCode<Opcode extends number>
  = MongoError & { code: Opcode };

export function isMongoDuplicateKeyError(error: unknown)
  : error is MongoErrorWithCode<11000> {
  return error instanceof MongoError && error.code === 11000;
}
