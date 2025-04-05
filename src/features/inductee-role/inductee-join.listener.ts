import { Events, type GuildMember } from "discord.js";

import { DiscordEventListener } from "../../abc/listener.abc";
import { INDUCTEES_ROLE_ID } from "../../utils/snowflakes.utils";
import inducteeSheetsService from "./sheets.service";

export class InducteeJoinListener
  extends DiscordEventListener<Events.GuildMemberAdd> {

  public override readonly event = Events.GuildMemberAdd;

  public override async execute(member: GuildMember): Promise<boolean> {
    const { username } = member.user;
    // TODO: Proper logging.
    console.log(`User ${username} joined.`);

    const inducteeData = await inducteeSheetsService.getData(username);
    if (inducteeData === null) {
      return false;
    }
    await member.roles.add(INDUCTEES_ROLE_ID);
    return true;
  }
}

export default new InducteeJoinListener();
