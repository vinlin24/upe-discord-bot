import {
  channelMention,
  ChannelType,
  EmbedBuilder,
  inlineCode,
  PermissionFlagsBits,
  PermissionsBitField,
  roleMention,
  SlashCommandBuilder,
  time,
  TimestampStyles,
  type CategoryChannel,
  type ChatInputCommandInteraction,
  type Guild,
  type GuildTextBasedChannel,
  type Role,
} from "discord.js";

import type { SlashCommandCheck } from "../../abc/check.abc";
import { SlashCommandHandler } from "../../abc/command.abc";
import { BotPermissionCheck } from "../../middleware/bot-permission.middleware";
import {
  Privilege,
  PrivilegeCheck,
} from "../../middleware/privilege.middleware";
import channelsService from "../../services/channels.service";
import type { ChannelId, RoleId } from "../../types/branded.types";
import { SystemDateClient, type IDateClient } from "../../utils/date.utils";
import { makeErrorEmbed } from "../../utils/errors.utils";
import { ROLE_NAME_MAX_LENGTH } from "../../utils/limits.utils";
import {
  INDUCTEES_ROLE_ID,
  INDUCTION_AND_MEMBERSHIP_ROLE_ID,
  UPE_BOT_ROLE_ID,
} from "../../utils/snowflakes.utils";
import { BitByteGroupModel, type BitByteGroup } from "./bit-byte.model";
import { BIT_BYTE_CATEGORY_NAME } from "./bit-byte.utils";

class CreateByteGroupCommand extends SlashCommandHandler {
  public override readonly definition = new SlashCommandBuilder()
    .setName("createbytegroup")
    .setDescription(
      "Create a bit-byte group and its associated role & channel.",
    )
    .addStringOption(input => input
      .setName("role_name")
      .setDescription("Initial name for the group role (can be changed later).")
      .setMaxLength(ROLE_NAME_MAX_LENGTH)
      .setRequired(true),
    )
    .addRoleOption(input => input
      .setName("existing_role")
      .setDescription("Existing role to restore a delete group.")
    )
    .toJSON();

  public override readonly checks: SlashCommandCheck[] = [
    new PrivilegeCheck(this).atLeast(Privilege.Induction),
    new BotPermissionCheck(this)
      // TODO: It could be nice to pass in a comment/explanation with each
      // permission so the check onFail can describe why it's needed.
      .needsToHave(PermissionFlagsBits.ManageRoles)
      .needsToHave(PermissionFlagsBits.ManageChannels)
      .needsToHave(PermissionFlagsBits.ManageMessages), // For pinning.
  ];

  public constructor(private readonly dateClient: IDateClient) { super(); }

  public override async execute(
    interaction: ChatInputCommandInteraction,
  ): Promise<void> {
    const initialRoleName = interaction.options.getString("role_name", true);
    const existingRole = interaction.options.getRole(
      "existing_role",
    ) as Role | null;
    const guild = interaction.guild as Guild;

    let progressString = "";

    if (existingRole !== null) {
      const group = await this.restoreDocument(existingRole.id as RoleId);
      await this.acknowledgeRestored(interaction, existingRole, group);
      return;
    }

    progressString += `Locating ${BIT_BYTE_CATEGORY_NAME}... (${this.ago()})`;
    await interaction.reply(progressString);
    const bitByteCategory = await this.getBitByteCategory(
      guild,
      BIT_BYTE_CATEGORY_NAME,
    );
    if (bitByteCategory === null) {
      await interaction.editReply({
        embeds: [makeErrorEmbed(
          `Couldn't find the ${BIT_BYTE_CATEGORY_NAME} category! ` +
          "Please create it first.",
        )],
      });
      return;
    }

    progressString += `\nCreating role for the group... (${this.ago()})`;
    await interaction.editReply(progressString);
    const groupRole = await this.createGroupRole(guild, initialRoleName);
    if (groupRole === null) {
      await interaction.editReply({
        embeds: [makeErrorEmbed(
          `A role with the name ${inlineCode(initialRoleName)} ` +
          "already exists! Please choose a different name.",
        )],
      });
      return;
    }

    progressString += `\nCreating channel for the group... (${this.ago()})`;
    await interaction.editReply(progressString);
    const groupChannel = await this.createGroupChannel(
      bitByteCategory,
      groupRole,
    );

    progressString += `\nSaving group details to database... (${this.ago()})`;
    await interaction.editReply(progressString);
    const group = await this.insertDocument(
      groupRole.id as RoleId,
      groupChannel.id as ChannelId,
    );

    await this.finalAcknowledge(interaction, group);
  }

