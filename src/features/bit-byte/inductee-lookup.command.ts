import {
  bold,
  Collection,
  EmbedBuilder,
  inlineCode,
  roleMention,
  SlashCommandBuilder,
  userMention,
  type ChatInputCommandInteraction,
  type GuildMember,
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
  type InducteeData,
} from "../../services/inductee-sheets.service";
import { EMOJI_WARNING } from "../../utils/emojis.utils";
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

    if (inducteeMember === null) {
      await this.replyError(
        interaction,
        "That doesn't seem to be a server member.",
      );
      return;
    }

    const inductees = await sheetsService.getAllData();

    const { username } = inducteeMember.user;
    const inducteeData = inductees.get(username);
    if (inducteeData === undefined) {
      await this.replyError(
        interaction,
        `${userMention(inducteeMember.id)} doesn't seem to be a registered ` +
        `inductee (searched with username ${inlineCode(username)}).`,
      );
      return;
    }

    const embed = await this.prepareEmbed(inducteeMember, inducteeData);
    await interaction.reply({ embeds: [embed], ephemeral: true });
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
    const { legalName, preferredName, preferredEmail, major } = inducteeData;

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
      lines.push(`${bold("Group:")} <pending assignment> ${EMOJI_WARNING}`);
    }
    else {
      lines.push(`${bold("Group:")} ${roleMention(groupRole.id)}`);
    }

    const mention = inducteeMember === null
      ? (inlineCode(`@${inducteeData.discordUsername}`) + " (not in server)")
      : userMention(inducteeMember.id);

    const description = mention + "\n" + toBulletedList(lines.filter(Boolean));

    return new EmbedBuilder()
      .setColor(groupRole?.color ?? null)
      .setTitle("Inductee Information")
      .setDescription(description);
  }
}

export default new InducteeLookupCommand();
