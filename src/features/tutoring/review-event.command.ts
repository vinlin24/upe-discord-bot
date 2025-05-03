import {
  bold,
  EmbedBuilder,
  inlineCode,
  roleMention,
  type ApplicationCommandOptionChoiceData,
  type AutocompleteInteraction,
  type ChatInputCommandInteraction,
} from "discord.js";

import { SlashCommandHandler } from "../../abc/command.abc";
import { GoogleSheetsClient } from "../../clients/sheets.client";
import env from "../../env";
import { EMOJI_INFORMATION, EMOJI_WARNING } from "../../utils/emojis.utils";
import {
  emailHyperlink,
  formatMailbox,
  littleText,
  quietHyperlink,
  toBulletedList,
} from "../../utils/formatting.utils";
import { AUTOCOMPLETE_MAX_CHOICES } from "../../utils/limits.utils";
import { ExtendedSlashCommandBuilder } from "../../utils/options.utils";
import { TUTORING_ROLE_ID } from "../../utils/snowflakes.utils";
import reviewSheetsService, { type ReviewEvent } from "./review-sheets.service";

class ReviewEventCommand extends SlashCommandHandler {
  public override readonly definition = new ExtendedSlashCommandBuilder()
    .setName("review")
    .setDescription("Get information about a review session.")
    .addStringOption(input => input
      .setName("event")
      .setDescription("Name of event.")
      .setRequired(true)
      .setAutocomplete(true),
    )
    .addBroadcastOption()
    .toJSON();

  public override async execute(
    interaction: ChatInputCommandInteraction,
  ): Promise<void> {
    const eventName = interaction.options.getString("event", true);
    const broadcast = interaction.options.getBoolean("broadcast");

    const eventData = await reviewSheetsService.getData(eventName);
    if (eventData === null) {
      await this.replyError(interaction, (
        `No event named ${inlineCode(eventName)} found!`
      ));
      return;
    }

    const embed = this.formatEmbed(eventData);
    await interaction.reply({ embeds: [embed], ephemeral: !broadcast });
  }

  public override async autocomplete(
    interaction: AutocompleteInteraction,
  ): Promise<void> {
    const focusedValue = interaction.options.getFocused().toLowerCase();

    const eventsData = await reviewSheetsService.getAllData();
    const eventNames = Array.from(eventsData.keys());
    const filteredNames = eventNames.filter(name =>
      name.toLowerCase().startsWith(focusedValue),
    );

    const choices: ApplicationCommandOptionChoiceData[] = filteredNames
      .slice(0, AUTOCOMPLETE_MAX_CHOICES)
      .map(name => ({ name, value: name }));

    await interaction.respond(choices);
  }

  private formatEmbed(eventData: ReviewEvent): EmbedBuilder {
    const professorInfo = formatMailbox(
      eventData.professor.name,
      emailHyperlink(eventData.professor.email),
      true,
    );

    const hostNames = [...eventData.leadHosts, ...eventData.hosts];

    const eventDate = (eventData.eventDate === undefined)
      ? `${EMOJI_WARNING} (failed to parse)`
      : `${eventData.eventDate.monthLong} ${eventData.eventDate.day}`;
    const testDate = (eventData.testDate === undefined)
      ? `${EMOJI_WARNING} (failed to parse)`
      : `${eventData.testDate.monthLong} ${eventData.testDate.day}`;

    const lines = [
      `${bold("Test Date:")} ${testDate}`,
      `${bold("Event Date:")} ${eventDate}`,
      `${bold("Location:")} ${eventData.location}`,
      `${bold("Hosts:")} ${hostNames.join(", ")}`,
      `${bold("Professor:")} ${professorInfo}`,
    ].filter(Boolean);
    const body = toBulletedList(lines);

    const moreInformation = (
      `${EMOJI_INFORMATION} Review sessions are organized by our ` +
      `${roleMention(TUTORING_ROLE_ID)} committee.`
    );

    const spreadsheetHyperlink = quietHyperlink(
      "UPE Tutoring events spreadsheet",
      GoogleSheetsClient.idToUrl(env.REVIEW_EVENTS_SPREADSHEET_ID),
    );
    const disclaimer = littleText(
      `${EMOJI_WARNING} This is an experimental feature. You can use the ` +
      `${spreadsheetHyperlink} as the source of truth.`,
    );

    const description = [body, moreInformation, disclaimer].join("\n\n");

    return new EmbedBuilder()
      .setTitle(`UPE Review Session: ${eventData.name}`)
      .setDescription(description);
  }
}

export default new ReviewEventCommand();
