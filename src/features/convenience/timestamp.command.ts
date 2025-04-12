import {
  codeBlock,
  SlashCommandBuilder,
  time,
  TimestampStyles,
  type APIApplicationCommandOptionChoice,
  type ChatInputCommandInteraction,
  type TimestampStylesString,
} from "discord.js";
import type { DateTime } from "luxon";

import { SlashCommandHandler } from "../../abc/command.abc";
import type { UnixSeconds } from "../../types/branded.types";
import {
  Month,
  MONTH_NAMES,
  SystemDateClient,
  type IDateClient,
} from "../../utils/date.utils";
import { makeErrorEmbed } from "../../utils/errors.utils";

const MONTH_CHOICES: APIApplicationCommandOptionChoice<Month>[] = MONTH_NAMES
  .map(name => ({ name: `${name} (${Month[name]})`, value: Month[name] }));

const STYLE_CHOICES: APIApplicationCommandOptionChoice<TimestampStylesString>[]
  = [
    {
      name: "Short Time (e.g. 9:01 AM)",
      value: TimestampStyles.ShortTime,
    },
    {
      name: "Long Time (e.g. 9:01:00 AM)",
      value: TimestampStyles.LongTime,
    },
    {
      name: "Short Date (e.g. 11/28/2018)",
      value: TimestampStyles.ShortDate,
    },
    {
      name: "Long Date (e.g. November 28, 2018)",
      value: TimestampStyles.LongDate,
    },
    {
      name: "Short Date/Time (e.g. November 28, 2018 9:01 AM)",
      value: TimestampStyles.ShortDateTime,
    },
    {
      name: "Long Date/Time (e.g. Wednesday, November 28, 2018 9:01 AM)",
      value: TimestampStyles.LongDateTime,
    },
    {
      name: "Relative Time (e.g. in 2 days)",
      value: TimestampStyles.RelativeTime,
    },
  ];

class TimestampCommand extends SlashCommandHandler {
  private static readonly UCLA_TIMEZONE = "America/Los_Angeles";

  public override readonly definition = new SlashCommandBuilder()
    .setName("timestamp")
    .setDescription(
      "Format a timestamp mention based on input date/time in UCLA time " +
      `(${TimestampCommand.UCLA_TIMEZONE}).`,
    )
    .addIntegerOption(input => input
      .setName("year")
      .setDescription("Year.")
      .setMinValue(1970),
    )
    .addIntegerOption(input => input
      .setName("month")
      .setDescription("Month.")
      .addChoices(...MONTH_CHOICES),
    )
    .addIntegerOption(input => input
      .setName("day")
      .setDescription("Day of the month.")
      .setMinValue(1)
      .setMaxValue(31),
    )
    .addIntegerOption(input => input
      .setName("hour")
      .setDescription("Hour of the day (24 hour clock)."),
    )
    .addIntegerOption(input => input
      .setName("minute")
      .setDescription("Minute of the hour.")
      .setMinValue(0)
      .setMaxValue(59),
    )
    .addIntegerOption(input => input
      .setName("second")
      .setDescription("Second of the minute.")
      .setMinValue(0)
      .setMaxValue(59),
    )
    .addStringOption(input => input
      .setName("style")
      .setDescription("Format style.")
      .addChoices(...STYLE_CHOICES),
    )
    .addBooleanOption(input => input
      .setName("render")
      .setDescription(
        "Render the timestamp mention instead of returning its raw text " +
        "for copy-paste.",
      ),
    )
    .toJSON();

  public constructor(private readonly dateClient: IDateClient) { super(); }

  public override async execute(
    interaction: ChatInputCommandInteraction,
  ): Promise<void> {
    const style = interaction.options.getString(
      "style",
    ) as TimestampStylesString | null;
    const render = interaction.options.getBoolean("render");

    const dateTime = this.resolveDateTime(interaction.options);
    if (typeof dateTime === "string") {
      const explanation = dateTime;
      await interaction.reply({
        embeds: [makeErrorEmbed(
          `Your provided datetime is invalid:\n${codeBlock(explanation)}`,
        )],
        ephemeral: true,
      });
      return;
    }

    const timestamp = dateTime.toUnixInteger() as UnixSeconds;

    const mention = style === null
      ? time(timestamp)
      : time(timestamp, style);

    const content = render
      ? mention
      : codeBlock(mention);

    await interaction.reply({ content, ephemeral: !render });
  }

  private resolveDateTime(
    options: ChatInputCommandInteraction["options"],
  ): DateTime | string {
    const year = options.getInteger("year") ?? undefined;
    const month = (options.getInteger("month") as Month | null) ?? undefined;
    const day = options.getInteger("day") ?? undefined;
    const hour = options.getInteger("hour") ?? undefined;
    const minute = options.getInteger("minute") ?? undefined;
    const second = options.getInteger("second") ?? undefined;

    const dateTime = this.dateClient.getDateTime(
      { year, month, day, hour, minute, second },
      TimestampCommand.UCLA_TIMEZONE,
    );

    if (dateTime.invalidReason !== null) {
      return dateTime.invalidExplanation ?? dateTime.invalidReason;
    }

    return dateTime;
  }
}

export default new TimestampCommand(new SystemDateClient());
