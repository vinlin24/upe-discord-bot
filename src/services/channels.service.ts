import util from "node:util";

import {
  bold,
  channelMention,
  codeBlock,
  inlineCode,
  PermissionFlagsBits,
  userMention,
  type BaseInteraction,
  type Client,
  type DMChannel,
  type Guild,
  type GuildTextBasedChannel,
  type MessageCreateOptions,
  type MessagePayload,
} from "discord.js";

import { MESSAGE_CHARACTER_LIMIT } from "../utils/limits.utils";
import {
  BOT_LOGS_CHANNEL_ID,
  DEVELOPER_ROLE_ID,
  UPE_GUILD_ID,
} from "../utils/snowflakes.utils";

class ChannelService {
  private client: Client<true> | null = null;
  private upe: Guild | null = null;

  private devDms: DMChannel[] = [];
  private logsChannel: GuildTextBasedChannel | null = null;

  public async initialize(client: Client<true>): Promise<void> {
    this.client = client;

    // TODO: Maybe implement some kind of "startup hook" system where services
    // can sanity check they can meet their requirements and reliably crash the
    // bot if not instead of waiting for an error to pop up deep in runtime.

    this.upe = await client.guilds.fetch(UPE_GUILD_ID);

    const developerRole = await this.upe.roles.fetch(DEVELOPER_ROLE_ID);
    if (developerRole === null) {
      return;
    }

    for (const developer of developerRole.members.values()) {
      const dmChannel = developer.dmChannel ?? await developer.createDM();
      this.devDms.push(dmChannel);
    }

    await this.initLogsChannel();
  }

  public getLogSink(): GuildTextBasedChannel | null {
    // Try to prevent a permissions error if we can help it.
    if (this.logsChannel !== null && !this.canSendMessages(this.logsChannel)) {
      console.error(
        `bot cannot send messages in logs channel: ${this.logsChannel}`,
      );
      return null;
    }
    return this.logsChannel;
  }

  public async sendDev(
    options: string | MessagePayload | MessageCreateOptions,
  ): Promise<void> {
    for (const dmChannel of this.devDms) {
      try {
        await dmChannel.send(options);
      }
      // Don't force the caller to add yet another layer to their error handling.
      catch (error) {
        console.error(
          `FAILED TO SEND DEV MESSAGE TO ${dmChannel.recipient}:`,
          error,
        );
      }
    }
  }

  public async sendDevError(
    error: Error | string | unknown,
    context?: BaseInteraction,
  ): Promise<void> {
    try {
      await this.unsafeSendDevError(error, context);
    }
    // Don't force the caller to add yet another layer to their error handling.
    catch (error) {
      console.error("FAILED TO SEND DEV ERROR:", error);
    }
  }

  private async unsafeSendDevError(
    error: Error | string | unknown,
    context?: BaseInteraction,
  ): Promise<void> {
    let contextLine = "";

    if (context !== undefined) {
      const commandName = context.isCommand() ? context.commandName : "";
      const sourceMention = channelMention(context.channel!.id);
      const callerMention = userMention(context.user.id);

      contextLine = `For ${callerMention} in ${sourceMention}`;
      if (commandName) {
        contextLine += ` (${bold(inlineCode("/" + commandName))})`;
      }
    }

    let errorLine: string;
    let dumpLine = "";

    if (error instanceof Error) {
      errorLine = `${bold(error.name)}: ${error.message}`;
      dumpLine = codeBlock(util.format(error));
    }
    else if (typeof error === 'string') {
      errorLine = error;
    }
    else {
      errorLine = `${bold("Some non-Error thrown:")} ${error}`;
    }

    let content = [contextLine, errorLine, dumpLine].filter(Boolean).join("\n");
    if (content.length > MESSAGE_CHARACTER_LIMIT) {
      content = content.slice(0, MESSAGE_CHARACTER_LIMIT - 6) + "...```";
    }

    await this.sendDev(content);
  }

  private async initLogsChannel(): Promise<void> {
    const logsChannel = await this.getUpe().channels.fetch(BOT_LOGS_CHANNEL_ID);

    if (logsChannel === null) {
      const errorMessage = (
        `Logs channel (ID=${inlineCode(BOT_LOGS_CHANNEL_ID)}) not found!`
      );
      console.error(errorMessage);
      await this.sendDevError(errorMessage);
      return;
    }

    if (!logsChannel.isTextBased()) {
      const errorMessage = (
        `Logs channel ${channelMention(BOT_LOGS_CHANNEL_ID)} does not seem ` +
        "to be a valid text channel I can send messages to!"
      );
      console.error(errorMessage);
      await this.sendDevError(errorMessage);
      return;
    }

    this.logsChannel = logsChannel;
  }

  public getUpe(): Guild {
    if (this.upe === null) {
      throw new Error("UPE guild requested before initialized");
    }
    return this.upe;
  }

  private getClient(): Client<true> {
    if (this.client === null) {
      throw new Error("bot client requested before initialized");
    }
    return this.client;
  }

  private canSendMessages(channel: GuildTextBasedChannel): boolean {
    return !!channel
      .permissionsFor(this.getClient().user)
      ?.has(PermissionFlagsBits.SendMessages)
  }
}

export default new ChannelService();
