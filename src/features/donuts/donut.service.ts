import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  Colors,
  EmbedBuilder,
  ThreadAutoArchiveDuration,
  userMention,
  type AnyThreadChannel,
  type Client,
} from "discord.js";
import { DateTime } from "luxon";

import { DonutStateModel, type DonutState } from "../../models/donut.model";
import channelsService from "../../services/channels.service";
import type {
  ChannelId,
  GuildId,
  Milliseconds,
  UserId,
} from "../../types/branded.types";
import {
  SystemDateClient,
  UCLA_TIMEZONE,
  type IDateClient,
} from "../../utils/date.utils";
import {
  DONUT_CHANNEL_ID,
  UPE_GUILD_ID,
} from "../../utils/snowflakes.utils";

export const DONUT_CHATTED_BUTTON_ID = "donut:chatted";

const CHECK_IN_LEAD_DAYS = 2;
const POLL_INTERVAL_MSEC = (60 * 1000) as Milliseconds;

// Weekly cadence anchor in UCLA local time: Monday at 9:00 AM. Luxon
// weekdays are 1=Monday through 7=Sunday.
const SCHEDULE_WEEKDAY = 1;
const SCHEDULE_HOUR = 9;
const SCHEDULE_MINUTE = 0;

export class DonutService {
  private client: Client | null = null;

  public constructor(private readonly dates: IDateClient) {}

  /**
   * Startup hook: attach the client and begin the rolling poll loop that
   * triggers scheduled donut chats and end-of-week check-ins.
   */
  public async initialize(client: Client): Promise<void> {
    this.client = client;
    await this.alignNextChatWithSchedule();
    // Catch up on anything overdue from downtime before scheduling.
    await this.pollOnce();
    this.schedulePoll();
    console.log(
      `[DONUT] scheduler started, polling every ${POLL_INTERVAL_MSEC}ms`,
    );
  }

  public async getOrCreate(
    guildId: GuildId = UPE_GUILD_ID,
  ): Promise<DonutState> {
    const existing = await DonutStateModel.findOne({ guildId });
    if (existing !== null) {
      return existing;
    }
    return await DonutStateModel.create({ guildId });
  }

  private async setNextChat(
    nextChat: string,
    guildId: GuildId = UPE_GUILD_ID,
  ): Promise<void> {
    await DonutStateModel.updateOne({ guildId }, { $set: { nextChat } });
  }

  /**
   * Reconcile the persisted `nextChat` with the hardcoded weekly schedule.
   * Recomputes when missing or when the persisted day/hour/minute no longer
   * matches, so cadence changes take effect on next boot.
   */
  private async alignNextChatWithSchedule(
    guildId: GuildId = UPE_GUILD_ID,
  ): Promise<void> {
    const state = await this.getOrCreate(guildId);
    const persisted =
      state.nextChat === null
        ? null
        : DateTime.fromISO(state.nextChat, { zone: UCLA_TIMEZONE });

    const matchesSchedule =
      persisted !== null &&
      persisted.isValid &&
      persisted.weekday === SCHEDULE_WEEKDAY &&
      persisted.hour === SCHEDULE_HOUR &&
      persisted.minute === SCHEDULE_MINUTE;

    if (matchesSchedule) {
      return;
    }

    const now = this.dates.getDateTime(this.dates.getNow(), UCLA_TIMEZONE);
    const next = DonutService.nextScheduledOccurrence(now);
    const iso = next.toISO();
    if (iso !== null) {
      await this.setNextChat(iso, guildId);
    }
  }

  private static nextScheduledOccurrence(after: DateTime): DateTime {
    let candidate = after.set({
      hour: SCHEDULE_HOUR,
      minute: SCHEDULE_MINUTE,
      second: 0,
      millisecond: 0,
    });
    while (candidate < after || candidate.weekday !== SCHEDULE_WEEKDAY) {
      candidate = candidate.plus({ days: 1 });
    }
    return candidate;
  }

  public async setPaused(
    paused: boolean,
    guildId: GuildId = UPE_GUILD_ID,
  ): Promise<void> {
    await DonutStateModel.updateOne({ guildId }, { $set: { paused } });
  }

