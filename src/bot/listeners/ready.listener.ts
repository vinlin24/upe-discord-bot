import { ActivityType, Events, type Client } from "discord.js";

import { DiscordEventListener } from "../../abc/listener.abc";
import helpCommand from "../../features/convenience/help.command";
import channelsService from "../../services/channels.service";
import { SystemDateClient, type IDateClient } from "../../utils/date.utils";
import { timestampPair } from "../../utils/formatting.utils";

class ReadyListener extends DiscordEventListener<Events.ClientReady> {
  public override readonly event = Events.ClientReady;
  public override readonly once = true;

  public constructor(private readonly dateClient: IDateClient) { super(); }

  public override async execute(client: Client<true>): Promise<void> {
    const now = this.dateClient.getNow();

    console.log(
      `[READY] Client is ready! Logged in as ${client.user.username}.`,
    );

    await channelsService.initialize(client);

    const [timeMention, relativeMention] = timestampPair(now);
    await channelsService.sendDev(
      `Bot has logged in at ${timeMention} (${relativeMention}).`,
    );

    await client.user.setActivity({
      type: ActivityType.Listening,
      name: helpCommand.id,
    });
  }
}

export default new ReadyListener(new SystemDateClient());
