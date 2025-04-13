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
import type { RoleId } from "../../types/branded.types";
import { toBulletedList } from "../../utils/formatting.utils";
import { ExtendedSlashCommandBuilder } from "../../utils/options.utils";
import { BYTE_ROLE_ID, INDUCTEES_ROLE_ID } from "../../utils/snowflakes.utils";
import { BitByteGroupModel, type BitByteGroup } from "./bit-byte.model";
import { calculateBitByteGroupPoints } from "./bit-byte.utils";

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

    const group = await this.readDocument(groupRole.id as RoleId);
    if (group === null) {
      await this.replyError(
        interaction,
        `${roleMention(groupRole.id)} is not registered as a bit-byte group.`,
      )
      return;
    }

    const bytes = this.getMembersAlsoHaving(groupRole, BYTE_ROLE_ID);
    const inductees = this.getMembersAlsoHaving(groupRole, INDUCTEES_ROLE_ID);

    const roleLine = `Role: ${roleMention(group.roleId)}`;
    const channelLine = `Channel: ${channelMention(group.channelId)}`;
    const bytesLine = (
      `${bytes.length} ${roleMention(BYTE_ROLE_ID)}: ` +
      `${this.formatMentionList(bytes)}`
    );
    const inducteesLine = (
      `${inductees.length} ${roleMention(INDUCTEES_ROLE_ID)}: ` +
      `${this.formatMentionList(inductees)}`
    );
    const eventsLine = `${group.events.length} events completed`;
    const pointsLine = `Points: ${calculateBitByteGroupPoints(group)}`;

    const description = toBulletedList(
      [roleLine, channelLine, bytesLine, inducteesLine, eventsLine, pointsLine],
    );
    const embed = new EmbedBuilder()
      .setTitle("Bit-Byte Group")
      .setDescription(description);
    await interaction.reply({ embeds: [embed], ephemeral: !broadcast });
  }

  private async processListAllOption(
    interaction: ChatInputCommandInteraction,
  ): Promise<EmbedBuilder> {
    const allGroups = await this.readAllDocuments();

    const lines: string[] = [];

    for (const { roleId, channelId } of allGroups) {
      const role = interaction.guild!.roles.cache.get(roleId);
      if (role === undefined) {
        console.warn(
          `Non-existing role ${roleId} still associated with a bit-byte group.`,
        );
        continue;
      }
      const bytes = this.getMembersAlsoHaving(role, BYTE_ROLE_ID);
      const inductees = this.getMembersAlsoHaving(role, INDUCTEES_ROLE_ID);
      // TODO: Also include point information.
      lines.push(
        `${roleMention(roleId)} ${channelMention(channelId)} ` +
        `(${bytes.length} bytes, ${inductees.length} bits)`,
      );
    }

    const description = toBulletedList(lines) || "There seem to be none yet!";
    return new EmbedBuilder()
      .setTitle("All Bit-Byte Groups")
      .setDescription(description);
  }

  private async readAllDocuments(): Promise<BitByteGroup[]> {
    return await BitByteGroupModel.find();
  }

  private async readDocument(roleId: RoleId): Promise<BitByteGroup | null> {
    return await BitByteGroupModel.findOne({ roleId });
  }

  private getMembersAlsoHaving(role: Role, otherRoleId: RoleId): GuildMember[] {
    const bytesCollection = role.members
      .filter(member => member.roles.cache.has(otherRoleId));
    return Array.from(bytesCollection.values());
  }

  private formatMentionList(members: GuildMember[]): string {
    return members.map(member => userMention(member.id)).join(", ");
  }
}

export default new ListByteGroupCommand();
