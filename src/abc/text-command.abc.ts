import type { Awaitable, Message } from "discord.js";

import channelsService from "../services/channels.service";
import { REACTION_BOT_ERROR } from "../utils/emojis.utils";
import { assertErrorThrown } from "../utils/errors.utils";

export abstract class TextCommandHandler<
  TArguments extends unknown[] = [],
  InGuild extends boolean = true,
> {
  public static readonly COMMAND_PREFIX = "!";

  /**
   * Name used to uniquely identify & invoke this command.
   *
   * A command is invoked in a Discord text channel by prefixing the name with
   * the `COMMAND_PREFIX`.
   */
  public abstract readonly name: string;

  // TODO: Add support for checks like SlashCommandHandler has.

  /** Pipeline execution engine to manage handler lifecycle. */
  private readonly pipeline
    = new TextCommandExecutionPipeline<TArguments, InGuild>(this);

  /**
   * ID to identify a handler class. Should be unique. Defaults to the command
   * prefix followed by the command name e.g. `!command-name`.
   */
  public get id(): string {
    return TextCommandHandler.COMMAND_PREFIX + this.name
  }

  /** Shorthand for formatting this handler's details, such as for logging. */
  public get logName(): string {
    return `${this.id} text command handler`
  }

  /**
   * Transform the entire text following the command invocation into the
   * properly typed argument vector.
   */
  public abstract transformArguments(corpus: string): Awaitable<TArguments>;

  /** Main callback to execute when the text command is invoked. */
  public abstract execute(
    message: Message<InGuild>,
    commandArgs: TArguments,
  ): Awaitable<any>;

  /** Fallback callback for if the main callback throws an `Error`. */
  public async handleError(
    error: Error,
    message: Message<InGuild>
  ): Promise<any> {
    console.error(`${error.name} in ${this.logName}:`);
    console.error(error);
    await channelsService.sendDevError(error, message);
    await message.react(REACTION_BOT_ERROR);
  }

  /** Run full execution pipeline for a slash command invocation. */
  public async dispatch(
    message: Message<InGuild>,
    commandArgs: TArguments,
  ): Promise<void> {
    await this.pipeline.run(message, commandArgs);
  }
}

class TextCommandExecutionPipeline<
  TArguments extends unknown[],
  InGuild extends boolean,
> {
  public constructor(
    private readonly handler: TextCommandHandler<TArguments, InGuild>,
  ) { }

  public async run(
    message: Message<InGuild>,
    commandArgs: TArguments,
  ): Promise<void> {
    try {
      await this.handler.execute(message, commandArgs);
    }
    catch (error) {
      assertErrorThrown(error);
      try {
        await this.handler.handleError(error, message);
      }
      catch (error) {
        console.error(
          `Error handler of ${this.handler.logName} threw: ${error}`,
        );
        throw error;
      }
    }
  }
}
