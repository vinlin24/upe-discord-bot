import {
  Colors,
  EmbedBuilder,
  Events,
  inlineCode,
  roleMention,
  userMention,
  type GuildMember,
} from "discord.js";

import { DiscordEventListener } from "../../abc/listener.abc";
import channelsService from "../../services/channels.service";
import { EMOJI_WARNING } from "../../utils/emojis.utils";
import { INDUCTEES_ROLE_ID } from "../../utils/snowflakes.utils";
import inducteeSheetsService, { type InducteeData } from "./sheets.service";

export class InducteeJoinListener
  extends DiscordEventListener<Events.GuildMemberAdd> {

  public override readonly event = Events.GuildMemberAdd;

  public override async execute(member: GuildMember): Promise<boolean> {
    const { user, displayName } = member;
    // TODO: Proper logging.
    console.log(`User ${user.username} joined.`);

    let inducteeData = await inducteeSheetsService.getData(user.username);
    let byDisplayName = false;

    if (inducteeData === null) {
      inducteeData = await inducteeSheetsService.getData(displayName);
      if (inducteeData === null) {
        return false;
      }
      byDisplayName = true;
    }

    await member.roles.add(INDUCTEES_ROLE_ID);
    await this.notifyLogs(member, inducteeData, byDisplayName);
    return true;
  }

  private async notifyLogs(
    member: GuildMember,
    inducteeData: InducteeData,
    byDisplayName: boolean,
  ): Promise<void> {
    const preferredName = inducteeData.preferredName ?? inducteeData.legalName;

    let description = (
      `${userMention(member.id)} (${preferredName}) just joined the server ` +
      `and was given the ${roleMention(INDUCTEES_ROLE_ID)} role.`
    );

    if (byDisplayName) {
      description += (
        `\n\n${EMOJI_WARNING} Inductee was detected by display name ` +
        `(${inlineCode(member.displayName)}) instead of username. Consider ` +
        "checking that this member is indeed an inductee."
      );
    }

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
