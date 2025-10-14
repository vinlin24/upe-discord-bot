import {
  channelMention,
  EmbedBuilder,
  roleMention,
  userMention,
  type ChatInputCommandInteraction,
  type GuildMember,
  type Role,
} from "discord.js";

import { SlashCommandHandler } from "../../abc/command.abc";
import bitByteService from "../../services/bit-byte.service";
import type { RoleId } from "../../types/branded.types";
import { toBulletedList } from "../../utils/formatting.utils";
import { ExtendedSlashCommandBuilder } from "../../utils/options.utils";
import { BYTE_ROLE_ID } from "../../utils/snowflakes.utils";

class ListByteGroupCommand extends SlashCommandHandler {
  public override readonly definition = new ExtendedSlashCommandBuilder()
    .setName("listbytegroup")
    .setDescription("Show information about a bit-byte group(s).")
    .addRoleOption(input => input
      .setName("group_role")
      .setDescription("Custom role for this bit-byte group (omit to list all).")
    )
    .addBroadcastOption()
    .toJSON();

  public override async execute(
    interaction: ChatInputCommandInteraction,
  ): Promise<void> {
    const groupRole = interaction.options.getRole("group_role") as Role | null;
    const broadcast = interaction.options.getBoolean("broadcast");

    if (groupRole === null) {
      const embed = await this.processListAllOption(interaction);
      await interaction.reply({ embeds: [embed], ephemeral: !broadcast });
      return;
    }

    const group = await bitByteService.getActiveGroup(groupRole.id as RoleId);
    if (group === null) {
      await this.replyError(
        interaction,
        `${roleMention(groupRole.id)} is not registered as a bit-byte group.`,
      )
      return;
    }

    const [bytes, bits] = this.partitionBytesAndBits(groupRole);

    const roleLine = `Role: ${roleMention(group.roleId)}`;
    const channelLine = `Channel: ${channelMention(group.channelId)}`;
    const bytesLine = (
      `${bytes.length} ${roleMention(BYTE_ROLE_ID)}: ` +
      `${this.formatMentionList(bytes)}`
    );
    const bitsLine = `${bits.length} bits: ${this.formatMentionList(bits)}`;
    const eventsLine = `${group.events.length} events completed`;
    const pointsLine
      = `Points: ${bitByteService.calculateBitByteGroupPoints(group)}`;

    const description = toBulletedList(
      [roleLine, channelLine, bytesLine, bitsLine, eventsLine, pointsLine],
    );
    const embed = new EmbedBuilder()
      .setTitle("Bit-Byte Group")
      .setDescription(description);
    await interaction.reply({ embeds: [embed], ephemeral: !broadcast });
  }

  private async processListAllOption(
    interaction: ChatInputCommandInteraction,
  ): Promise<EmbedBuilder> {
    const allGroups = await bitByteService.getAllActiveGroups();

    const lines: string[] = [];

    for (const { roleId, channelId } of allGroups.values()) {
      const role = interaction.guild!.roles.cache.get(roleId);
      if (role === undefined) {
        console.warn(
          `Non-existing role ${roleId} still associated with a bit-byte group.`,
        );
        continue;
      }

      const [bytes, bits] = this.partitionBytesAndBits(role);
      lines.push(
        `${roleMention(roleId)} ${channelMention(channelId)} ` +
        `(${bytes.length} bytes, ${bits.length} bits)`,
      );
    }

    const description = toBulletedList(lines) || "There seem to be none yet!";
    return new EmbedBuilder()
      .setTitle("All Bit-Byte Groups")
      .setDescription(description);
  }

  private partitionBytesAndBits(
    role: Role,
  ): [bytes: GuildMember[], bits: GuildMember[]] {
    const bytes: GuildMember[] = [];
    const bits: GuildMember[] = [];
    for (const member of role.members.values()) {
      if (member.roles.cache.has(BYTE_ROLE_ID)) {
        bytes.push(member);
      }
      else {
        bits.push(member);
      }
    }
    return [bytes, bits];
  }

  private formatMentionList(members: GuildMember[]): string {
    return members.map(member => userMention(member.id)).join(", ");
  }
}

export default new ListByteGroupCommand();
