import { configDotenv } from "dotenv";

import { ClientManager } from "./bot/client";
import { PROJECT_FEATURES_ROOT } from "./utils/paths.utils";

configDotenv();

async function main(): Promise<void> {
  const clientManager = new ClientManager({
    commandsRoot: PROJECT_FEATURES_ROOT,
    listenersRoot: PROJECT_FEATURES_ROOT,
    databaseConnectionString: process.env.DB_CONNECTION_STRING,
    databaseName: process.env.SEASON_ID,
    botToken: process.env.BOT_TOKEN,
    applicationId: process.env.APPLICATION_ID,
  });

  if (process.argv.includes("--sync")) {
    console.warn("[SYNC] Only deploying commands. Bot will not log in.");
    await clientManager.deployCommands();
    return;
  }

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
