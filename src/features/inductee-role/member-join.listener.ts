import { Events, type GuildMember } from "discord.js";

import { DiscordEventListener } from "../../abc/listener.abc";
import type { UserId } from "../../types/branded.types";
import { quietHyperlink } from "../../utils/formatting.utils";
import { UPE_WEBSITE } from "../../utils/upe.utils";

class MemberJoinListener
  extends DiscordEventListener<Events.GuildMemberAdd> {

  public override readonly event = Events.GuildMemberAdd;

  public static readonly WELCOME_MESSAGE = (
    "Welcome to the Discord server for Upsilon Pi Epsilon at UCLA! " +
    "To learn more about us, visit our " +
    quietHyperlink("website", UPE_WEBSITE) + ".\n\n" +
    // TODO: Can make it so that this part of the welcome message & user ID
    // sending only activates based on some flag (either config or runtime).
    "If you're an inductee, this is your user ID to paste back into the " +
    "pre-induction questionnaire form:"
  );

  public override async execute(member: GuildMember): Promise<boolean> {
    const callerId = member.id as UserId;
    const dmChannel = member.dmChannel ?? await member.createDM();
    await dmChannel.send(MemberJoinListener.WELCOME_MESSAGE);
    await dmChannel.send(callerId);
    return true;
  }
}

export default new MemberJoinListener();
