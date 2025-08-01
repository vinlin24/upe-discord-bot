import {
  Events,
  PermissionFlagsBits,
  type GuildMember,
  type GuildTextBasedChannel,
  type Message,
} from "discord.js";
import _ from "lodash";

import { DiscordEventListener } from "../../abc/listener.abc";
import type { UnixSeconds } from "../../types/branded.types";
import { SystemDateClient, type IDateClient } from "../../utils/date.utils";
import {
  ADMINS_ROLE_ID,
  CORPORATE_ROLE_ID,
  DEVELOPER_ROLE_ID,
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
    if (!this.isPrivateChannel(message.channel)) {
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

  private isPrivateChannel(channel: GuildTextBasedChannel): boolean {
    return !channel.permissionsFor(channel.guild.roles.everyone)
      .has(PermissionFlagsBits.ViewChannel);
  }

  private getReplyString(): string {
    return _.sample(["arf", "woof", "bark"]);
  }
}

export default new ArfListener(new SystemDateClient());
