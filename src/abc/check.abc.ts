import type {
  Awaitable,
  ChatInputCommandInteraction,
  InteractionReplyOptions,
} from "discord.js";

import type { SlashCommandHandler } from "./command.abc";

export type SlashCommandCheckDetails<
  Payload extends Record<string, any> = Record<string, any>
> =
  | Payload & { pass: true }
  | Payload & { pass: false }
  ;

export abstract class SlashCommandCheck<
  Details extends SlashCommandCheckDetails = SlashCommandCheckDetails,
> {
  public readonly id = this.constructor.name;

  public constructor(
    protected readonly handler: SlashCommandHandler,
  ) { }

  public get logName(): string {
    return `check ${this.id} of ${this.handler.logName}`;
  }

  public abstract predicate(
    interaction: ChatInputCommandInteraction,
  ): Awaitable<Details>;

  /** Callback to run if the predicate function conveys no pass status. */
  public onFail(
    details: Details & { pass: false },
    interaction: ChatInputCommandInteraction,
  ): Awaitable<any> { }

  /** Callback to run after the main command handler completes. */
  public postHook(
    details: Details & { pass: true },
    interaction: ChatInputCommandInteraction,
  ): Awaitable<any> { }

  /** Fallback callback for if any of the callbacks throw an `Error`. */
  public handleError(
    error: Error,
    interaction: ChatInputCommandInteraction,
  ): Awaitable<any> {
    console.error(`${error.name} in ${this.logName}:`);
    console.error(error);
  }

  /**
   * Shorthand for replying to the interaction only if it has not already been
   * replied to.
   *
   * Return whether a new reply was sent.
   */
  protected async safeReply(
    interaction: ChatInputCommandInteraction,
    options: InteractionReplyOptions,
  ): Promise<boolean> {
    if (interaction.replied) {
      return false;
    }
    await interaction.reply(options);
    return true;
  }
}
