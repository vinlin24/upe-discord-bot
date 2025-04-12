import {
  hyperlink,
  time,
  TimestampStyles,
  type ChatInputCommandInteraction,
  type GuildTextBasedChannel,
} from "discord.js";

import type { UnixSeconds, UrlString } from "../types/branded.types";

export function toBulletedList(lines: unknown[]): string {
  return lines.map(line => `* ${line}`).join("\n");
}

export function formatContext(
  interaction: ChatInputCommandInteraction,
): string {
  const commandName = interaction.commandName;
  const callerName = interaction.user.username;
  const channelName = (interaction.channel as GuildTextBasedChannel).name;
  return `@${callerName} /${commandName} #${channelName}`;
}

export function timestampPair(
  timestamp: UnixSeconds,
): [`<t:${UnixSeconds}>`, `<t:${UnixSeconds}:R>`] {
  return [time(timestamp), time(timestamp, TimestampStyles.RelativeTime)];
}

/** Same as `hyperlink()` but suppress embeds. */
export function quietHyperlink<C extends string, U extends UrlString>(
  content: C,
  url: U,
): `[${C}](<${U}>)` {
  return hyperlink(content, `<${url}>`);
}

/**
 * Shorthand for formatting the possessive form of a noun based on if it ends
 * with the letter 's'.
 */
export function possessive(noun: string): string {
  return /s$/i.test(noun) ? `${noun}'` : `${noun}'s`;
}

/**
 * Format with "inverse header" style. There doesn't seem to be a helper already
 * for this in the discord.js package.
 */
export function littleText<T extends string>(text: T): `-# ${T}` {
  return `-# ${text}`;
}
