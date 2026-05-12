import {
  Colors,
  EmbedBuilder,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";

import { SlashCommandHandler } from "../../abc/command.abc";
import type { SlashCommandCheck } from "../../abc/check.abc";
import {
  Privilege,
  PrivilegeCheck,
} from "../../middleware/privilege.middleware";
import donutService from "./donut.service";

class DonutPauseCommand extends SlashCommandHandler {
  public override readonly definition = new SlashCommandBuilder()
    .setName("donutpause")
    .setDescription("Pause automatic donut chats.")
    .toJSON();

  public override readonly checks: SlashCommandCheck[] = [
    new PrivilegeCheck(this).atLeast(Privilege.Developer),
  ];

  public override async execute(
    interaction: ChatInputCommandInteraction,
  ): Promise<void> {
    await donutService.getOrCreate();
    await donutService.setPaused(true);

    const embed = new EmbedBuilder()
      .setTitle("Donut chats have been paused.")
      .setDescription("Run /donutstart to start them again!")
      .setColor(Colors.Blue);
    await interaction.reply({ embeds: [embed] });
  }
}

export default new DonutPauseCommand();
