import {
  bold,
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

/** @deprecated As of F25, bit-byte no longer has a leaderboard/prize system. */
class SubmitJeopardyCommand extends SlashCommandHandler {
  public override readonly shouldRegister = false;

  public override readonly definition = new SlashCommandBuilder()
    .setName("jeopardybitbyte")
    .setDescription("Submit the jeopardy event for a bit-byte group.")
    .addIntegerOption(input => input
      .setName("points")
      .setDescription("Curved points for the event.")
      .setRequired(true)
      .setMinValue(0),
    )
    .addRoleOption(input => input
      .setName("group_role")
      .setDescription("Role associated with the bit-byte group to submit for.")
      .setRequired(true),
    )
    .toJSON();

  public override readonly checks: SlashCommandCheck[] = [
    new PrivilegeCheck(this).atLeast(Privilege.Induction),
  ];

  public override async execute(
    interaction: ChatInputCommandInteraction,
  ): Promise<void> {
    const points = interaction.options.getInteger("points", true);
    const groupRole = interaction.options.getRole("group_role", true) as Role;

    const updated = await this.setJeopardyPoints(
      groupRole.id as RoleId,
      points,
    );
    if (!updated) {
      await this.replyError(
        interaction,
        `${roleMention(groupRole.id)} is not registered as a bit-byte group!`,
      );
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle("Bit-Byte Jeopardy Submitted")
      .setDescription(
        `Submitted ${bold(points.toString())} points ` +
        `for ${roleMention(groupRole.id)}!`,
      );
    await interaction.reply({ embeds: [embed] });
  }

  private async setJeopardyPoints(
    roleId: RoleId,
    points: number,
  ): Promise<boolean> {
    const result = await BitByteGroupModel.updateOne(
      { roleId },
      { $set: { jeopardyPoints: points } },
    );
    return result.matchedCount > 0;
  }
}

export default new SubmitJeopardyCommand();
