import fs from "node:fs";
import path from "node:path";

import { Collection } from "discord.js";

import { SlashCommandHandler } from "../abc/command.abc";
import { DiscordEventListener } from "../abc/listener.abc";
import type { Path } from "../types/branded.types";

abstract class HandlerLoader<Handler> {
  protected readonly handlers
    = new Collection<string, readonly [Handler, Path]>();

  protected constructor(
    private readonly handlerClass: abstract new () => Handler,
  ) { }

  public async load(modulePath: Path): Promise<Handler> {
    const { default: handler } = await this.dynamicRequire(modulePath);
    if (!(handler instanceof this.handlerClass)) {
      throw new Error(
        `${modulePath} does not default-export a valid handler object ` +
        `(expected instance of ${this.handlerClass})`,
      );
    }
    this.handlers.set(this.getHandlerName(handler), [handler, modulePath]);
    return handler;
  }

  public async loadAll(moduleRoot: Path): Promise<Collection<string, Handler>> {
    for (const path of this.discoverPaths(moduleRoot)) {
      await this.load(path);
    }
    return this.getAll();
  }

  public get(name: string): Handler | null {
    const tuple = this.handlers.get(name)
    return tuple ? tuple[0] : null;
  }

  public getAll(): Collection<string, Handler> {
    return this.handlers.mapValues(([handler,]) => handler);
  }

  public reset(): void {
    this.handlers.clear();
  }

  public unload(name: string): boolean {
    return this.handlers.delete(name);
  }

  public async reload(name: string): Promise<boolean> {
    const tuple = this.handlers.get(name);
    if (tuple === undefined) {
      return false;
    }
    await this.load(tuple[1]);
    return true;
  }

  protected abstract getHandlerName(handler: Handler): string;

  protected abstract isHandlerFile(path: Path): boolean;

  private *discoverPaths(directory: Path): Generator<Path> {
    const contents = fs.readdirSync(directory) as Path[];

    for (const file of contents) {
      const fullPath = path.join(directory, file) as Path;

      // Recursive case.
      if (fs.lstatSync(fullPath).isDirectory()) {
        yield* this.discoverPaths(fullPath);
        continue;
      }

      // Base case.
      if (this.isHandlerFile(file)) {
        yield fullPath;
        continue;
      }
    }
  }

  /**
   * Similar to `require()`, but using the most updated version of the module
   * instead of the cached copy.
   */
  private async dynamicRequire<
    ModuleType extends { default: unknown } = { default: unknown },
  >(modulePath: string): Promise<ModuleType> {
    // Remove the module from the cache.
    delete require.cache[require.resolve(modulePath)];

    // Use dynamic import to get the updated version.
    return await import(modulePath);
  }
}

class CommandLoader extends HandlerLoader<SlashCommandHandler> {
  public constructor() {
    super(SlashCommandHandler);
  }

  protected override getHandlerName(handler: SlashCommandHandler): string {
    return handler.definition.name;
  }

  protected override isHandlerFile(path: Path): boolean {
    return path.endsWith(".command.js") || path.endsWith(".command.ts");
  }
}

export const commandLoader = new CommandLoader();

class ListenerLoader extends HandlerLoader<DiscordEventListener<any>> {
  public constructor() {
    super(DiscordEventListener);
  }

  protected override getHandlerName(
    handler: DiscordEventListener<any>,
  ): string {
    return handler.id;
  }

  protected override isHandlerFile(path: Path): boolean {
    return path.endsWith(".listener.js") || path.endsWith(".listener.ts");
  }
}

export const listenerLoader = new ListenerLoader();