  public async addUser(
    userId: UserId,
    guildId: GuildId = UPE_GUILD_ID,
  ): Promise<boolean> {
    const result = await DonutStateModel.updateOne(
      { guildId, users: { $ne: userId } },
      { $push: { users: userId } },
    );
    return result.modifiedCount > 0;
  }

  public async removeUser(
    userId: UserId,
    guildId: GuildId = UPE_GUILD_ID,
  ): Promise<boolean> {
    const result = await DonutStateModel.updateOne(
      { guildId },
      { $pull: { users: userId } },
    );
    return result.modifiedCount > 0;
  }

  public async markChatted(
    threadId: ChannelId,
    guildId: GuildId = UPE_GUILD_ID,
  ): Promise<"not_active" | "already_marked" | "ok"> {
    const state = await this.getOrCreate(guildId);
    if (!state.threads.includes(threadId)) {
      return "not_active";
    }
    if (state.completed.includes(threadId)) {
      return "already_marked";
    }
    await DonutStateModel.updateOne(
      { guildId },
      { $push: { completed: threadId } },
    );
    return "ok";
  }

  /**
   * Kick off any donut chat whose scheduled start has passed. Safe to call
   * on boot to catch up on missed cycles.
   */
  public async startDonutChat(state: DonutState): Promise<void> {
    const client = this.getClient();
    const channel = await client.channels.fetch(DONUT_CHANNEL_ID);
    if (channel === null || channel.type !== ChannelType.GuildText) {
      console.error(
        `[DONUT] configured channel ${DONUT_CHANNEL_ID} is not a text channel`,
      );
      return;
    }

    if (state.completed.length > 0) {
      const proportion = state.completed.length / state.threads.length;
      const finishedMessage =
        proportion < 1 / 3
          ? `Good start! ${state.completed.length} out of ${state.threads.length} donut chats were finished this week. Let's get those numbers up!`
          : proportion < 2 / 3
            ? `${state.completed.length} out of ${state.threads.length} donut chats were finished this week! Keep it up!`
            : `Amazing job! ${state.completed.length} out of ${state.threads.length} donut chats were finished this week!`;

      const finishedEmbed = new EmbedBuilder()
        .setTitle("Last week's donut chats just ended!")
        .setDescription(finishedMessage)
        .setColor(Colors.Blue);
      await channel.send({ embeds: [finishedEmbed] });
    }

    if (state.users.length < 2) {
      const notEnoughEmbed = new EmbedBuilder()
        .setTitle("A donut chat was scheduled but not enough people joined.")
        .setDescription(
          "There needs to be at least 2 people to chat with each other!",
        )
        .setColor(Colors.Red);
      await channel.send({ embeds: [notEnoughEmbed] });
      await this.advanceSchedule(state);
      return;
    }

    const enoughEmbed = new EmbedBuilder()
      .setTitle("A donut chat was just started!")
      .setDescription(
        "If you're signed up, check for a ping in a thread in this channel! :doughnut:",
      )
      .addFields({
        name: "I wasn't pinged!",
        value:
          "Make sure you've joined already! You can do this with the /donutjoin slash command.",
      })
      .setFooter({
        text: "You can always opt-out with /donutleave, but we'll be sad to see you go!",
      })
      .setColor(Colors.Green);
    await channel.send({ embeds: [enoughEmbed] });

    const groups = DonutService.createHeuristicGrouping(
      state.users,
      state.history,
      100,
    );

    const nowDate = this.dates.getDateTime(this.dates.getNow(), UCLA_TIMEZONE);
    const threadNameDate = nowDate.toLocaleString(DateTime.DATE_MED);

    const threadIds: string[] = [];
    for (const group of groups) {
      const thread = await channel.threads.create({
        name: `Donut Chat - ${threadNameDate}`,
        autoArchiveDuration: ThreadAutoArchiveDuration.OneWeek,
        type: ChannelType.PrivateThread,
      });

      for (const userId of group) {
        try {
          await thread.members.add(userId);
        } catch (error) {
          console.error(
            `[DONUT] failed to add user ${userId} to thread ${thread.id}:`,
            error,
          );
        }
      }
      threadIds.push(thread.id);
      await thread.join();

      const pings = group.map((id) => userMention(id));
      const pingString =
        group.length === 1
          ? pings[0]
          : pings.slice(0, -1).join(", ") + " and " + pings[pings.length - 1];

      const introductionEmbed = new EmbedBuilder()
        .setTitle("Let's donut!")
        .setDescription(`Welcome, ${pingString}! :doughnut: :speaking_head:`)
        .addFields(
          {
            name: "How does this work?",
            value:
              "Introduce yourselves and grab some coffee or food together sometime soon. I'll check up to see how it's going before the week ends!",
          },
          {
            name: "What should we talk about?",
            value:
              "Share your favorite lecture hall, your go-to boba order, or your wildest UPE induction memory.",
          },
          {
            name: "We chatted! What do I do?",
            value:
              "Near the end of the week, I'll drop a button in this thread " +
              "that any of you can press to mark this donut chat complete.",
          },
        )
        .setFooter({
          text: "Please note that this thread is private but may still be visible to server moderators. Take any private conversations into DMs!",
        })
        .setColor(Colors.Blue);
      await thread.send({ embeds: [introductionEmbed] });
    }

    await this.advanceSchedule(state);

    const refreshed = await DonutStateModel.findOne({ guildId: state.guildId });
    const checkInAt =
      this.computeCheckInAt(refreshed?.nextChat ?? null) ??
      nowDate.plus({ days: 7 - CHECK_IN_LEAD_DAYS }).toISO();

    const newHistory = [...state.history, groups];
    await DonutStateModel.updateOne(
      { guildId: state.guildId },
      {
        $set: {
          threads: threadIds,
          completed: [],
          history: newHistory,
          checkInAt,
          checkInSent: false,
        },
      },
    );
  }

