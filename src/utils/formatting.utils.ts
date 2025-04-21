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

/**
 * Convert a string to one that can be used as a channel name.
 *
 * NOTE: Not sure if the API automatically does this for us, but I'm too lazy
 * to find out manually.
 */
export function normalizeChannelName(name: string): string {
  return (name
    .toLowerCase()
    .replaceAll(" ", "-") // Spaces become '-'s.
    .replaceAll(/[^0-9a-z_-]/g, "") // Only alphanumeric & '-' & '_' allowed.
    .replaceAll("--", "-") // No consecutive '-'s.
  );
}

export function emailHyperlink(email: string): string {
  return quietHyperlink(email, `mailto:${email}` as UrlString);
}

export function isBlankOrNumeric(s: string): boolean {
  return s === "" || /^([0-9]|[1-9][0-9]*)$/.test(s);
}

export function toCount(raw: string): number {
  const value = Number.parseInt(raw);
  if (Number.isNaN(value)) {
    return 0;
  }
  return value;
}
