import { Client, GatewayIntentBits } from "discord.js";
import mongoose from "mongoose";

import type { DiscordEventListener } from "../abc/listener.abc";
import type { Path } from "../types/branded.types";
import interactionDispatchListener from "./listeners/interaction-dispatch.listener";
import readyListener from "./listeners/ready.listener";
import { commandLoader, listenerLoader } from "./loaders";

export type ClientManagerOptions = {
  commandsRoot: Path;
  listenersRoot: Path;
  databaseConnectionString: string;
  databaseName: string;
};

/**
 * Manager class to abstract the initialization & de-initialization routines of
 * our bot client.
 */
export class ClientManager {
  public static readonly CLIENT_INTENTS = [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildPresences,
  ] as const satisfies readonly GatewayIntentBits[];

  public static readonly INITIAL_LISTENERS = [
    readyListener,
    interactionDispatchListener,
  ] as const satisfies readonly DiscordEventListener<any>[];

  private readonly client = new Client({
    intents: ClientManager.CLIENT_INTENTS,
  });
  private initialized = false;

  public constructor(private readonly options: ClientManagerOptions) { }

  public async initialize(): Promise<Client> {
    if (this.initialized) {
      return this.client;
    }

    this.registerInitialListeners();
    await this.registerHandlers();
    await this.initializeDatabase();

    this.initialized = true;
    return this.client;
  }

  public async cleanUp(): Promise<void> {
    this.cleanUpClient();
    await this.cleanUpDatabase();
  }

  private registerInitialListeners(): void {
    for (const listener of ClientManager.INITIAL_LISTENERS) {
      listener.register(this.client);
    }
  }

  private async registerHandlers(): Promise<void> {
    const commands = await commandLoader.loadAll(this.options.commandsRoot);
    console.log(
      `[INIT] Discovered & loaded ${commands.size} command handlers.`,
    );

    const listeners = await listenerLoader.loadAll(this.options.listenersRoot);
    for (const listener of listeners.values()) {
      listener.register(this.client);
    }
    console.log(
      `[INIT] Discovered, loaded, and registered ${listeners.size} ` +
      "event listeners.",
    );
  }

  private async initializeDatabase(): Promise<void> {
    await mongoose.connect(this.options.databaseConnectionString, {
      dbName: this.options.databaseName,
    });
    console.log(`[INIT] Connected to database ${this.options.databaseName}.`);
  }

  private cleanUpClient(): void {
    this.client.destroy();
    console.log("[DEINIT] Destroyed client instance.");
  }

  private async cleanUpDatabase(): Promise<void> {
    await mongoose.connection.close();
    console.log("[DEINIT] Closed database connection.");
  }
}
