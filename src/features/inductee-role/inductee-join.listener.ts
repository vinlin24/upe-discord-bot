import {
  Colors,
  EmbedBuilder,
  Events,
  roleMention,
  userMention,
  type GuildMember,
} from "discord.js";

import { DiscordEventListener } from "../../abc/listener.abc";
import channelsService from "../../services/channels.service";
import inducteeSheetsService, {
  type InducteeData,
} from "../../services/inductee-sheets.service";
import type { UserId } from "../../types/branded.types";
import { INDUCTEES_ROLE_ID } from "../../utils/snowflakes.utils";

export class InducteeJoinListener
  extends DiscordEventListener<Events.GuildMemberAdd> {

  public override readonly event = Events.GuildMemberAdd;

  public override async execute(member: GuildMember): Promise<boolean> {
    // TODO: Proper logging.
    console.log(`User ${member.user.username} joined.`);

    let inducteeData = await inducteeSheetsService.getData(member.id as UserId);

    if (inducteeData === null) {
      return false;
    }

    await member.roles.add(INDUCTEES_ROLE_ID, "User is a registered inductee");
    await this.notifyLogs(member, inducteeData);
    return true;
  }

  private async notifyLogs(
    member: GuildMember,
    inducteeData: InducteeData,
  ): Promise<void> {
    const preferredName = inducteeData.preferredName ?? inducteeData.legalName;

    let description = (
      `${userMention(member.id)} (${preferredName}) just joined the server ` +
      `and was given the ${roleMention(INDUCTEES_ROLE_ID)} role.`
    );

    await channelsService.getLogSink()?.send({
      embeds: [new EmbedBuilder()
        .setColor(Colors.Yellow)
        .setTitle("Inductee Joined the Server")
        .setDescription(description)
        .setImage(member.avatarURL()),
      ],
    });
  }
}

export default new InducteeJoinListener();
