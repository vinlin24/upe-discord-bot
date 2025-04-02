import path from "node:path";

import { configDotenv } from "dotenv";

import { ClientManager } from "./bot/client";
import type { Path } from "./types/branded.types";

configDotenv();

const HANDLERS_ROOT = path.join(__dirname, "features") as Path;

async function main(): Promise<void> {
  const clientManager = new ClientManager({
    commandsRoot: HANDLERS_ROOT,
    listenersRoot: HANDLERS_ROOT,
    databaseConnectionString: process.env.DB_CONNECTION_STRING,
    databaseName: process.env.DB_NAME,
  });

  const client = await clientManager.initialize();

  process.on("exit", async () => await clientManager.cleanUp());
  process.on("SIGINT", async () => {
    console.warn("[EXIT] Caught interrupt signal.");
    await clientManager.cleanUp();
    process.exit(0);
  });

  client.login(process.env.BOT_TOKEN);
}

main();
