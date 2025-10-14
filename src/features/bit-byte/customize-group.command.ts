import {
  channelMention,
  EmbedBuilder,
  inlineCode,
  roleMention,
  SlashCommandBuilder,
  time,
  TimestampStyles,
  type ChatInputCommandInteraction,
  type GuildMember,
} from "discord.js";

import type { SlashCommandCheck } from "../../abc/check.abc";
import { SlashCommandHandler } from "../../abc/command.abc";
import { RoleCheck } from "../../middleware/role.middleware";
import bitByteService from "../../services/bit-byte.service";
import channelsService from "../../services/channels.service";
import { SystemDateClient, type IDateClient } from "../../utils/date.utils";
import { makeErrorEmbed } from "../../utils/errors.utils";
import { normalizeChannelName } from "../../utils/formatting.utils";
import { ROLE_NAME_MAX_LENGTH } from "../../utils/limits.utils";
import { BYTE_ROLE_ID } from "../../utils/snowflakes.utils";

/** @deprecated We're better off standardizing the byte group roles. */
class CustomizeGroupCommand extends SlashCommandHandler {
  public override readonly shouldRegister = false;

  public override readonly definition = new SlashCommandBuilder()
    .setName("customizebytegroup")
    .setDescription("Customize your byte group!")
    .addStringOption(input => input
      .setName("group_name")
      .setDescription("Name of the bit-byte group.")
    )
    // TODO: Also support setting color and topic.
    .toJSON();

  public override readonly checks: SlashCommandCheck[] = [
    new RoleCheck(this).has(BYTE_ROLE_ID),
  ];

  public constructor(private readonly dateClient: IDateClient) { super(); }

  public override async execute(
    interaction: ChatInputCommandInteraction,
  ): Promise<void> {
    const caller = interaction.member as GuildMember;
    const groupName = interaction.options.getString("group_name");

    if (!groupName) {
      await interaction.reply({ content: "Nothing to do!", ephemeral: true });
      return;
    }
    if (groupName.length > ROLE_NAME_MAX_LENGTH) {
      await interaction.reply({
        embeds: [makeErrorEmbed(
          `The name ${inlineCode(groupName)} is too long!`,
        )],
        ephemeral: true,
      });
      return;
    }

    let progressString = "";

    progressString += `Fetching your group... (${this.ago()})`;
    await interaction.reply({ content: progressString });
    const group = await bitByteService.determineGroup(caller);
    if (group === null) {
      await interaction.editReply({
        embeds: [makeErrorEmbed(
          "You don't seem to be assigned to a bit-byte group!",
        )],
      });
      return;
    }

    progressString += `\nRenaming your group's role... (${this.ago()})`;
    await interaction.editReply({ content: progressString });
    let groupRole = interaction.guild!.roles.cache.get(group.roleId);
    if (groupRole === undefined) {
      await interaction.editReply({
        embeds: [makeErrorEmbed(
          "The role associated with your bit-byte group doesn't seem to " +
          `exist anymore! (ID: ${inlineCode(group.roleId)})`,
        )],
      });
      return;
    }
    groupRole = await groupRole.edit({ name: groupName });

    progressString += `\nRenaming your group's channel... (${this.ago()})`;
    await interaction.editReply({ content: progressString });
    let channel = interaction.guild!.channels.cache.get(group.channelId);
    if (channel === undefined) {
      await interaction.editReply({
        embeds: [makeErrorEmbed(
          "The channel associated with your bit-byte group doesn't seem to " +
          `exist anymore! (ID: ${inlineCode(group.channelId)})`,
        )],
      });
      return;
    }
    channel = await channel.edit({ name: normalizeChannelName(groupName) });

    const embed = new EmbedBuilder()
      .setTitle("Bit-Byte Group Updated")
      .setDescription(
        `Updated your role name to ${inlineCode(groupRole.name)} ` +
        `(${roleMention(groupRole.id)}) and channel name to ` +
        `${inlineCode(channel.name)} (${channelMention(channel.id)}).`
      );

    // TODO: Maybe create a helper for this pattern of reply + log.
    const message = await interaction.editReply({
      content: "",
      embeds: [embed],
    });
    await channelsService.getLogSink()?.send({
      content: `See: ${message.url}`,
      embeds: [embed],
    });
  }

  // TODO: This helper is getting kind of repetitive.
  private ago() {
    return time(this.dateClient.getNow(), TimestampStyles.RelativeTime);
  }
}

export default new CustomizeGroupCommand(new SystemDateClient());
