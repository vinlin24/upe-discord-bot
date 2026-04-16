import {
  Colors,
  EmbedBuilder,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";

import { SlashCommandHandler } from "../../abc/command.abc";
import type { UserId } from "../../types/branded.types";
import donutService from "./donut.service";

class DonutJoinCommand extends SlashCommandHandler {
  public override readonly definition = new SlashCommandBuilder()
    .setName("donutjoin")
    .setDescription("Opt yourself in for donut chats!")
    .toJSON();

  public override async execute(
    interaction: ChatInputCommandInteraction,
  ): Promise<void> {
    await donutService.getOrCreate();
    const added = await donutService.addUser(interaction.user.id as UserId);

    const embed = new EmbedBuilder();
    if (added) {
      embed
        .setTitle(
          `${interaction.user.username} has just joined donut chats!`,
        )
        .setDescription(":tada: :doughnut:")
        .setColor(Colors.Green);
    }
    else {
      embed.setTitle("You've already joined donut chats!");
    }

    await interaction.reply({ embeds: [embed] });
  }
}

export default new DonutJoinCommand();
