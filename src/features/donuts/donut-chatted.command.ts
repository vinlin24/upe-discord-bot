import {
  Colors,
  EmbedBuilder,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";

import { SlashCommandHandler } from "../../abc/command.abc";
import donutService from "./donut.service";

class DonutChattedCommand extends SlashCommandHandler {
  public override readonly definition = new SlashCommandBuilder()
    .setName("donutchatted")
    .setDescription("Use in a donut chat thread to mark it as finished!")
    .toJSON();

  public override async execute(
    interaction: ChatInputCommandInteraction,
  ): Promise<void> {
    const result = await donutService.markChatted(interaction.channelId);

    const embed = new EmbedBuilder();
    if (result === "not_active") {
      embed
        .setTitle(
          "This donut chat is not active and cannot be marked as finished.",
        )
        .setColor(Colors.Red);
    }
    else {
      embed
        .setTitle("This donut chat has been completed!")
        .setDescription(":tada: :tada:")
        .setColor(Colors.Green);
    }

    await interaction.reply({ embeds: [embed] });
  }
}

export default new DonutChattedCommand();
