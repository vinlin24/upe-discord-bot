import {
  userMention,
  type Guild,
  type GuildTextBasedChannel,
  type Message,
} from "discord.js";

import {
  asBrandedNumber,
  type UnixSeconds,
} from "../types/branded.types";
import {
  SystemDateClient,
  UCLA_TIMEZONE,
  type IDateClient,
} from "../utils/date.utils";
import {
  OFFICER_MEMES_CHANNEL_ID,
} from "../utils/snowflakes.utils";
import channelsService from "./channels.service";

const USER = "275263271253311489";

class MealService {
  private chan: GuildTextBasedChannel | null = null;
  private streak: number = 0;

  public constructor(private readonly dateClient: IDateClient) {
  }

  public async initialize(upe: Guild): Promise<void> {
    const officerMemes = await upe.channels.fetch(OFFICER_MEMES_CHANNEL_ID);
    if (officerMemes === null || !officerMemes.isTextBased()) {
      const errorMessage = (
        `officer memes channel (ID ${OFFICER_MEMES_CHANNEL_ID}) is invalid: ` +
        `${officerMemes}`
      );
      console.error(errorMessage);
      await channelsService.sendDevError(errorMessage);
      return;
    }

    this.chan = officerMemes;

    const now = this.dateClient.getNow();
    const nextMidnight = this.getNextDinTime(now);
    const msecLeft = (nextMidnight - now) * 1000;
    // Schedule the first orz.
    setTimeout(this.sendReminder, msecLeft);
  }

  private getNextDinTime(now: UnixSeconds): UnixSeconds {
    const dateTime = this.dateClient.getDateTime(now, UCLA_TIMEZONE);
    if (!dateTime.isValid) {
      throw new Error(
        `timestamp ${now} failed to convert: ${dateTime.invalidExplanation}`,
      );
    }
    const nextDinTime = dateTime.plus({ days: 1 }).startOf("day").plus({ hours: 17 });
    return asBrandedNumber(nextDinTime.toSeconds());
  }

  private async listenForAck(message: Message) {
    const collector = message.createReactionCollector({ time: 4 * 3600 * 1000 });
    let acked = false;
    collector.on("collect", (_, user) => {
      if (user.id === USER) {
        acked = true;
        collector.stop();
      }
    });
    collector.on("end", () => {
      if (!acked) {
        this.streak = 0;
      }
      this.chan?.send(`${this.streak} day(s) without skipping dinner.`);
    });
  }

  private async sendReminder() {
    if (this.chan === null) {
      return;
    }

    try {
      const message = await this.chan.send(`${userMention(USER)}, please eat dinner. React to dismiss.`);
      this.listenForAck(message);
    }
    // This callback is outside of our standard execution pipeline, so manually
    // suppress exceptions to prevent bringing down the bot.
    catch (error) {
      console.error("failed to complete meal reminder:", error);
      if (error instanceof Error) {
        await channelsService.sendDevError(error);
      }
    }

    // Schedule next orz.
    const now = this.dateClient.getNow();
    const nextMidnight = this.getNextDinTime(now);
    const msecLeft = (nextMidnight - now) * 1000;
    setTimeout(this.sendReminder, msecLeft);
  }
}

export default new MealService(new SystemDateClient());
