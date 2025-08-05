import { Events, Message } from "discord.js";

import { DiscordEventListener } from "../../abc/listener.abc";
import { TextCommandHandler } from "../../abc/text-command.abc";
import { removePrefix } from "../../utils/data.utils";
import {
  REACTION_BOT_ERROR,
  REACTION_UNKNOWN_TEXT_COMMAND,
} from "../../utils/emojis.utils";
import { textCommandLoader } from "../loaders";

class MessageCreateListener extends DiscordEventListener<Events.MessageCreate> {
  public override readonly event = Events.MessageCreate;

  public override async execute(message: Message): Promise<void> {
    const { content, channel, author: caller } = message;

    if (!content.startsWith(TextCommandHandler.COMMAND_PREFIX)) {
      return;
    }

    // TODO: Forward command args and/or implement argument lexing.
    const [invocation, ..._commandArgs] = content.split(/\s+/);
    const commandName = removePrefix(
      invocation,
      TextCommandHandler.COMMAND_PREFIX,
    );

    const handler = textCommandLoader.get(commandName);
    if (handler === null) {
      await message.react(REACTION_UNKNOWN_TEXT_COMMAND);
      return;
    }

    console.log(
      `[DISPATCH] ${handler.id} by @${caller.username} in #${channel}`,
    );
    try {
      await handler.dispatch(message);
    }
    catch (error) {
      console.error(
        "[DISPATCH] Uncaught error in text command execution pipeline:",
      );
      console.error(error);
      await message.react(REACTION_BOT_ERROR);
    }
  }
}

export default new MessageCreateListener();
