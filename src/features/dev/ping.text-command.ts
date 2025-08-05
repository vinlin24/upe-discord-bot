import { bold, codeBlock, type Client, type Message } from "discord.js";

import { TextCommandHandler } from "../../abc/text-command.abc";
import { REACTION_UNAUTHORIZED_TEXT_COMMAND } from "../../utils/emojis.utils";
import { DEVELOPER_ROLE_ID } from "../../utils/snowflakes.utils";

class PingTextCommand extends TextCommandHandler<string[]> {
  public override readonly name = "ping";

  public override async transformArguments(
    corpus: string,
    message: Message,
  ): Promise<string[] | null> {
    const tokens = corpus.split(/\s+/);
    if (tokens.some(token => token === "NONO-STRING")) {
      await message.reply("You said the nono string!");
      return null;
    }
    return tokens;
  }

  public override async execute(
    message: Message,
    commandArgs: string[],
  ): Promise<void> {
    // TODO: When checks are added to the framework, move this access control up
    // into that layer.
    if (
      message.member === null ||
      !message.member.roles.cache.has(DEVELOPER_ROLE_ID)
    ) {
      await message.react(REACTION_UNAUTHORIZED_TEXT_COMMAND);
      return;
    }

    let content = `Hello there! ${this.formatLatency(message.client)}`;

    if (commandArgs.length > 0) {
      content += `\nCalled with ${commandArgs.length} arguments:\n`;
      content += codeBlock(commandArgs.join("\n"));
    }

    await message.reply(content);
  }

  private formatLatency(client: Client): string {
    const latency = client.ws.ping;
    if (latency === -1) {
      return "Latency: (still being calculated...)";
    }
    return `Latency: ${bold(latency.toString())} ms`;
  }
}

export default new PingTextCommand();
