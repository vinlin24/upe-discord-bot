import type { Awaitable, ClientEvents } from "discord.js";

import type { DiscordEventListener } from "./listener.abc";

export type DiscordEventFilterDetails<
  Payload extends Record<string, any> = Record<string, any>
> =
  | Payload & { pass: true }
  | Payload & { pass: false }
  ;

export abstract class DiscordEventFilter<
  Event extends keyof ClientEvents,
  Details extends DiscordEventFilterDetails = DiscordEventFilterDetails,
> {
  /** discord.js key for the Discord API event this listener filter is for. */
  public abstract readonly event: Event;

  /** ID to identify a filter class. Should be unique. */
  public readonly id = this.constructor.name;

  public constructor(
    /** Listener this filter acts on behalf of. */
    protected readonly listener: DiscordEventListener<Event>,
  ) { }

  /** Shorthand for formatting this filter's details, such as for logging. */
  public get logName(): string {
    return `filter ${this.id} of ${this.listener.logName}`;
  }

  /** Main callback that determines if downstream event handlers should run. */
  public abstract predicate(...args: ClientEvents[Event]): Awaitable<Details>;

  /** Callback to run if the predicate function conveys no pass status. */
  public onFail(
    details: Details & { pass: false },
    ...args: ClientEvents[Event]
  ): Awaitable<any> { }

  /** Callback to run after the main event handler completes. */
  public postHook(
    details: Details & { pass: true },
    ...args: ClientEvents[Event]
  ): Awaitable<any> { }

  /** Fallback callback for if any of the callbacks throw an `Error`. */
  public handleError(
    error: Error,
    ...args: ClientEvents[Event]
  ): Awaitable<any> {
    console.error(`${error.name} in ${this.logName}:`);
    console.error(error);
  }
}
