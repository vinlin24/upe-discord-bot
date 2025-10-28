import { Events, Message } from "discord.js";

import { DiscordEventListener } from "../../abc/listener.abc";
import {
  REACTION_SEVEN,
  REACTION_SHRUG,
  REACTION_SIX,
} from "../../utils/emojis.utils";

class SixSevenListener extends DiscordEventListener<Events.MessageCreate> {
  public override readonly event = Events.MessageCreate;

  public override async execute(message: Message<true>): Promise<boolean> {
    // Screw it, don't even care about sevens coming after sixes. Just naively
    // look for the presence of six && presence of seven.

    const sixMatch = message.content.match(/6|six/i);
    if (sixMatch === null) {
      return false;
    }

    const sevenMatch = message.content.match(/7|seven/i);
    if (sevenMatch === null) {
      return false;
    }

    await message.react(REACTION_SIX);
    await message.react(REACTION_SEVEN);
    await message.react(REACTION_SHRUG);
    return true;
  }
}

export default new SixSevenListener();
