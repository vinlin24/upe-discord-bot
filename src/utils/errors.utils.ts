import { DiscordAPIError } from "discord.js";

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
