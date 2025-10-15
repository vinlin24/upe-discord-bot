import {
  bold,
  channelMention,
  EmbedBuilder,
  roleMention,
  SlashCommandBuilder,
  userMention,
  type ChatInputCommandInteraction,
  type User,
} from "discord.js";

import type { SlashCommandCheck } from "../../abc/check.abc";
import { SlashCommandHandler } from "../../abc/command.abc";
import { GoogleSheetsClient } from "../../clients/sheets.client";
import env from "../../env";
import {
  Privilege,
  PrivilegeCheck,
} from "../../middleware/privilege.middleware";
import type { BitByteGroup } from "../../models/bit-byte.model";
import bitByteService from "../../services/bit-byte.service";
import channelsService from "../../services/channels.service";
import type { RoleId } from "../../types/branded.types";
import { EMOJI_INFORMATION } from "../../utils/emojis.utils";
import { quietHyperlink, toBulletedList } from "../../utils/formatting.utils";
import { SEASON_ID } from "../../utils/upe.utils";
import bitSheetsService, { type BitData } from "./bit-sheets.service";

class BitLookupCommand extends SlashCommandHandler {
  public override readonly definition = new SlashCommandBuilder()
    .setName("bit")
    .setDescription("Look up information about a bit-byte bit.")
    .addUserOption(input => input
      .setName("bit")
      .setDescription("Bit user to request data for.")
      .setRequired(true),
    )
    .toJSON();

  public override readonly checks: SlashCommandCheck[] = [
    new PrivilegeCheck(this).atLeast(Privilege.Officer),
  ];

  public override async execute(
    interaction: ChatInputCommandInteraction,
  ): Promise<void> {
    const bitUser = interaction.options.getUser("bit", true);
    const bitsData = await bitSheetsService.getAllData();
    const bitData = bitsData.find(data => data.discordId === bitUser.id);

    if (bitData === undefined) {
      await this.replyError(interaction, (
        `We don't have data on which person ${userMention(bitUser.id)} ` +
        "refers to!"
      ));
      return;
    }

    const embed = await this.prepareEmbed(bitUser, bitData);
    await interaction.reply({ embeds: [embed], ephemeral: true });
  }

  private async prepareEmbed(user: User, data: BitData): Promise<EmbedBuilder> {
    const group = await this.resolveFamily(data.family);

    const familyMentions = group === null
      ? "(failed to load)"
      : `${roleMention(group.roleId)} ${channelMention(group.channelId)}`;

    const lines = [
      `${bold("Name:")} ${data.name}`,
      `${bold("Email:")} ${data.email}`,
      `${bold("Family:")} ${familyMentions}`,
    ];

    const bitRegistryHyperlink = quietHyperlink(
      "bit-byte registry",
      GoogleSheetsClient.idToUrl(env.BIT_DATA_SPREADSHEET_ID),
    );
    const footer = (
      `${EMOJI_INFORMATION} You can view full bits data in the ` +
      `${bitRegistryHyperlink}.`
    );

    const header = userMention(user.id);

    const description = header + "\n" + toBulletedList(lines) + "\n" + footer;

    return new EmbedBuilder()
      .setTitle("Bit-Byte Bit Information")
      .setDescription(description);
  }

  private async resolveFamily(family: string): Promise<BitByteGroup | null> {
    const allGroups = await bitByteService.getAllActiveGroups();
    const upe = channelsService.getUpe();

    const familyId = `${SEASON_ID} ${family}`;
    const role = upe.roles.cache.find(role => role.name === familyId);
    if (role === undefined) {
      console.error(`Failed to find role in server named: ${familyId}`);
      return null;
    }

    const group = allGroups.get(role.id as RoleId)
    if (group === undefined) {
      console.error(
        `Role ${familyId} found in server but is not registered ` +
        "as a bit-byte group this season",
      );
      return null;
    }

    return group;
  }
}

export default new BitLookupCommand();
