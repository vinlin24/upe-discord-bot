import {
  Awaitable,
  ChatInputCommandInteraction,
  RESTPostAPIChatInputApplicationCommandsJSONBody,
} from "discord.js";

import type { SlashCommandCheck, SlashCommandCheckDetails } from "./check.abc";

export abstract class SlashCommandHandler {
  /** Slash command definition used to register it with Discord's backend. */
  public abstract readonly definition
    : RESTPostAPIChatInputApplicationCommandsJSONBody;

  /** Checks that must pass before the main command handler can run. */
  public checks: SlashCommandCheck[] = [];

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

  /** Fallback callback for if the main callback throws an `Error`. */
  public handleError(
    error: Error,
    interaction: ChatInputCommandInteraction,
  ): Awaitable<any> {
    console.error(`${error.name} in ${this.logName}:`);
    console.error(error);
  }

  /** Run full execution pipeline. */
  public async dispatch(
    interaction: ChatInputCommandInteraction,
  ): Promise<void> {
    await this.pipeline.run(interaction);
  }
}

class CommandExecutionPipeline {
  private readonly passedChecks: [
    SlashCommandCheck,
    SlashCommandCheckDetails & { pass: true },
  ][] = [];

  public constructor(private readonly handler: SlashCommandHandler) { }

  public async run(interaction: ChatInputCommandInteraction): Promise<void> {
    await this.executeChecks(interaction)
      && await this.executeMain(interaction)
      && await this.executePostHooks(interaction);
  }

  private async executeChecks(
    interaction: ChatInputCommandInteraction,
  ): Promise<boolean> {
    this.passedChecks.length = 0; // Reset.

    for (const check of this.handler.checks) {
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

  private assertErrorThrown(thrown: unknown): asserts thrown is Error {
    if (!(thrown instanceof Error)) {
      console.error(`non-Error object thrown: ${thrown}`);
      throw thrown;
    }
  }
}
