import util from "node:util";

import {
  bold,
  channelMention,
  codeBlock,
  inlineCode,
  userMention,
  type BaseInteraction,
  type Client,
  type DMChannel,
} from "discord.js";

import { MESSAGE_CHARACTER_LIMIT } from "../utils/limits.utils";
import { DEVELOPER_USER_ID } from "../utils/snowflakes.utils";

class DmService {
  private devDm: DMChannel | null = null;

  public async initialize(client: Client<true>): Promise<void> {
    const devUser = await client.users.fetch(DEVELOPER_USER_ID);
    this.devDm = devUser.dmChannel ?? await devUser.createDM();
  }

  public getDev(): DMChannel {
    if (this.devDm === null) {
      throw new Error(`developer DM channel requested before initialized`);
    }
    return this.devDm;
  }

  public async sendDevError(
    error: Error,
    context: BaseInteraction,
  ): Promise<void> {
    const commandName = context.isCommand() ? context.commandName : "";
    const sourceMention = channelMention(context.channel!.id);
    const callerMention = userMention(context.user.id);

    let contextLine = `For ${callerMention} in ${sourceMention}`;
    if (commandName) {
      contextLine += ` (${bold(inlineCode("/" + commandName))})`;
    }
    const errorLine = `${bold(error.name)}: ${error.message}`;
    const dumpLine = codeBlock(util.format(error));

    let content = [contextLine, errorLine, dumpLine].join("\n");
    if (content.length > MESSAGE_CHARACTER_LIMIT) {
      content = content.slice(0, MESSAGE_CHARACTER_LIMIT - 6) + "...```";
    }

    await this.getDev().send(content);
  }
}

export default new DmService();
