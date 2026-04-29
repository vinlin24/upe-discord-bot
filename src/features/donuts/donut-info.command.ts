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
import { DONUT_CHANNEL_ID } from "../../utils/snowflakes.utils";
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

    const nextChatValue = state.nextChat
      ? DateTime.fromISO(state.nextChat, {
          zone: UCLA_TIMEZONE,
        }).toLocaleString(DateTime.DATETIME_MED)
      : "Pending — schedule will sync on next bot startup.";

    const embed = new EmbedBuilder()
      .setTitle(`Donut chat config for ${interaction.guild?.name}`)
      .addFields(
        {
          name: "Channel",
          value: channelMention(DONUT_CHANNEL_ID),
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
        text:
          "Channel and weekly schedule are configured via environment " +
          "variables. Only developers can access /donutforce, /donutpause, " +
          "and /donutstart.",
      })
      .setColor(Colors.Blue);

    await interaction.reply({ embeds: [embed] });
  }
}

export default new DonutInfoCommand();
