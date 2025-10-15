import {
  bold,
  Collection,
  EmbedBuilder,
  inlineCode,
  PermissionFlagsBits,
  roleMention,
  SlashCommandBuilder,
  userMention,
  type ChatInputCommandInteraction,
  type GuildMember,
  type GuildTextBasedChannel,
  type Role,
} from "discord.js";

import type { SlashCommandCheck } from "../../abc/check.abc";
import { SlashCommandHandler } from "../../abc/command.abc";
import {
  Privilege,
  PrivilegeCheck,
} from "../../middleware/privilege.middleware";
import bitByteService from "../../services/bit-byte.service";
import sheetsService, {
  InducteeStatus,
  type InducteeData,
} from "../../services/inductee-sheets.service";
import type { UserId } from "../../types/branded.types";
import { EMOJI_CHECK, EMOJI_WARNING } from "../../utils/emojis.utils";
import { makeErrorEmbed } from "../../utils/errors.utils";
import { toBulletedList } from "../../utils/formatting.utils";

class InducteeLookupCommand extends SlashCommandHandler {
  public override readonly definition = new SlashCommandBuilder()
    .setName("inductee")
    .setDescription("Look up information about an inductee.")
    .addUserOption(input => input
      .setName("inductee")
      .setDescription("Inductee user to request data for.")
      .setRequired(true),
    )
    .addBooleanOption(input => input
      .setName("broadcast")
      .setDescription("[PRIVATE CHANNEL ONLY] Respond visibly to others.")
    )
    .toJSON();

  public override readonly checks: SlashCommandCheck[] = [
    new PrivilegeCheck(this).atLeast(Privilege.Officer),
  ];

  private readonly groupRoleCache = new Collection<string, Role>();

  public override async execute(
    interaction: ChatInputCommandInteraction,
  ): Promise<void> {
    const inducteeMember = interaction.options.getMember(
      "inductee",
    ) as GuildMember | null;
    const broadcast = !!interaction.options.getBoolean("broadcast");

    if (inducteeMember === null) {
      await this.replyError(
        interaction,
        "That doesn't seem to be a server member.",
      );
      return;
    }

    const inductees = await sheetsService.getAllData();

    const inducteeData = inductees.get(inducteeMember.id as UserId);
    if (inducteeData === undefined) {
      await this.replyError(
        interaction,
        `${userMention(inducteeMember.id)} doesn't seem to be a registered ` +
        `inductee (searched with user ID ${inlineCode(inducteeMember.id)}).`,
      );
      return;
    }

    const embed = await this.prepareEmbed(inducteeMember, inducteeData);
    const embeds = [embed];

    if (broadcast) {
      let ephemeral = false;

      if (!this.canBroadcast(interaction)) {
        embeds.push(makeErrorEmbed(
          "Cannot broadcast inductee data in a public channel. " +
          "Replied ephemerally.",
        ));
        ephemeral = true;
      }

      await interaction.reply({ embeds, ephemeral });
      return;
    }

    await interaction.reply({ embeds, ephemeral: true });
  }

  private async determineGroupCached(
    member: GuildMember,
  ): Promise<Role | null> {
    let groupRole = this.groupRoleCache.get(member.user.username);
    if (groupRole !== undefined) {
      return groupRole;
    }

    const group = await bitByteService.determineGroup(member);
    if (group === null) {
      return null;
    }
    groupRole = member.roles.cache.get(group.roleId);
    if (groupRole === undefined) {
      return null;
    }
    this.groupRoleCache.set(member.user.username, groupRole);
    return groupRole;
  }

  private async prepareEmbed(
    inducteeMember: GuildMember | null,
    inducteeData: InducteeData,
  ): Promise<EmbedBuilder> {
    const {
      status, legalName, preferredName, preferredEmail, major,
    } = inducteeData;

    const lines = [
      `${bold("Name:")} ${legalName}`,
      preferredName ? `${bold("Preferred:")} ${preferredName}` : "",
      `${bold("Major:")} ${major}`,
      `${bold("Contact:")} ${inlineCode(preferredEmail)}`,
    ];

    const groupRole = inducteeMember !== null
      ? await this.determineGroupCached(inducteeMember)
      : null;
    if (groupRole === null) {
      lines.push(`${bold("Bit-Byte:")} (not participating)`);
    }
    else {
      lines.push(`${bold("Bit-Byte:")} ${roleMention(groupRole.id)}`);
    }

    const mention = inducteeMember === null
      ? (inlineCode(userMention(inducteeData.discordId)) + " (not in server)")
      : userMention(inducteeMember.id);

    const statusText = `${status.toUpperCase()} ` + (
      status === InducteeStatus.Active
        ? EMOJI_CHECK
        : EMOJI_WARNING
    );
    const header = `${mention} ${bold(`(${statusText})`)}`;
    const description = header + "\n" + toBulletedList(lines.filter(Boolean));

    return new EmbedBuilder()
      .setColor(groupRole?.color ?? null)
      .setTitle("Inductee Information")
      .setDescription(description);
  }

  private canBroadcast(interaction: ChatInputCommandInteraction): boolean {
    const channel = interaction.channel as GuildTextBasedChannel;
    const isPublicChannel = channel.permissionsFor(channel.guild.roles.everyone)
      .has(PermissionFlagsBits.ViewChannel);
    return !isPublicChannel;
  }
}

export default new InducteeLookupCommand();
