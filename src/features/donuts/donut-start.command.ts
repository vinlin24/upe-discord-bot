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

class DonutStartCommand extends SlashCommandHandler {
  public override readonly definition = new SlashCommandBuilder()
    .setName("donutstart")
    .setDescription("Resume automatic donut chats.")
    .toJSON();

  public override readonly checks: SlashCommandCheck[] = [
    new PrivilegeCheck(this).atLeast(Privilege.Developer),
  ];

  public override async execute(
    interaction: ChatInputCommandInteraction,
  ): Promise<void> {
    await donutService.getOrCreate();
    await donutService.setPaused(false);

    const embed = new EmbedBuilder()
      .setTitle("Donut chats will automatically start again!")
      .setColor(Colors.Green);
    await interaction.reply({ embeds: [embed] });
  }
}

export default new DonutStartCommand();
