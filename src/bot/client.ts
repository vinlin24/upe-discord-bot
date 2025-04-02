import { Client, GatewayIntentBits } from "discord.js";
import interactionDispatchListener from "./listeners/interaction-dispatch.listener";
import readyListener from "./listeners/ready.listener";

export const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildPresences,
  ],
});

readyListener.register(client);
interactionDispatchListener.register(client);
