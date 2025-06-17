import {
  bold,
  codeBlock,
  Colors,
  EmbedBuilder,
  inlineCode,
  italic,
  SlashCommandBuilder,
  time,
  TimestampStyles,
  type APIApplicationCommandOptionChoice,
  type ChatInputCommandInteraction,
  type TimestampStylesString,
} from "discord.js";
import type { DateTime } from "luxon";

import { SlashCommandHandler } from "../../abc/command.abc";
import type { UnixSeconds, UrlString } from "../../types/branded.types";
import {
  Month,
  MONTH_NAMES,
  SystemDateClient,
  UCLA_TIMEZONE,
  type IDateClient,
} from "../../utils/date.utils";
import { makeErrorEmbed } from "../../utils/errors.utils";
import { quietHyperlink, toBulletedList } from "../../utils/formatting.utils";

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
  public override readonly definition = new SlashCommandBuilder()
    .setName("timestamp")
    .setDescription(
      "Format a timestamp mention based on input date/time, in UCLA time " +
      `(${UCLA_TIMEZONE}).`,
    )
    .addBooleanOption(input => input
      .setName("help")
      .setDescription("Display help about timestamps (ignore other options)."),
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
    const help = interaction.options.getBoolean("help");

    if (help) {
      const embed = this.formatHelpEmbed();
      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

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
      UCLA_TIMEZONE,
    );

    if (dateTime.invalidReason !== null) {
      return dateTime.invalidExplanation ?? dateTime.invalidReason;
    }

    return dateTime;
  }

  private formatHelpEmbed(): EmbedBuilder {
    const now = this.dateClient.getNow();

    const example = `Example rendered mention: ${time(now)}`;

    const commandDescription = (
      `Format a ${bold("timestamp mention")}, which encodes a date/time that ` +
      "automatically renders in every user's current timezone. You can also " +
      `do neat things like using the ${italic("relative time")} format style ` +
      "to render countdowns. This command in particular will treat input as " +
      `UCLA time (${inlineCode(UCLA_TIMEZONE)}).`
    );

    const syntaxOverview = (
      "The syntax of a timestamp mention is:\n" +
      codeBlock("<t:UNIX_TIMESTAMP>") +
      "Or with a format style code:\n" +
      codeBlock("<t:UNIX_TIMESTAMP:STYLE>") +
      "You can also generate Unix timestamps using " +
      quietHyperlink(
        "this online tool",
        "https://www.unixtimestamp.com" as UrlString,
      ) + "."
    );

    const formatStylesReference = bold("Format Styles Reference") + "\n" +
      toBulletedList(STYLE_CHOICES.map(choice => {
        const { name: displayName, value } = choice;
        // Discard the (e.g. ...) from the choice display name, we'll replace
        // it with an actual rendered timestamp.
        const name = displayName.slice(0, displayName.indexOf("(") - 1);
        const mention = time(now, value);
        return (
          `${inlineCode(value)}: ${name} (${inlineCode(mention)} => ${mention})`
        );
      }));

    const optionsReference = bold("Options Reference") + "\n" + toBulletedList([
      "If you omit any of the date/time units (year, month, second, etc.), " +
      "they default to those of the current time.",

      "By default, the raw timestamp text is returned ephemerally for your " +
      `copy-paste. You can set ${inlineCode("render")} to directly render ` +
      "(publicly) the timestamp instead.",
    ]);

    const combinedDescription = [
      example,
      commandDescription,
      syntaxOverview,
      formatStylesReference,
      optionsReference,
    ].join("\n\n");

    return new EmbedBuilder()
      .setColor(Colors.Green)
      .setTitle(`${this.id} Help`)
      .setDescription(combinedDescription);
  }
}

export default new TimestampCommand(new SystemDateClient());
