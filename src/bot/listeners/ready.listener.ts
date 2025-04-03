import { Events, type Client } from "discord.js";

import { DiscordEventListener } from "../../abc/listener.abc";

class ReadyListener extends DiscordEventListener<Events.ClientReady> {
  public override readonly event = Events.ClientReady;
  public override readonly once = true;

  public override async execute(client: Client<true>): Promise<void> {
    console.log(`Client is ready! Logged in as ${client.user.username}.`);
  }
}

export default new ReadyListener();
