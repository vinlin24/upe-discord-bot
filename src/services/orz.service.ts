import {
  userMention,
  type Guild,
  type GuildTextBasedChannel,
} from "discord.js";
import { asBrandedNumber, type UnixSeconds } from "../types/branded.types";

import env from "../env";
import {
  SystemDateClient,
  UCLA_TIMEZONE,
  type IDateClient
} from "../utils/date.utils";
import { OFFICER_MEMES_CHANNEL_ID } from "../utils/snowflakes.utils";
import channelsService from "./channels.service";

class OrzService {
  public constructor(private readonly dateClient: IDateClient) { }

  public async initialize(upe: Guild): Promise<void> {
    const officerMemes = await upe.channels.fetch(OFFICER_MEMES_CHANNEL_ID);
    if (officerMemes === null || !officerMemes.isTextBased()) {
      const errorMessage = (
        `officer memes channel (ID ${OFFICER_MEMES_CHANNEL_ID}) is invalid: ` +
        `${officerMemes}`
      );
      console.warn(errorMessage);
      await channelsService.sendDevError(errorMessage);
      return;
    }

    const now = this.dateClient.getNow();
    const nextMidnight = this.getNextMidnight(now);
    const msecLeft = (nextMidnight - now) * 1000;
    // Schedule the first orz.
    setTimeout(async () => await this.sendOrz(officerMemes), msecLeft);
  }

  private getNextMidnight(now: UnixSeconds): UnixSeconds {
    const dateTime = this.dateClient.getDateTime(now, UCLA_TIMEZONE);
    if (!dateTime.isValid) {
      throw new Error(
        `timestamp ${now} failed to convert: ${dateTime.invalidExplanation}`,
      );
    }
    const nextMidnight = dateTime.plus({ days: 1 }).startOf("day");
    return asBrandedNumber(nextMidnight.toSeconds());
  }

  private async sendOrz(officerMemes: GuildTextBasedChannel): Promise<void> {
    try {
      await officerMemes.send(
        `Daily ${userMention(env.ORZ_TARGET_USER_ID)} orz`,
      );
    }
    // This callback is outside of our standard execution pipeline, so manually
    // suppress exceptions to prevent bringing down the bot.
    catch (error) {
      console.error("failed to send daily orz:", error);
      if (error instanceof Error) {
        await channelsService.sendDevError(error);
      }
    }
    // Schedule next orz.
    const ONE_DAY_MSEC = 3600 * 24 * 1000;
    setTimeout(async () => this.sendOrz(officerMemes), ONE_DAY_MSEC);
  }
}

export default new OrzService(new SystemDateClient());