  private schedulePoll(): void {
    setTimeout(async () => {
      try {
        await this.pollOnce();
      } catch (error) {
        // This callback is outside our standard execution pipeline, so
        // manually suppress exceptions to prevent bringing down the bot.
        console.error("[DONUT] poll failed:", error);
        if (error instanceof Error) {
          await channelsService.sendDevError(error);
        }
      }
      this.schedulePoll();
    }, POLL_INTERVAL_MSEC);
  }

  private async pollOnce(): Promise<void> {
    if (this.client === null) {
      return;
    }
    await this.runDueChats();
    await this.runDueCheckIns();
  }

  private async runDueChats(): Promise<void> {
    const nowIso = this.nowIso();
    const due = await DonutStateModel.find({
      paused: false,
      nextChat: { $ne: null, $lte: nowIso },
    });
    for (const state of due) {
      try {
        await this.startDonutChat(state);
      } catch (error) {
        console.error("[DONUT] failed to run scheduled chat:", error);
        if (error instanceof Error) {
          await channelsService.sendDevError(error);
        }
      }
    }
  }

  private async runDueCheckIns(): Promise<void> {
    const nowIso = this.nowIso();
    const due = await DonutStateModel.find({
      checkInSent: false,
      checkInAt: { $ne: null, $lte: nowIso },
      "threads.0": { $exists: true },
    });
    for (const state of due) {
      try {
        await this.sendCheckIns(state);
      } catch (error) {
        console.error("[DONUT] failed to send check-ins:", error);
        if (error instanceof Error) {
          await channelsService.sendDevError(error);
        }
      }
    }
  }

  private async sendCheckIns(state: DonutState): Promise<void> {
    const client = this.getClient();
    for (const threadId of state.threads) {
      if (state.completed.includes(threadId)) {
        continue;
      }
      try {
        const thread = await client.channels.fetch(threadId);
        if (thread === null || !thread.isThread()) {
          continue;
        }
        await this.sendCheckInMessage(thread as AnyThreadChannel);
      } catch (error) {
        console.error(
          `[DONUT] failed to send check-in to thread ${threadId}:`,
          error,
        );
      }
    }
    await DonutStateModel.updateOne(
      { guildId: state.guildId },
      { $set: { checkInSent: true } },
    );
  }

