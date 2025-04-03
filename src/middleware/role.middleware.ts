import {
  roleMention,
  type ChatInputCommandInteraction,
  type GuildMember,
} from "discord.js";

import { SlashCommandCheck } from "../abc/check.abc";
import type { RoleId } from "../types/branded.types";
import { makeErrorEmbed } from "../utils/errors.utils";

export class RoleCheck extends SlashCommandCheck {
  private roleId: RoleId | null = null;

  public override predicate(interaction: ChatInputCommandInteraction) {
    const member = interaction.member as GuildMember;
    if (this.roleId === null) {
      return { pass: true }; // Vacuously pass.
    }
    return { pass: member.roles.cache.has(this.roleId) };
  }

  public override async onFail(
    _: any,
    interaction: ChatInputCommandInteraction,
  ): Promise<void> {
    const embed = makeErrorEmbed(
      `You must have the ${roleMention(this.roleId!)} role ` +
      "to run this command!",
    );
    await this.safeReply(interaction, {
      embeds: [embed],
      ephemeral: true,
    });
  }

  public has(roleId: RoleId): this {
    this.roleId = roleId;
    return this;
  }
}
