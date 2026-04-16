import {
  channelMention,
  Colors,
  EmbedBuilder,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import { DateTime } from "luxon";

import { SlashCommandHandler } from "../../abc/command.abc";
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
        : state.channelId && state.timezone && state.nextChat
          ? "There is no active donut chat."
          : "Donut chats are not ready to begin. Please ensure that all settings listed below are configured.";

    const nextChatValue = state.timezone
      ? state.nextChat
        ? DateTime.fromISO(state.nextChat, {
            zone: state.timezone,
          }).toLocaleString(DateTime.DATETIME_MED)
        : "N/A, configure using /donutconfig schedule"
      : "Please configure the time zone using /donutconfig timezone first.";

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
          value: state.timezone ?? "N/A, configure using /donutconfig timezone",
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
        text: "Only officers can access /donutconfig, /donutforce, /donutpause, and /donutstart.",
      })
      .setColor(Colors.Blue);

    await interaction.reply({ embeds: [embed] });
  }
}

export default new DonutInfoCommand();