  private getClient(): Client {
    if (this.client === null) {
      throw new Error("donut service used before initialize()");
    }
    return this.client;
  }

  private async sendCheckInMessage(thread: AnyThreadChannel): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle("Did you donut yet? :doughnut:")
      .setDescription(
        "The week is almost over! If you've met up, press the button " +
          "below to mark this donut chat as complete. If not, there's " +
          "still time to grab that coffee!",
      )
      .setColor(Colors.Yellow);
    const button = new ButtonBuilder()
      .setCustomId(DONUT_CHATTED_BUTTON_ID)
      .setLabel("We chatted!")
      .setEmoji("🍩")
      .setStyle(ButtonStyle.Success);
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(button);
    await thread.send({ embeds: [embed], components: [row] });
  }

  private computeCheckInAt(nextChatIso: string | null): string | null {
    if (nextChatIso === null) {
      return null;
    }
    const scheduled = DateTime.fromISO(nextChatIso, { zone: UCLA_TIMEZONE });
    if (!scheduled.isValid) {
      return null;
    }
    return scheduled.minus({ days: CHECK_IN_LEAD_DAYS }).toISO();
  }

  private async advanceSchedule(state: DonutState): Promise<void> {
    if (state.nextChat === null) {
      return;
    }
    const scheduled = DateTime.fromISO(state.nextChat, {
      zone: UCLA_TIMEZONE,
    });
    const now = this.dates.getDateTime(this.dates.getNow(), UCLA_TIMEZONE);
    // Don't advance if the scheduled firing hasn't happened yet — this
    // preserves the regular cadence when /donutforce is invoked early.
    if (!scheduled.isValid || scheduled >= now) {
      return;
    }
    // Step past today's firing before snapping to the env schedule, so a
    // chat that just fired doesn't immediately re-qualify as overdue.
    const next = DonutService.nextScheduledOccurrence(now.plus({ days: 1 }));
    const iso = next.toISO();
    if (iso !== null) {
      await this.setNextChat(iso, state.guildId);
    }
  }

  private nowIso(): string {
    return this.dates.getDate(this.dates.getNow()).toISOString();
  }

  private static createHeuristicGrouping(
    users: UserId[],
    prevMatching: UserId[][][],
    tries: number,
  ): UserId[][] {
    let score = Number.MAX_SAFE_INTEGER;
    let bestGroups: UserId[][] = [];

    for (let i = 0; i < tries; i++) {
      const groups = DonutService.createGrouping(users);
      const newScore = DonutService.calculateGroupingScore(
        prevMatching,
        groups,
      );
      if (newScore < score) {
        score = newScore;
        bestGroups = groups;
      }
      if (newScore === 0) {
        break;
      }
    }
    return bestGroups;
  }

  private static createGrouping(users: UserId[]): UserId[][] {
    const shuffled = [...users].sort(() => Math.random() - 0.5);
    const groups: UserId[][] = [];
    for (let i = 0; i < shuffled.length - 1; i += 2) {
      groups.push(shuffled.slice(i, i + 2));
    }
    if (shuffled.length % 2 !== 0 && groups.length > 0) {
      groups[groups.length - 1].push(shuffled[shuffled.length - 1]);
    }
    return groups;
  }

  private static calculateGroupingScore(
    prevMatching: UserId[][][],
    proposed: UserId[][],
  ): number {
    let score = 0;
    prevMatching.forEach((week, i) => {
      week.forEach((prevGroup) => {
        proposed.forEach((proposedGroup) => {
          if (proposedGroup.every((user) => prevGroup.includes(user))) {
            const weeksAgo = prevMatching.length - i;
            score += DonutService.getAgeWeighting(weeksAgo);
          }
        });
      });
    });
    return score;
  }

  private static getAgeWeighting(weeksAgo: number): number {
    return weeksAgo ** -1.3;
  }
}

export default new DonutService(new SystemDateClient());
