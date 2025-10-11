import {
  bold,
  userMention,
  type Guild,
  type GuildTextBasedChannel,
  type Role,
} from "discord.js";
import _ from "lodash";

import { OrzeeModel } from "../models/orzee.model";
import {
  asBrandedNumber,
  type UnixSeconds,
  type UserId,
} from "../types/branded.types";
import { isNonEmptyArray } from "../types/generic.types";
import { setDifference } from "../utils/data.utils";
import {
  SystemDateClient,
  UCLA_TIMEZONE,
  type IDateClient,
} from "../utils/date.utils";
import {
  OFFICER_MEMES_CHANNEL_ID,
  OFFICERS_ROLE_ID,
} from "../utils/snowflakes.utils";
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
      console.error(errorMessage);
      await channelsService.sendDevError(errorMessage);
      return;
    }

    const officersRole = await upe.roles.fetch(OFFICERS_ROLE_ID);
    if (officersRole === null) {
      const errorMessage = (
        `failed to get officers role (ID: ${OFFICERS_ROLE_ID})`
      );
      console.error(errorMessage);
      await channelsService.sendDevError(errorMessage);
      return;
    }

    const now = this.dateClient.getNow();
    const nextMidnight = this.getNextMidnight(now);
    const msecLeft = (nextMidnight - now) * 1000;
    // Schedule the first orz.
    setTimeout(
      async () => await this.sendOrz(officerMemes, officersRole),
      msecLeft,
    );
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

  private async sendOrz(
    officerMemes: GuildTextBasedChannel,
    officersRole: Role,
  ): Promise<void> {
    try {
      const orzee = await this.getNextOrzee(officersRole);
      await officerMemes.send(this.formatOrzMessage(orzee));
    }
    // This callback is outside of our standard execution pipeline, so manually
    // suppress exceptions to prevent bringing down the bot.
    catch (error) {
      console.error("failed to complete daily orz:", error);
      if (error instanceof Error) {
        await channelsService.sendDevError(error);
      }
    }
    // Schedule next orz.
    const ONE_DAY_MSEC = 3600 * 24 * 1000;
    setTimeout(
      async () => this.sendOrz(officerMemes, officersRole),
      ONE_DAY_MSEC,
    );
  }

  private async getNextOrzee(officersRole: Role): Promise<UserId> {
    const alreadyOrzed = await OrzeeModel.find();
    // "whitelist" is all officers. "blacklist" is officers that have already
    // been orzed. We want to choose from officers that haven't been orzed yet.
    const blacklist = new Set(alreadyOrzed.map(orzee => orzee.userId));
    const whitelist = new Set(
      officersRole.members.map((_, userId) => userId as UserId),
    );
    const candidates = Array.from(setDifference(whitelist, blacklist));

    if (isNonEmptyArray(candidates)) {
      const orzee = _.sample(candidates);
      await this.blacklistOrzee(orzee);
      return orzee;
    }

    // Everyone's been orzed. Reset the orzee set.
    await OrzeeModel.deleteMany();
    const orzee = _.sample(Array.from(whitelist));
    if (orzee === undefined) {
      throw new Error("no officers found to orz");
    }
    await this.blacklistOrzee(orzee);
    return orzee;
  }

  private async blacklistOrzee(userId: UserId): Promise<void> {
    await OrzeeModel.create({ userId, chosen: this.dateClient.getNow() });
  }

  private formatOrzMessage(orzee: UserId): string {
    return (
      `${userMention(orzee)}, you've been chosen for the daily ${bold("orz")}!`
    );
  }
}

export default new OrzService(new SystemDateClient());
