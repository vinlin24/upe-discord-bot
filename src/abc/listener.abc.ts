import type { Awaitable, Client, ClientEvents } from "discord.js";

import type {
  DiscordEventFilter,
  DiscordEventFilterDetails,
} from "./filter.abc";

export abstract class DiscordEventListener<Event extends keyof ClientEvents> {
  /** discord.js key for the Discord API event this listener is for. */
  public abstract readonly event: Event;

  /** Whether this listener should fire only once. */
  public readonly once: boolean = false;

  /** ID to identify a listener class. Should be unique. */
  public readonly id: string = this.constructor.name;

  /** Filters that must pass before the main event handler can run. */
  public filters: DiscordEventFilter<Event>[] = [];

  /** Pipeline execution engine to manage handler lifecycle. */
  private readonly pipeline: ListenerExecutionPipeline<Event>
    = new ListenerExecutionPipeline(this);

  /** Shorthand for formatting this listener's details, such as for logging. */
  public get logName(): string {
    return `${this.event} listener ${this.id}`;
  }

  /** Main callback to execute when the listener's event is emitted. */
  public abstract execute(...args: ClientEvents[Event]): Awaitable<any>;

  /** Fallback callback for if the main callback throws an `Error`. */
  public handleError(
    error: Error,
    ...args: ClientEvents[Event]
  ): Awaitable<any> {
    console.error(`${error.name} in ${this.logName}:`);
    console.error(error);
  }

  /** Register this listener on a Discord bot client, the event emitter. */
  public register(client: Client): void {
    const executor = this.pipeline.run.bind(this.pipeline);
    if (this.once) {
      client.once(this.event, executor);
    }
    else {
      client.on(this.event, executor);
    }
    console.log(`Registered ${this.logName}.`);
  }
}

class ListenerExecutionPipeline<Event extends keyof ClientEvents> {
  private readonly passedFilters: [
    DiscordEventFilter<Event>,
    DiscordEventFilterDetails & { pass: true },
  ][] = [];

  public constructor(
    private readonly listener: DiscordEventListener<Event>,
  ) { }

  public async run(...args: ClientEvents[Event]): Promise<void> {
    await this.executeFilters(...args)
      && await this.executeMain(...args)
      && await this.executePostHooks(...args);
  }

  private async executeFilters(...args: ClientEvents[Event]): Promise<boolean> {
    this.passedFilters.length = 0; // Reset.

    for (const filter of this.listener.filters) {
      try {
        const details = await filter.predicate(...args);
        if (!details.pass) {
          await filter.onFail(details, ...args);
          return false;
        }
        this.passedFilters.push([filter, details]);
      }
      catch (error) {
        this.assertErrorThrown(error);
        try {
          await filter.handleError(error, ...args);
        }
        catch (error) {
          console.error(`Error handler of ${filter.logName} threw: ${error}`);
          throw error;
        }
      }
    }
    return true;
  }

  private async executeMain(
    ...args: ClientEvents[Event]
  ): Promise<boolean> {
    try {
      await this.listener.execute(...args);
      return true;
    }
    catch (error) {
      this.assertErrorThrown(error);
      try {
        await this.listener.handleError(error, ...args);
      }
      catch (error) {
        console.error(
          `Error handler of ${this.listener.logName} threw: ${error}`,
        );
        throw error;
      }
    }
    return false;
  }

  private async executePostHooks(...args: ClientEvents[Event]): Promise<void> {
    for (const [filter, details] of this.passedFilters) {
      try {
        await filter.postHook(details, ...args);
      }
      catch (error) {
        this.assertErrorThrown(error);
        try {
          await filter.handleError(error, ...args);
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
