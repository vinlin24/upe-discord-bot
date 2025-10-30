import {
  Events,
  PermissionFlagsBits,
  type GuildMember,
  type GuildTextBasedChannel,
  type Message,
} from "discord.js";
import _ from "lodash";

import { DiscordEventListener } from "../../abc/listener.abc";
import { BitByteService } from "../../services/bit-byte.service";
import type { UnixSeconds } from "../../types/branded.types";
import { isWithinChannel } from "../../utils/channels.utils";
import { SystemDateClient, type IDateClient } from "../../utils/date.utils";
import {
  ADMINS_ROLE_ID,
  CORPORATE_ROLE_ID,
  DEVELOPER_ROLE_ID,
  INDUCTEES_CHAT_CHANNEL_ID,
  INDUCTION_ANNOUNCEMENTS_CHANNEL_ID,
} from "../../utils/snowflakes.utils";

class ArfListener extends DiscordEventListener<Events.MessageCreate> {
  public override readonly event = Events.MessageCreate;
  private cooldownExpiration = 0 as UnixSeconds;

  private static readonly COOLDOWN_INTERVAL = 3600 as UnixSeconds;

  public constructor(private readonly dateClient: IDateClient) { super(); }

  public override async execute(message: Message<true>): Promise<boolean> {
    const now = this.dateClient.getNow();

    if (now < this.cooldownExpiration) {
      return false;
    }
    if (!await this.isPrivateChannel(message.channel)) {
      return false;
    }
    if (!message.member || !this.isTargetOfficer(message.member)) {
      return false;
    }

    await message.reply(this.getReplyString());

    this.cooldownExpiration = (
      this.dateClient.getNow() + ArfListener.COOLDOWN_INTERVAL
    ) as UnixSeconds;

    return true;
  }

  private isTargetOfficer(member: GuildMember): boolean {
    return (
      member.roles.cache.hasAll(ADMINS_ROLE_ID, CORPORATE_ROLE_ID)
      && !member.roles.cache.has(DEVELOPER_ROLE_ID)
    );
  }

  private async isPrivateChannel(
    channel: GuildTextBasedChannel,
  ): Promise<boolean> {
    const isPublic = channel.permissionsFor(channel.guild.roles.everyone)
      .has(PermissionFlagsBits.ViewChannel);

    // Don't embarrass them in front of their bits.
    const isBitByteChannel = isWithinChannel(
      channel.parent,
      (channel) => channel.name === BitByteService.CATEGORY_NAME,
    );

    // Not in front of the inductees either.
    const isInductionChannel = (
      isWithinChannel(channel, INDUCTION_ANNOUNCEMENTS_CHANNEL_ID) ||
      isWithinChannel(channel, INDUCTEES_CHAT_CHANNEL_ID)
    );

    return !isPublic && !isBitByteChannel && !isInductionChannel;
  }

  private getReplyString(): string {
    return _.sample(["arf", "woof", "bark"]);
  }
}

export default new ArfListener(new SystemDateClient());
