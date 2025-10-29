import { Events, Message } from "discord.js";

import { DiscordEventListener } from "../../abc/listener.abc";
import {
  REACTION_SEVEN,
  REACTION_SHRUG,
  REACTION_SIX,
} from "../../utils/emojis.utils";

import { Milliseconds } from "../../types/branded.types";

function sleep(ms: Milliseconds): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

class SixSevenListener extends DiscordEventListener<Events.MessageCreate> {
  public override readonly event = Events.MessageCreate;

  public override async execute(message: Message<true>): Promise<boolean> {
    // Strictly looks for the funny patterns to avoid accidental trigger.

    const messageNoId = message.content.replace(/<(?:@|#|@&)\d+>/g, "");

    const sixSevenMatch = messageNoId.match(/\D(?:6|six)\s*(?:7|seven)\D/i);
    if (sixSevenMatch === null) {
      return false;
    }

    await message.react(REACTION_SIX);
    await sleep(200 as Milliseconds);
    await message.react(REACTION_SEVEN);
    await sleep(200 as Milliseconds);
    await message.react(REACTION_SHRUG);
    return true;
  }
}

export default new SixSevenListener();
