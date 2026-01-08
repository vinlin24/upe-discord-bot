import {
  AuditLogEvent,
  bold,
  Colors,
  EmbedBuilder,
  Events,
  userMention,
  type Guild,
  type GuildAuditLogsEntry,
  type GuildMember,
} from "discord.js";

import { DiscordEventListener } from "../../abc/listener.abc";
import channelsService from "../../services/channels.service";
import type { UnixSeconds } from "../../types/branded.types";
import type { Prettify } from "../../types/generic.types";
import { isoToUnixSeconds, msecToUnixSeconds } from "../../utils/date.utils";
import { EMOJI_ALERT, EMOJI_INFORMATION } from "../../utils/emojis.utils";
import { timestampPair, toBulletedList } from "../../utils/formatting.utils";
import {
  MODERATION_CHANNEL_ID,
  OFFICER_MEMES_CHANNEL_ID,
  OFFICERS_ROLE_ID,
} from "../../utils/snowflakes.utils";

type TimeoutIssuedDetails = {
  type: "issued";
  timestamp: UnixSeconds;
  until: UnixSeconds;
  reason: string | null;
  executor: GuildMember;
  target: GuildMember;
};

type TimeoutRemovedDetails = {
  type: "removed";
  timestamp: UnixSeconds;
  executor: GuildMember;
  target: GuildMember;
};

/**
 * Discriminated union to ease the processing of the audit log entry change
 * object.
 */
type TimeoutDetails = Prettify<TimeoutIssuedDetails | TimeoutRemovedDetails>;

class TimeoutAlertListener
  extends DiscordEventListener<Events.GuildAuditLogEntryCreate> {
  public override readonly event = Events.GuildAuditLogEntryCreate;

  public override async execute(
    auditLogEntry: GuildAuditLogsEntry<AuditLogEvent>,
    guild: Guild,
  ): Promise<boolean> {
    if (auditLogEntry.action !== AuditLogEvent.MemberUpdate) {
      return false;
    }

    const details = await this.parseTimeoutDetails(auditLogEntry, guild);
    if (details === null) {
      return false;
    }

    const embed = this.formatEmbed(details);
    await channelsService.getLogSink()?.send({ embeds: [embed] });

    // For the lolz.
    if (details.target.roles.cache.has(OFFICERS_ROLE_ID)) {
      const memesChannel = await guild.channels.fetch(OFFICER_MEMES_CHANNEL_ID);
      if (memesChannel !== null && memesChannel.isTextBased()) {
        await memesChannel.send({ embeds: [embed] });
      }
    }
    // Probably serious.
    else {
      const modChannel = await guild.channels.fetch(MODERATION_CHANNEL_ID);
      if (modChannel !== null && modChannel.isTextBased()) {
        await modChannel.send({ embeds: [embed] });
      }
    }

    return true;
  }

  private async parseTimeoutDetails(
    auditLogEntry: GuildAuditLogsEntry,
    guild: Guild,
  ): Promise<TimeoutDetails | null> {
    const change = auditLogEntry.changes.find(
      c => c.key === "communication_disabled_until",
    );
    if (change === undefined) {
      return null;
    }

    const executor = await guild.members.fetch(auditLogEntry.executorId!);
    const target = await guild.members.fetch(auditLogEntry.targetId!);

    // old: undefined, new: <timestamp> means user got timed out.
    if (change.new) {
      return {
        type: "issued",
        until: isoToUnixSeconds(change.new as string),
        timestamp: msecToUnixSeconds(auditLogEntry.createdTimestamp),
        reason: auditLogEntry.reason,
        executor,
        target,
      };
    }

    // old: <timestamp>, new: undefined means user's timeout was removed.
    if (change.old) {
      return {
        type: "removed",
        timestamp: msecToUnixSeconds(auditLogEntry.createdTimestamp),
        executor,
        target,
      };
    }

    // Shouldn't be reached but just in case.
    return null;
  }

  private formatEmbed(details: TimeoutDetails): EmbedBuilder {
    const embed = new EmbedBuilder();
    const { target, executor } = details;

    const [sinceMention, sinceRelative] = timestampPair(details.timestamp);

    if (details.type === "issued") {
      const [untilMention, untilRelative] = timestampPair(details.until);

      const description = toBulletedList([
        `${bold("For:")} ${userMention(target.id)}`,
        `${bold("By:")} ${userMention(executor.id)}`,
        `${bold("Since:")} ${sinceMention} (${sinceRelative})`,
        `${bold("Until:")} ${untilMention} (${untilRelative})`,
        `${bold("Reason:")} ${details.reason ?? "(none given)"}`,
      ]);

      embed.setTitle(`${EMOJI_ALERT} Timeout Issued`);
      embed.setDescription(description);
      embed.setColor(Colors.DarkRed);
    }
    else if (details.type === "removed") {
      const description = toBulletedList([
        `${bold("For:")} ${userMention(target.id)}`,
        `${bold("By:")} ${userMention(executor.id)}`,
        `${bold("Since:")} ${sinceMention} (${sinceRelative})`,
      ]);

      embed.setTitle(`${EMOJI_INFORMATION} Timeout Removed`);
      embed.setDescription(description);
      embed.setColor(Colors.DarkGreen);
    }

    return embed;
  }
}

export default new TimeoutAlertListener();
