import { ClientManager } from "./bot/client";
import env from "./env";
import { PROJECT_FEATURES_ROOT } from "./utils/paths.utils";

async function main(): Promise<void> {
  const clientManager = new ClientManager({
    commandsRoot: PROJECT_FEATURES_ROOT,
    listenersRoot: PROJECT_FEATURES_ROOT,
    textCommandsRoot: PROJECT_FEATURES_ROOT,
    databaseConnectionString: env.DB_CONNECTION_STRING,
    databaseName: env.DB_NAME,
    botToken: env.BOT_TOKEN,
    applicationId: env.APPLICATION_ID,
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

  client.login(env.BOT_TOKEN);
}

main();
