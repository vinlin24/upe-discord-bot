import type { GuildBasedChannel } from "discord.js";
import type { ChannelId } from "../types/branded.types";

export function isWithinChannel(
  channel: GuildBasedChannel | null | undefined,
  predicate: (channel: GuildBasedChannel) => boolean,
): boolean;
export function isWithinChannel(
  channel: GuildBasedChannel | null | undefined,
  channelId: ChannelId,
): boolean;
/**
 * Shortcut helper for checking if either `channel` or its `.parent` satisfy the
 * `predicate`. This is useful when we need to check if something is applicable
 * to both a channel and threads within the channel.
 */
export function isWithinChannel(
  channel: GuildBasedChannel | null | undefined,
  predicate: ((channel: GuildBasedChannel) => boolean) | ChannelId,
): boolean {
  if (!channel) {
    return false;
  }

  // Normalize from channel ID to function.
  if (typeof predicate === "string") {
    const channelId = predicate;
    predicate = (channel) => channel.id === channelId;
  }

  const directResult = predicate(channel);
  if (directResult) {
    return true;
  }
  const { parent } = channel;
  if (parent === null) {
    return false;
  }
  const parentResult = predicate(parent);
  return parentResult;
}