  /** Return whether a new document was created (upserted). */
  private async insertDocument(
    roleId: RoleId,
    channelId: ChannelId,
  ): Promise<BitByteGroup> {
    // Use upsert instead of raw create to handle the case where a group was
    // marked as deleted (now it is no longer orphaned).
    const document = await BitByteGroupModel.findOneAndUpdate(
      { roleId },
      { $set: { channelId, deleted: false } },
      { upsert: true, returnNewDocument: true },
    )
    return document!;
  }

  private async restoreDocument(roleId: RoleId): Promise<BitByteGroup | null> {
    return await BitByteGroupModel.findOneAndUpdate(
      { roleId },
      { $set: { deleted: false } },
    );
  }

  private async getBitByteCategory(
    guild: Guild,
    expectedName: string,
  ): Promise<CategoryChannel | null> {
    const filteredCategories = guild.channels.cache
      .filter(channel => channel.name === expectedName)
      .filter(channel => channel.type === ChannelType.GuildCategory);
    return (filteredCategories.first() as CategoryChannel) ?? null;
  }

  /**
   * Return `null` if a role with the given name already exists. Just to avoid
   * headaches during the setup process.
   */
  private async createGroupRole(
    guild: Guild,
    initialRoleName: string,
  ): Promise<Role | null> {
    const roleWithSameName = guild.roles.cache
      .filter(role => role.name === initialRoleName)
      .first();
    if (roleWithSameName !== undefined) {
      return null;
    }

    const inducteesRole = guild.roles.cache.get(INDUCTEES_ROLE_ID)!;

    return await guild.roles.create({
      name: initialRoleName,
      hoist: true,
      mentionable: true,
      position: inducteesRole.position, // Just above it.
      permissions: [], // Vanity.
    });
  }

  private async createGroupChannel(
    category: CategoryChannel,
    groupRole: Role,
  ): Promise<GuildTextBasedChannel> {
    const channel = await category.children.create({
      type: ChannelType.GuildText,
      name: this.normalizeChannelName(groupRole.name),
      reason: `Created as part of ${this.id}`,
      // Ref: https://discordjs.guide/popular-topics/permissions.html
      permissionOverwrites: [
        {
          id: category.guildId, // @everyone
          deny: [PermissionsBitField.Flags.ViewChannel],
        },
        {
          id: INDUCTION_AND_MEMBERSHIP_ROLE_ID,
          allow: [PermissionsBitField.Flags.ViewChannel],
        },
        {
          id: UPE_BOT_ROLE_ID,
          allow: [PermissionsBitField.Flags.ViewChannel],
        },
        {
          id: groupRole.id,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.MentionEveryone,
          ],
        },
      ],
    });

    const message = await channel.send({
      embeds: [new EmbedBuilder()
        .setTitle("Bit-Byte Group Channel Created")
        .setDescription(
          "Welcome to the channel just for your byte group " +
          `${roleMention(groupRole.id)}!`,
        ),
      ],
    });
    await message.pin(`As part of creating #${channel.name} by ${this.id}`);

    return channel;
  }

  private async finalAcknowledge(
    interaction: ChatInputCommandInteraction,
    group: BitByteGroup,
    restored: boolean = false,
  ): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle("Bit-Byte Group " + restored ? "Restored" : "Created")
      .setDescription(
        `Group is tied to the role ${roleMention(group.roleId)} ` +
        `(ID: ${inlineCode(group.roleId)}) and its associated channel ` +
        `${channelMention(group.channelId)}.`,
      );

    const message = interaction.replied
      ? await interaction.editReply({ embeds: [embed] })
      : await interaction.reply({ embeds: [embed], fetchReply: true });

    await channelsService.getLogSink()?.send({
      content: `From: ${message.url}`,
      embeds: [embed],
    });
  }

  private async acknowledgeRestored(
    interaction: ChatInputCommandInteraction,
    existingRole: Role,
    group: BitByteGroup | null,
  ): Promise<void> {
    if (group !== null) {
      await this.finalAcknowledge(interaction, group, true);
      return;
    }
    await interaction.reply({
      embeds: [makeErrorEmbed(
        "Could not find any bit-byte group associated with " +
        `${roleMention(existingRole.id)} in our records. ` +
        "You should just create a new group.",
      )],
      ephemeral: true,
    });
    return;
  }

  // NOTE: Not sure if the API automatically does this for us, but I'm too lazy
  // to find out manually.
  private normalizeChannelName(name: string): string {
    return (name
      .toLowerCase()
      .replaceAll(" ", "-") // Spaces become '-'s.
      .replaceAll(/[^0-9a-z_-]/, "") // Only alphanumeric & '-' & '_' allowed.
      .replaceAll("--", "-") // No consecutive '-'s.
    );
  }

  private ago() {
    return time(this.dateClient.getNow(), TimestampStyles.RelativeTime);
  }
}

export default new CreateByteGroupCommand(new SystemDateClient());
