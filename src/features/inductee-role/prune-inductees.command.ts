import {
  bold,
  EmbedBuilder,
  inlineCode,
  roleMention,
  SlashCommandBuilder,
  userMention,
  type ChatInputCommandInteraction,
  type GuildMember,
  type Message,
  type User,
} from "discord.js";

import type { SlashCommandCheck } from "../../abc/check.abc";
import { SlashCommandHandler } from "../../abc/command.abc";
import {
  Privilege,
  PrivilegeCheck,
} from "../../middleware/privilege.middleware";
import bitByteService from "../../services/bit-byte.service";
import channelsService from "../../services/channels.service";
import { type UserId } from "../../types/branded.types";
import { toBulletedList } from "../../utils/formatting.utils";
import { INDUCTEES_ROLE_ID } from "../../utils/snowflakes.utils";

export class PruneInducteesCommand extends SlashCommandHandler {
  public override readonly definition = new SlashCommandBuilder()
    .setName("pruneinductees")
    .setDescription(
      "Prune induction roles from members not in any bit-byte group.",
    )
    .addBooleanOption(input => input
      .setName("dry_run")
      .setDescription("Just output a preview of members that would be pruned."),
    )
    .toJSON();

  public override readonly checks: SlashCommandCheck[] = [
    new PrivilegeCheck(this).atLeast(Privilege.Induction),
  ];

  public override async execute(
    interaction: ChatInputCommandInteraction,
  ): Promise<void> {
    const { guild, options } = interaction;

    if (guild === null) {
      await this.replyError(
        interaction,
        "This command can only be used in the UPE server.",
      );
      return;
    }

    const inducteeRole = await guild.roles.fetch(INDUCTEES_ROLE_ID);
    if (inducteeRole === null) {
      const errorMessage
        = `Inductees role (ID: ${inlineCode(INDUCTEES_ROLE_ID)} not found.`;
      await this.replyError(interaction, errorMessage);
      await channelsService.sendDevError(errorMessage, interaction);
      return;
    }

    const dryRun = options.getBoolean("dry_run") ?? false;
    const response = await interaction.deferReply({ fetchReply: true });

    const groups = await bitByteService.getAllActiveGroups();
    const parentedInducteeIds = new Set<UserId>();
    for (const group of groups.values()) {
      const groupRole = await guild.roles.fetch(group.roleId);
      if (groupRole === null) {
        continue;
      }
      for (const member of groupRole.members.values()) {
        parentedInducteeIds.add(member.id as UserId);
      }
    }

    const orphanedInductees: GuildMember[] = [];
    for (const inductee of inducteeRole.members.values()) {
      if (!parentedInducteeIds.has(inductee.id as UserId)) {
        orphanedInductees.push(inductee);
      }
    }

    if (dryRun) {
      const embed = this.formatDryRunEmbed(orphanedInductees);
      await interaction.editReply({ content: "", embeds: [embed] });
      return;
    }

    let firstAckMessage: Message | null = null;
    for (const member of orphanedInductees) {
      const ack = await this.dropInductee(member, interaction.user, response);
      firstAckMessage ??= ack;
    }
    const embed = new EmbedBuilder()
      .setTitle(`${this.id} Done`)
      .setDescription(
        `Pruned ${bold(orphanedInductees.length.toString())} inductees.` +
        (firstAckMessage ? `\nSee: ${firstAckMessage.url}` : "")
      )
    await interaction.editReply({ embeds: [embed] });
  }

  private formatDryRunEmbed(orphanedInductees: GuildMember[]): EmbedBuilder {
    // Prevent overflowing the embed.
    const slicedInductees = orphanedInductees.slice(0, 10);
    const formattedInductees = slicedInductees.map(member =>
      `${userMention(member.id)} (${inlineCode("@" + member.user.username)})`,
    );
    if (slicedInductees.length < orphanedInductees.length) {
      const truncatedAmount = orphanedInductees.length - slicedInductees.length;
      formattedInductees.push(`... (${truncatedAmount} more) ...`);
    }

    const description = (
      `The following ${bold(orphanedInductees.length.toString())} ` +
      `${roleMention(INDUCTEES_ROLE_ID)} do not belong to any bit-byte ` +
      "group and are thus assumed to need pruning:\n" +
      toBulletedList(formattedInductees)
    );

    return new EmbedBuilder()
      .setTitle(`${this.id} Dry Run`)
      .setDescription(description);
  }

  /**
   * Remove the induction roles from the inductee user and stream an
   * acknowledgement embed to the logs channel. Return the acknowledgement
   * message.
   */
  private async dropInductee(
    member: GuildMember,
    actor: User,
    interactionResponse: Message,
  ): Promise<Message | null> {
    const rolesToRemove = [INDUCTEES_ROLE_ID];

    const group = await bitByteService.determineGroup(member);
    if (group !== null) {
      rolesToRemove.push(group.roleId);
    }

    await member.roles.remove(
      rolesToRemove,
      `${this.id} by @${actor.username}`,
    );

    const logSink = channelsService.getLogSink()
    if (logSink == null) {
      return null;
    }

    const description = (
      `${userMention(actor.id)} removed ` +
      `${rolesToRemove.map(roleMention).join(", ")} ` +
      `from ${userMention(member.id)}.`
    )
    const embed = new EmbedBuilder()
      .setTitle(`${this.id}: Inductee Roles Updated`)
      .setDescription(description);
    return await logSink.send({
      content: interactionResponse.url,
      embeds: [embed],
    });
  }
}

export default new PruneInducteesCommand();
