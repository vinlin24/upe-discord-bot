import {
  EmbedBuilder,
  roleMention,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type Role,
} from "discord.js";

import type { SlashCommandCheck } from "../../abc/check.abc";
import { SlashCommandHandler } from "../../abc/command.abc";
import {
  Privilege,
  PrivilegeCheck,
} from "../../middleware/privilege.middleware";
import { BitByteGroupModel } from "../../models/bit-byte.model";
import type { RoleId } from "../../types/branded.types";

class DeleteByteGroupCommand extends SlashCommandHandler {
  public override readonly definition = new SlashCommandBuilder()
    .setName("deletebytegroup")
    .setDescription(
      "Delete bit-byte group associated with a Discord role " +
      "(role itself stays).",
    )
    .addRoleOption(input => input
      .setName("group_role")
      .setDescription("Role associated with this bit-byte group.")
      .setRequired(true)
    )
    .toJSON();

  public override readonly checks: SlashCommandCheck[] = [
    new PrivilegeCheck(this).atLeast(Privilege.Administrator),
  ];

  public override async execute(
    interaction: ChatInputCommandInteraction,
  ): Promise<void> {
    const groupRole = interaction.options.getRole("group_role", true) as Role;
    const groupMention = roleMention(groupRole.id);

    const deleted = await this.deleteDocument(groupRole.id as RoleId);
    if (!deleted) {
      await this.replyError(
        interaction,
        `${groupMention} was not registered as a bit-byte group to begin with!`,
      );
      return;
    }

    const successEmbed = new EmbedBuilder()
      .setColor(groupRole.color)
      .setDescription(
        `Deleted the bit-byte group associated with ${groupMention}.`,
      );
    await interaction.reply({ embeds: [successEmbed] });
  }

  private async deleteDocument(roleId: RoleId): Promise<boolean> {
    const result = await BitByteGroupModel.updateOne(
      { roleId },
      { $set: { deleted: true } },
    )
    return result.modifiedCount > 0;
  }
}

export default new DeleteByteGroupCommand();
