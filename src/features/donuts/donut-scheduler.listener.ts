import { Events, type Client } from "discord.js";

import { DiscordEventListener } from "../../abc/listener.abc";
import donutService from "./donut.service";

const POLL_INTERVAL_MSEC = 60 * 1000;

class DonutSchedulerListener extends DiscordEventListener<Events.ClientReady> {
  public override readonly event = Events.ClientReady;
  public override readonly once = true;

  public override async execute(client: Client<true>): Promise<void> {
    setInterval(() => {
      donutService.runDueChats(client).catch((error) => {
        console.error("[DONUT] scheduler poll failed:", error);
      });
      donutService.runDueCheckIns(client).catch((error) => {
        console.error("[DONUT] check-in poll failed:", error);
      });
    }, POLL_INTERVAL_MSEC);
    console.log(
      `[DONUT] scheduler started, polling every ${POLL_INTERVAL_MSEC}ms`,
    );
  }
}

export default new DonutSchedulerListener();
