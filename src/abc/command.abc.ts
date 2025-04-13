import {
  Awaitable,
  ChatInputCommandInteraction,
  RESTPostAPIChatInputApplicationCommandsJSONBody,
  type AutocompleteInteraction,
  type GuildMember,
  type MessageComponentInteraction,
} from "discord.js";

import {
  highestPrivilege,
  Privilege,
} from "../middleware/privilege.middleware";
import channelsService from "../services/channels.service";
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

  /** Callback to execute when autocomplete on this command is triggered. */
  public autocomplete(
    interaction: AutocompleteInteraction,
  ): Awaitable<any> { }

  /** Fallback callback for if the main callback throws an `Error`. */
  public async handleError(
    error: Error,
    interaction: ChatInputCommandInteraction,
  ): Promise<any> {
    console.error(`${error.name} in ${this.logName}:`);
    console.error(error);

    await channelsService.sendDevError(error, interaction);

    const embed = makeErrorEmbed(
      "There was an error while executing this command! " +
      "Developers have been notified",
    );
    if (interaction.replied) {
      const response = await interaction.fetchReply();
      await interaction.editReply({ embeds: [...response.embeds, embed] });
    }
    else {
      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
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
    await channelsService.sendDevError(error, interaction);
  }

  /** Fallback callback for if the autocomplete handler throws an `Error`. */
  public async handleAutocompleteError(
    error: Error,
    interaction: AutocompleteInteraction,
  ): Promise<any> {
    console.error(`${error.name} in ${this.logName} autocomplete handler:`);
    console.error(error);
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

  /** Run full execution pipeline for an autocomplete event. */
  public async dispatchAutocomplete(
    interaction: AutocompleteInteraction,
  ): Promise<void> {
    await this.pipeline.runAutocomplete(interaction);
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

  public async runAutocomplete(
    interaction: AutocompleteInteraction,
  ): Promise<void> {
    await this.executeAutocomplete(interaction);
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

  private async executeAutocomplete(
    interaction: AutocompleteInteraction,
  ): Promise<void> {
    try {
      await this.handler.autocomplete(interaction);
    }
    catch (error) {
      this.assertErrorThrown(error);
      try {
        await this.handler.handleAutocompleteError(error, interaction);
      }
      catch (error) {
        console.error(
          `Error handler of ${this.handler.logName} ` +
          `autocomplete threw: ${error}`,
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
