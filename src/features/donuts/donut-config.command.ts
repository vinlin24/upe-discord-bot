import {
  ActionRowBuilder,
  ChannelSelectMenuBuilder,
  channelMention,
  ChannelType,
  Colors,
  ComponentType,
  EmbedBuilder,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import { DateTime } from "luxon";

import { SlashCommandHandler } from "../../abc/command.abc";
import type { SlashCommandCheck } from "../../abc/check.abc";
import {
  Privilege,
  PrivilegeCheck,
} from "../../middleware/privilege.middleware";
import type { ChannelId } from "../../types/branded.types";
import { makeErrorEmbed } from "../../utils/errors.utils";
import donutService from "./donut.service";

const CHANNEL_SELECT_ID = "donutconfig:channel-select";

class DonutConfigCommand extends SlashCommandHandler {
  public override readonly definition = new SlashCommandBuilder()
    .setName("donutconfig")
    .setDescription("Configure the donut chats feature.")
    .addSubcommand((sub) =>
      sub
        .setName("channel")
        .setDescription(
          "Set the channel where donut chat threads are created.",
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("timezone")
        .setDescription("Set the timezone used to schedule donut chats.")
        .addStringOption((option) =>
          option
            .setName("timezone")
            .setDescription(
              "Timezone in IANA (tzdb) format, e.g. America/Los_Angeles",
            )
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("schedule")
        .setDescription("Set the weekly day and time donut chats start.")
        .addIntegerOption((option) =>
          option
            .setName("day")
            .setDescription("Day of the week to send donut chats out")
            .setRequired(true)
            .addChoices(
              { name: "Monday", value: 1 },
              { name: "Tuesday", value: 2 },
              { name: "Wednesday", value: 3 },
              { name: "Thursday", value: 4 },
              { name: "Friday", value: 5 },
              { name: "Saturday", value: 6 },
              { name: "Sunday", value: 7 },
            ),
        )
        .addIntegerOption((option) =>
          option
            .setName("hour")
            .setDescription("Hour of the day (24hr format). Defaults to 9.")
            .setMinValue(0)
            .setMaxValue(23),
        )
        .addIntegerOption((option) =>
          option
            .setName("minute")
            .setDescription("Minute of the hour. Defaults to 0.")
            .setMinValue(0)
            .setMaxValue(59),
        ),
    )
    .toJSON();

  public override readonly checks: SlashCommandCheck[] = [
    new PrivilegeCheck(this).atLeast(Privilege.Developer),
  ];

  public override async execute(
    interaction: ChatInputCommandInteraction,
  ): Promise<void> {
    const state = await donutService.getOrCreate();
    const sub = interaction.options.getSubcommand(true);

    if (sub === "channel") {
      await this.handleChannel(interaction, state.channelId);
      return;
    }
    if (sub === "timezone") {
      await this.handleTimezone(interaction);
      return;
    }
    if (sub === "schedule") {
      await this.handleSchedule(interaction);
    }
  }

  private async handleChannel(
    interaction: ChatInputCommandInteraction,
    currentChannel: ChannelId | null,
  ): Promise<void> {
    const channelSelect = new ChannelSelectMenuBuilder()
      .setChannelTypes(ChannelType.GuildText)
      .setCustomId(CHANNEL_SELECT_ID)
      .setPlaceholder(
        currentChannel
          ? "Current: see prompt below. Pick a new one or dismiss."
          : "Select where to create donut chat threads",
      );
    const row = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
      channelSelect,
    );

    const prompt = new EmbedBuilder()
      .setTitle("Donut chat channel configuration")
      .setDescription(
        (currentChannel
          ? `Current channel: ${channelMention(currentChannel)}\n\n`
          : "") +
          "Select the channel where donut chat threads will be created. " +
          "The bot must be able to send messages and create private threads in the selected channel.",
      )
      .setFooter({
        text: "Hint: type the name of your desired channel if you don't see it in the dropdown!",
      })
      .setColor(Colors.Blue);

    const response = await interaction.reply({
      embeds: [prompt],
      components: [row],
      fetchReply: true,
    });

    try {
      const confirmation = await response.awaitMessageComponent({
        componentType: ComponentType.ChannelSelect,
        time: 30_000,
        filter: (i) =>
          i.user.id === interaction.user.id && i.customId === CHANNEL_SELECT_ID,
      });

      const chosenId = confirmation.values[0];
      if (!chosenId) {
        return;
      }
      await donutService.setChannel(chosenId as ChannelId);

      const success = new EmbedBuilder()
        .setTitle(
          `The donut chat channel was changed to ${channelMention(chosenId)}!`,
        )
        .setColor(Colors.Green);
      await confirmation.update({ embeds: [success], components: [] });
    } catch {
      const state = await donutService.getOrCreate();
      const failureEmbed = new EmbedBuilder();
      if (state.channelId) {
        failureEmbed
          .setTitle(
            `The donut chat channel was not changed from ${channelMention(state.channelId)}.`,
          )
          .setColor(Colors.Yellow);
      } else {
        failureEmbed
          .setTitle("No channel was selected within 30 seconds; cancelling.")
          .setColor(Colors.Red);
      }
      await interaction.editReply({
        embeds: [failureEmbed],
        components: [],
      });
    }
  }

  private async handleTimezone(
    interaction: ChatInputCommandInteraction,
  ): Promise<void> {
    const tz = interaction.options.getString("timezone", true);
    const testTZ = DateTime.local().setZone(tz);
    if (!testTZ.isValid || testTZ.zone === null) {
      await interaction.reply({
        embeds: [
          makeErrorEmbed(
            "Time zone could not be parsed.",
            "Provided time zone is required to be in IANA format. You can look up your time zone using [this tool](https://zones.arilyn.cc/).",
          ),
        ],
        ephemeral: true,
      });
      return;
    }

    const tzIana = testTZ.zone.name;
    await donutService.setTimezone(tzIana);

    const success = new EmbedBuilder()
      .setTitle(`The donut chat time zone was changed to ${tzIana}!`)
      .setColor(Colors.Green);
    await interaction.reply({ embeds: [success] });
  }

  private async handleSchedule(
    interaction: ChatInputCommandInteraction,
  ): Promise<void> {
    const state = await donutService.getOrCreate();
    if (!state.timezone || !state.channelId) {
      await interaction.reply({
        embeds: [
          makeErrorEmbed(
            "Please configure the channel and time zone first.",
            "Use /donutconfig channel and /donutconfig timezone to set them up before scheduling.",
          ),
        ],
        ephemeral: true,
      });
      return;
    }

    const day = interaction.options.getInteger("day", true);
    const hour = interaction.options.getInteger("hour") ?? 9;
    const minute = interaction.options.getInteger("minute") ?? 0;

    let desired = DateTime.local({ zone: state.timezone }).set({
      hour,
      minute,
      second: 0,
      millisecond: 0,
    });
    while (desired < DateTime.now() || desired.weekday !== day) {
      desired = desired.plus({ days: 1 });
    }

    const iso = desired.toISO();
    if (iso === null) {
      await interaction.reply({
        embeds: [makeErrorEmbed("Failed to compute a valid schedule.")],
        ephemeral: true,
      });
      return;
    }
    await donutService.setNextChat(iso);

    const embed = new EmbedBuilder()
      .setTitle("Donut chats are happening!")
      .setDescription(
        `Weekly donut chats are beginning, starting on ${desired.toLocaleString(DateTime.DATETIME_MED)}!`,
      )
      .addFields({
        name: "I want to join!",
        value: "Use the /donutjoin command!",
      })
      .setFooter({
        text: "You can start this week's early by using /donutforce as an officer.",
      })
      .setColor(Colors.Green);
    await interaction.reply({ embeds: [embed] });
  }
}

export default new DonutConfigCommand();
