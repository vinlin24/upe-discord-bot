import {
  Awaitable,
  ChatInputCommandInteraction,
  RESTPostAPIChatInputApplicationCommandsJSONBody,
  type GuildMember,
  type MessageComponentInteraction,
} from "discord.js";

import { highestPrivilege, Privilege } from "../middleware/privilege.middleware";
import dmService from "../services/dm.service";
import { makeErrorEmbed } from "../utils/errors.utils";
import type { SlashCommandCheck, SlashCommandCheckDetails } from "./check.abc";

export abstract class SlashCommandHandler {
  /** Slash command definition used to register it with Discord's backend. */
  public abstract readonly definition
    : RESTPostAPIChatInputApplicationCommandsJSONBody;

  /** Checks that must pass before the main command handler can run. */
  public checks: SlashCommandCheck[] = [];

  /** Custom IDs of any message components to subscribe to. */
  public componentIds: string[] = [];

  /** Pipeline execution engine to manage handler lifecycle. */
  private readonly pipeline = new CommandExecutionPipeline(this);

  /**
   * ID to identify a handler class. Should be unique. Defaults to the slash
   * command name, including leading slash e.g. `/command-name`.
   */
  public get id(): string {
    return `/${this.definition.name}`;
  }

  /** Shorthand for formatting this handler's details, such as for logging. */
  public get logName(): string {
    return `${this.id} slash command handler`;
  }

  /** Main callback to execute when the slash command is invoked. */
  public abstract execute(
    interaction: ChatInputCommandInteraction,
  ): Awaitable<any>;

  /** Callback to execute on message component interactions subscribed to. */
  public onComponent(
    interaction: MessageComponentInteraction,
  ): Awaitable<any> { }

  /** Fallback callback for if the main callback throws an `Error`. */
  public async handleError(
    error: Error,
    interaction: ChatInputCommandInteraction,
  ): Promise<any> {
    console.error(`${error.name} in ${this.logName}:`);
    console.error(error);
    await dmService.sendDevError(error, interaction);
  }

  /** Fallback callback for if the component handler throws an `Error`. */
  public async handleComponentError(
    error: Error,
    interaction: MessageComponentInteraction,
  ): Promise<any> {
    console.error(
      `${error.name} in ${this.logName} component ${interaction.customId}:`,
    );
    console.error(error);
    await dmService.sendDevError(error, interaction);
  }

  /** Run full execution pipeline for a slash command invocation. */
  public async dispatch(
    interaction: ChatInputCommandInteraction,
  ): Promise<void> {
    await this.pipeline.run(interaction);
  }

  /** Run full execution pipeline for a message component interaction event. */
  public async dispatchComponent(
    interaction: MessageComponentInteraction,
  ): Promise<void> {
    await this.pipeline.runComponent(interaction);
  }

  /** Allow callers of developer privilege to bypass checks. */
  public setDevBypass(state: boolean): void {
    this.pipeline.devBypass = state;
  }

  /** Shorthand for replying ephemerally with an embed-wrapped message. */
  protected async replyError(
    interaction: ChatInputCommandInteraction,
    message: string,
  ): Promise<void> {
    await interaction.reply({
      embeds: [makeErrorEmbed(message)],
      ephemeral: true,
    });
  }
}

class CommandExecutionPipeline {
  private readonly passedChecks: [
    SlashCommandCheck,
    SlashCommandCheckDetails & { pass: true },
  ][] = [];

  public devBypass: boolean = false;

  public constructor(private readonly handler: SlashCommandHandler) { }

  public async run(interaction: ChatInputCommandInteraction): Promise<void> {
    await this.executeChecks(interaction)
      && await this.executeMain(interaction)
      && await this.executePostHooks(interaction);
  }

  public async runComponent(
    interaction: MessageComponentInteraction,
  ): Promise<void> {
    await this.executeComponent(interaction);
  }

  private async executeChecks(
    interaction: ChatInputCommandInteraction,
  ): Promise<boolean> {
    this.passedChecks.length = 0; // Reset.

    const member = interaction.member as GuildMember;

    for (const check of this.handler.checks) {
      if (this.devBypass && highestPrivilege(member) >= Privilege.Developer) {
        console.log(
          `[CHECK] /${interaction.commandName} checks bypassed ` +
          `for developer @${member.user.username}`,
        );
        return true;
      }

      try {
        const details = await check.predicate(interaction);
        if (!details.pass) {
          await check.onFail(details, interaction);
          return false;
        }
        this.passedChecks.push([check, details]);
      }
      catch (error) {
        this.assertErrorThrown(error);
        try {
          await check.handleError(error, interaction);
        }
        catch (error) {
          console.error(`Error handler of ${check.logName} threw: ${error}`);
          throw error;
        }
      }
    }
    return true;
  }

  private async executeMain(
    interaction: ChatInputCommandInteraction,
  ): Promise<boolean> {
    try {
      await this.handler.execute(interaction);
      return true;
    }
    catch (error) {
      this.assertErrorThrown(error);
      try {
        await this.handler.handleError(error, interaction);
      }
      catch (error) {
        console.error(
          `Error handler of ${this.handler.logName} threw: ${error}`,
        );
        throw error;
      }
    }
    return false;
  }

  private async executePostHooks(
    interaction: ChatInputCommandInteraction,
  ): Promise<void> {
    for (const [filter, details] of this.passedChecks) {
      try {
        await filter.postHook(details, interaction);
      }
      catch (error) {
        this.assertErrorThrown(error);
        try {
          await filter.handleError(error, interaction);
        }
        catch (error) {
          console.error(`Error handler of ${filter.logName} threw: ${error}`);
          throw error;
        }
      }
    }
  }

  private async executeComponent(
    interaction: MessageComponentInteraction,
  ): Promise<void> {
    try {
      await this.handler.onComponent(interaction);
    }
    catch (error) {
      this.assertErrorThrown(error);
      try {
        await this.handler.handleComponentError(error, interaction);
      }
      catch (error) {
        console.error(
          `Error handler of ${this.handler.logName} component ` +
          `${interaction.customId} threw: ${error}`,
        )
        throw error;
      }
    }
  }

  private assertErrorThrown(thrown: unknown): asserts thrown is Error {
    if (!(thrown instanceof Error)) {
      console.error(`non-Error object thrown: ${thrown}`);
      throw thrown;
    }
  }
}
