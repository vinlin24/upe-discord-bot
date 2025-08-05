import { Events, Message } from "discord.js";

import { DiscordEventListener } from "../../abc/listener.abc";
import { TextCommandHandler } from "../../abc/text-command.abc";
import { isSpace, removePrefix } from "../../utils/data.utils";
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

    const [commandName, corpus] = this.splitInvocation(content);

    const handler = textCommandLoader.get(commandName);
    if (handler === null) {
      await message.react(REACTION_UNKNOWN_TEXT_COMMAND);
      return;
    }

    console.log(
      `[TRANSFORM] ${handler.id} by @${caller.username} in #${channel}`,
    );
    let commandArgs: unknown[];
    try {
      commandArgs = await handler.transformArguments(corpus);
    }
    catch (error) {
      console.error(
        "[TRANSFORM] Uncaught error in text command " +
        "argument transformation callback:",
      );
      console.error(error);
      await message.react(REACTION_BOT_ERROR);
      return;
    }

    console.log(
      `[DISPATCH] ${handler.id} by @${caller.username} in #${channel}`,
    );
    try {
      await handler.dispatch(message, commandArgs);
    }
    catch (error) {
      console.error(
        "[DISPATCH] Uncaught error in text command execution pipeline:",
      );
      console.error(error);
      await message.react(REACTION_BOT_ERROR);
    }
  }

  /**
   * Split the message content into the command name (the command invocation
   * without the command prefix) and the trimmed rest-of-string (to be
   * transformed into command arguments).
   */
  private splitInvocation(
    content: string,
  ): [commandName: string, corpus: string] {
    let splitIndex = 0;
    while (splitIndex < content.length && !isSpace(content[splitIndex])) {
      splitIndex++;
    }
    const commandInvocation = content.slice(0, splitIndex);
    const commandName = removePrefix(
      commandInvocation,
      TextCommandHandler.COMMAND_PREFIX,
    );
    const restOfContent = content.slice(splitIndex).trim();
    return [commandName, restOfContent];
  }
}

export default new MessageCreateListener();
