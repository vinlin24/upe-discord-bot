import {
  bold,
  channelMention,
  EmbedBuilder,
  inlineCode,
  roleMention,
  SlashCommandBuilder,
  userMention,
  type ApplicationCommandOptionChoiceData,
  type AutocompleteInteraction,
  type ChatInputCommandInteraction,
  type GuildMember,
} from "discord.js";

import type { SlashCommandCheck } from "../../abc/check.abc";
import { SlashCommandHandler } from "../../abc/command.abc";
import {
  Privilege,
  PrivilegeCheck,
} from "../../middleware/privilege.middleware";
import inducteeSheetsService, {
  type InducteeData,
} from "../../services/inductee-sheets.service";
import { EMOJI_WARNING } from "../../utils/emojis.utils";
import { makeErrorEmbed } from "../../utils/errors.utils";
import { emailHyperlink, toBulletedList } from "../../utils/formatting.utils";
import {
  AUTOCOMPLETE_CHOICE_NAME_MAX_LENGTH,
  AUTOCOMPLETE_MAX_CHOICES,
} from "../../utils/limits.utils";
import { determineGroup } from "../bit-byte/bit-byte.utils";

class WhoisCommand extends SlashCommandHandler {
  public override readonly definition = new SlashCommandBuilder()
    .setName("whois")
    .setDescription("Search for inductee user by their name.")
    .addStringOption(input => input
      .setName("name")
      .setDescription("Name as submitted in the pre-induction questionnaire.")
      .setRequired(true)
      .setAutocomplete(true)
    )
    .toJSON();

  public override readonly checks: SlashCommandCheck[] = [
    new PrivilegeCheck(this).atLeast(Privilege.Officer),
  ];

  public override async execute(
    interaction: ChatInputCommandInteraction,
  ): Promise<void> {
    await interaction.deferReply({ ephemeral: true });
    const name = interaction.options.getString("name", true);

    const inducteeData = await inducteeSheetsService.getAllData();

    let inducteeFound: InducteeData | null = null;
    const laxName = name.trim().toLowerCase();
    for (const data of inducteeData.values()) {
      if (data.legalName.trim().toLowerCase() === laxName) {
        inducteeFound = data;
        break;
      }
    }

    if (inducteeFound === null) {
      await interaction.editReply({
        embeds: [makeErrorEmbed(
          `Couldn't find any inductee with name ${inlineCode(name)}.`,
        )],
      });
      return;
    }

    const queryResult = await interaction.guild!.members.fetch({
      query: inducteeFound.discordUsername,
      limit: 1,
    });
    const member = queryResult.first();
    if (member === undefined) {
      await interaction.editReply({
        embeds: [makeErrorEmbed(
          `Found the username ${inlineCode(inducteeFound.discordUsername)} ` +
          `associated with name ${inlineCode(name)}, but they do not seem ` +
          "to be in the server.",
        )],
      });
      return;
    }

    const embed = await this.prepareEmbed(member, inducteeFound);
    await interaction.editReply({ embeds: [embed] });
  }

  public override async autocomplete(
    interaction: AutocompleteInteraction,
  ): Promise<void> {
    const focusedValue = interaction.options.getFocused();

    // Don't force cache update every time, for performance.
    const inducteeData = await inducteeSheetsService.getAllData(false);

    const names = Array.from(inducteeData
      .mapValues(data => [data.legalName, data.preferredName] as const)
      .values()
    );

    const filteredNames = names.filter(([legalName, preferredName]) =>
      legalName.startsWith(focusedValue) ||
      preferredName?.startsWith(focusedValue),
    );

    const choices: ApplicationCommandOptionChoiceData[] = filteredNames
      .slice(0, AUTOCOMPLETE_MAX_CHOICES)
      .map(([legalName, preferredName]) => {
        const name = legalName + (preferredName ? ` (${preferredName})` : "");
        return {
          name: name.slice(0, AUTOCOMPLETE_CHOICE_NAME_MAX_LENGTH),
          value: legalName, // execute() uses legalName for lookup.
        };
      });

    await interaction.respond(choices);
  }

  private async prepareEmbed(
    inducteeMember: GuildMember,
    inducteeData: InducteeData,
  ): Promise<EmbedBuilder> {
    const { legalName, preferredName, preferredEmail, major } = inducteeData;
    const group = await determineGroup(inducteeMember);

    const lines = [
      `${bold("Name:")} ${legalName}`,
      preferredName ? `${bold("Preferred:")} ${preferredName}` : "",
      `${bold("Major:")} ${major}`,
      `${bold("Contact:")} ${emailHyperlink(preferredEmail)}`,
      `${bold("Member:")} ${userMention(inducteeMember.id)}`,
      `${bold("Group:")} ` + (group
        ? `${roleMention(group.roleId)} / ${channelMention(group.channelId)}`
        : `<pending assignment> ${EMOJI_WARNING}`
      ),
    ];

    const description = toBulletedList(lines.filter(Boolean));

    return new EmbedBuilder()
      .setTitle("Inductee User Reverse Lookup")
      .setDescription(description);
  }
}

export default new WhoisCommand();
