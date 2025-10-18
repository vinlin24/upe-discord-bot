import {
  channelMention,
  Colors,
  EmbedBuilder,
  inlineCode,
  roleMention,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type ColorResolvable,
  type GuildBasedChannel,
  type GuildMember,
  type HexColorString,
  type Role,
} from "discord.js";

import type { SlashCommandCheck } from "../../abc/check.abc";
import { SlashCommandHandler } from "../../abc/command.abc";
import { RoleCheck } from "../../middleware/role.middleware";
import bitByteService from "../../services/bit-byte.service";
import { makeErrorEmbed } from "../../utils/errors.utils";
import { CHANNEL_TOPIC_LIMIT } from "../../utils/limits.utils";
import { BYTE_ROLE_ID } from "../../utils/snowflakes.utils";

class CustomizeGroupCommand extends SlashCommandHandler {
  public override readonly definition = new SlashCommandBuilder()
    .setName("customizebytegroup")
    .setDescription("Customize your byte group role/channel!")
    .addStringOption(input => input
      .setName("role_hex_color")
      .setDescription(
        "Hex color for your role (e.g. #3067d3) or 'reset' to reset",
      ),
    )
    .addStringOption(input => input
      .setName("channel_topic")
      .setDescription("Description of your channel"),
    )
    .toJSON();

  public override readonly checks: SlashCommandCheck[] = [
    new RoleCheck(this).has(BYTE_ROLE_ID),
  ];

  public override async execute(
    interaction: ChatInputCommandInteraction,
  ): Promise<void> {
    const caller = interaction.member as GuildMember;

    const roleHexColor = interaction.options.getString("role_hex_color");
    const channelTopic = interaction.options.getString("channel_topic");

    if (roleHexColor === null && channelTopic === null) {
      await interaction.reply({ content: "Nothing to do!", ephemeral: true });
      return;
    }

    const group = await bitByteService.determineGroup(caller);
    if (group === null) {
      await this.replyError(
        interaction,
        "You don't seem to be assigned to a bit-byte group!",
      );
      return;
    }

    const responseEmbeds: EmbedBuilder[] = [];
    let anySuccess = false;

    if (roleHexColor !== null) {
      const groupRole = interaction.guild!.roles.cache.get(group.roleId);
      const [success, responseEmbed] = await this.handleRoleColorChange(
        groupRole,
        roleHexColor,
        caller,
      );
      responseEmbeds.push(responseEmbed);
      if (success) {
        anySuccess = true;
      }
    }

    if (channelTopic !== null) {
      const channel = interaction.guild!.channels.cache.get(group.channelId);
      const [success, responseEmbed] = await this.handleChannelTopicChange(
        channel,
        channelTopic,
        caller,
      );
      responseEmbeds.push(responseEmbed);
      if (success) {
        anySuccess = true;
      }
    }

    await interaction.reply({
      embeds: responseEmbeds,
      ephemeral: !anySuccess,
    });
  }

  private async handleRoleColorChange(
    groupRole: Role | undefined,
    roleHexColor: string,
    caller: GuildMember,
  ): Promise<[success: boolean, responseEmbed: EmbedBuilder]> {
    if (groupRole === undefined) {
      return [false, makeErrorEmbed(
        "The role associated with your bit-byte group doesn't seem to " +
        "exist anymore!",
      )];
    }

    const validatedColorString = this.validateColorString(roleHexColor);
    if (validatedColorString === null) {
      return [false, makeErrorEmbed(
        `Invalid hex color ${inlineCode(roleHexColor)}!`,
      )];
    }

    groupRole = await groupRole.edit({
      color: validatedColorString,
      reason: `${this.id} by @${caller.user.username}`,
    });

    const description = validatedColorString === "Default"
      ? `Reset ${roleMention(groupRole.id)}'s role color!`
      : (`Set ${roleMention(groupRole.id)}'s role color to ` +
        `${inlineCode(validatedColorString as HexColorString)}!`);

    return [true, new EmbedBuilder()
      .setColor(validatedColorString)
      .setDescription(description),
    ];
  }

  private async handleChannelTopicChange(
    channel: GuildBasedChannel | undefined,
    topic: string,
    caller: GuildMember,
  ): Promise<[success: boolean, responseEmbed: EmbedBuilder]> {
    if (channel === undefined) {
      return [false, makeErrorEmbed(
        "The channel associated with your bit-byte group doesn't seem to " +
        `exist anymore!`,
      )];
    }

    if (topic.length > CHANNEL_TOPIC_LIMIT) {
      return [false, makeErrorEmbed(
        "Your provided topic exceeds the maximum characters allowed " +
        `(${CHANNEL_TOPIC_LIMIT}) for a channel topic!`,
      )];
    }

    channel = await channel.edit({
      topic,
      reason: `${this.id} by @${caller.user.username}`,
    });

    const description = (
      `Set ${channelMention(channel.id)}'s topic to:\n\n${topic}`
    );
    return [true, new EmbedBuilder()
      .setColor(Colors.Green)
      .setDescription(description),
    ];
  }

  private validateColorString(hexColor: string): ColorResolvable | null {
    hexColor = hexColor.trim().toLowerCase();
    if (hexColor === "reset") {
      return "Default";
    }
    const isValid = /^#?[0-9a-f]{6}$/.test(hexColor);
    if (!isValid) {
      return null;
    }
    if (hexColor.startsWith("#")) {
      return hexColor as HexColorString;
    }
    return `#${hexColor}`;
  }
}

export default new CustomizeGroupCommand();
