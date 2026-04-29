import {
  channelMention,
  Colors,
  EmbedBuilder,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import { DateTime } from "luxon";

import { SlashCommandHandler } from "../../abc/command.abc";
import { UCLA_TIMEZONE } from "../../utils/date.utils";
import donutService from "./donut.service";

class DonutInfoCommand extends SlashCommandHandler {
  public override readonly definition = new SlashCommandBuilder()
    .setName("donutinfo")
    .setDescription("Get information about donut chat configuration.")
    .toJSON();

  public override async execute(
    interaction: ChatInputCommandInteraction,
  ): Promise<void> {
    const state = await donutService.getOrCreate();

    const description =
      state.threads.length > 0
        ? "There is a donut chat happening right now!"
        : state.channelId && state.nextChat
          ? "There is no active donut chat."
          : "Donut chats are not ready to begin. Please ensure that all settings listed below are configured.";

    const nextChatValue = state.nextChat
      ? DateTime.fromISO(state.nextChat, {
          zone: UCLA_TIMEZONE,
        }).toLocaleString(DateTime.DATETIME_MED)
      : "N/A, configure using /donutconfig schedule";

    const embed = new EmbedBuilder()
      .setTitle(`Donut chat config for ${interaction.guild?.name}`)
      .setDescription(description)
      .addFields(
        {
          name: "Channel",
          value: state.channelId
            ? channelMention(state.channelId)
            : "N/A, configure using /donutconfig channel",
          inline: true,
        },
        {
          name: "Users Joined",
          value: `${state.users.length}`,
          inline: true,
        },
        {
          name: "Time zone",
          value: UCLA_TIMEZONE,
        },
        {
          name: "Next Scheduled Donut Chat",
          value: nextChatValue,
        },
        {
          name: "Paused",
          value: state.paused ? "Yes" : "No",
          inline: true,
        },
      )
      .setFooter({
        text: "Only developers can access /donutconfig, /donutforce, /donutpause, and /donutstart.",
      })
      .setColor(Colors.Blue);

    await interaction.reply({ embeds: [embed] });
  }
}

export default new DonutInfoCommand();
