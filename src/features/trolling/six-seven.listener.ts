import { Events, Message } from "discord.js";

import { DiscordEventListener } from "../../abc/listener.abc";
import {
  REACTION_SEVEN,
  REACTION_SHRUG,
  REACTION_SIX,
} from "../../utils/emojis.utils";

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

class SixSevenListener extends DiscordEventListener<Events.MessageCreate> {
  public override readonly event = Events.MessageCreate;

  public override async execute(message: Message<true>): Promise<boolean> {
    // Strictly looks for the funny patterns to avoid accidental trigger.

    const sixSevenMatch = message.content.match(/6 ?7|six ?seven/i);
    if (sixSevenMatch === null) {
      return false;
    }

    await message.react(REACTION_SIX);
    await sleep(200);
    await message.react(REACTION_SEVEN);
    await sleep(200);
    await message.react(REACTION_SHRUG);
    return true;
  }
}

export default new SixSevenListener();
