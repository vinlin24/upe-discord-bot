import {
  EmbedBuilder,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";

import { SlashCommandHandler } from "../../abc/command.abc";
import type { UserId } from "../../types/branded.types";
import donutService from "./donut.service";

class DonutLeaveCommand extends SlashCommandHandler {
  public override readonly definition = new SlashCommandBuilder()
    .setName("donutleave")
    .setDescription("Opt yourself out of donut chats.")
    .toJSON();

  public override async execute(
    interaction: ChatInputCommandInteraction,
  ): Promise<void> {
    await donutService.getOrCreate();
    const removed = await donutService.removeUser(
      interaction.user.id as UserId,
    );

    const embed = new EmbedBuilder().setTitle(
      removed
        ? "You've left donut chats successfully."
        : "Leaving donut chats failed because you aren't opted in right now.",
    );

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
}

export default new DonutLeaveCommand();
