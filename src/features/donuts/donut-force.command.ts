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
import { makeErrorEmbed } from "../../utils/errors.utils";
import donutService from "./donut.service";

class DonutForceCommand extends SlashCommandHandler {
  public override readonly definition = new SlashCommandBuilder()
    .setName("donutforce")
    .setDescription("Force a new donut chat to start immediately.")
    .toJSON();

  public override readonly checks: SlashCommandCheck[] = [
    new PrivilegeCheck(this).atLeast(Privilege.Developer),
  ];

  public override async execute(
    interaction: ChatInputCommandInteraction,
  ): Promise<void> {
    const state = await donutService.getOrCreate();
    if (!state.channelId) {
      await interaction.reply({
        embeds: [
          makeErrorEmbed(
            "Could not force a new donut chat",
            "Set the channel first. Use /donutconfig channel to do this!",
          ),
        ],
        ephemeral: true,
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle("Forcing a new donut chat")
      .setDescription(
        "A new donut chat is being created right now! This does not change the regular schedule. Use /donutconfig schedule to change the weekly cadence.",
      )
      .setColor(Colors.Blue);
    await interaction.reply({ embeds: [embed] });

    await donutService.startDonutChat(state);
  }
}

export default new DonutForceCommand();
