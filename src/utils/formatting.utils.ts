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
