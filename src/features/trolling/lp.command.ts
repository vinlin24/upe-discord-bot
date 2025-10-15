import {
  inlineCode,
  SlashCommandBuilder,
  type APIApplicationCommandOptionChoice,
  type ChatInputCommandInteraction,
} from "discord.js";

import { SlashCommandHandler } from "../../abc/command.abc";
import type { UrlString } from "../../types/branded.types";

const LP_MAP = new Map<string, UrlString>([
  ["Customer Obsession", "https://youtu.be/ADUfddD6Ivs" as UrlString],
  ["Ownership", "https://youtu.be/EmF1K4bFAnQ" as UrlString],
  ["Invent and Simplify", "https://youtu.be/IhO1mlrqqgU" as UrlString],
  ["Are Right, A Lot", "https://youtu.be/H0wsM7EvU7c" as UrlString],
  ["Learn and Be Curious", "https://youtu.be/wAmjpFwlfzM" as UrlString],
  ["Hire and Develop the Best", "https://youtu.be/ml_8iUgnHsg" as UrlString],
  ["Insist on the Highest Standards", "https://youtu.be/AE35YwLlWkw" as UrlString],
  ["Think Big", "https://youtu.be/b9jMWx2R0QU" as UrlString],
  ["Bias for Action", "https://youtu.be/Iby_rZHtX7w" as UrlString],
  ["Frugality", "https://youtu.be/mmR1lotgsTU" as UrlString],
  ["Earn Trust", "https://youtu.be/SD5GB_6pGOg" as UrlString],
  ["Dive Deep", "https://youtu.be/trHT6thsoZ0" as UrlString],
  ["Have Backbone; Disagree and Commit", "https://youtu.be/BtjBkf8qDW4" as UrlString],
  ["Deliver Results", "https://youtu.be/bgOyaYq8UNI" as UrlString],
  ["Strive to be Earth’s Best Employer", "https://youtu.be/i8iRGy8ynTo" as UrlString],
  ["Success and Scale Bring Broad Responsibility", "https://youtu.be/6UbFkMF4Q-U" as UrlString],
]);

const LP_CHOICES: APIApplicationCommandOptionChoice<string>[]
  = Array.from(LP_MAP.keys()).map(lpName => ({
    name: lpName,
    value: lpName,
  }));

class LeadershipPrinciplesCommand extends SlashCommandHandler {
  public override readonly definition = new SlashCommandBuilder()
    .setName("lp")
    .setDescription("Get Andy Jassy to explain an Amazon Leadership Principle!")
    .addStringOption(input => input
      .setName("principle")
      .setDescription("Leadership Principle to view.")
      .addChoices(...LP_CHOICES),
    )
    .toJSON();

  public override async execute(
    interaction: ChatInputCommandInteraction,
  ): Promise<void> {
    const lpName = interaction.options.getString("principle") ?? "Frugality";
    const lpUrl = LP_MAP.get(lpName);
    if (lpUrl === undefined) {
      await this.replyError(
        interaction,
        `Unknown Leadership Principle: ${inlineCode(lpName)}`,
      );
      return;
    }
    await interaction.reply(lpUrl);
  }
}

export default new LeadershipPrinciplesCommand();
