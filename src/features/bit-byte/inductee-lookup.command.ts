import {
  bold,
  Collection,
  EmbedBuilder,
  inlineCode,
  roleMention,
  SlashCommandBuilder,
  userMention,
  type ApplicationCommandOptionChoiceData,
  type AutocompleteInteraction,
  type ChatInputCommandInteraction,
  type GuildMember,
  type GuildMemberManager,
  type Role,
} from "discord.js";

import type { SlashCommandCheck } from "../../abc/check.abc";
import { SlashCommandHandler } from "../../abc/command.abc";
import {
  Privilege,
  PrivilegeCheck,
} from "../../middleware/privilege.middleware";
import sheetsService, {
  type InducteeData,
} from "../../services/inductee-sheets.service";
import { EMOJI_WARNING } from "../../utils/emojis.utils";
import { toBulletedList } from "../../utils/formatting.utils";
import { AUTOCOMPLETE_MAX_CHOICES } from "../../utils/limits.utils";
import { determineGroup } from "./bit-byte.utils";

class InducteeLookupCommand extends SlashCommandHandler {
  public override readonly definition = new SlashCommandBuilder()
    .setName("inductee")
    .setDescription("Look up information about an inductee.")
    .addStringOption(input => input
      .setName("inductee")
      .setDescription("Inductee user to request data for.")
      .setRequired(true)
      .setAutocomplete(true),
    )
    .toJSON();

  public override readonly checks: SlashCommandCheck[] = [
    new PrivilegeCheck(this).atLeast(Privilege.Officer),
  ];

  private readonly groupRoleCache = new Collection<string, Role>();

  public override async execute(
    interaction: ChatInputCommandInteraction,
  ): Promise<void> {
    const inducteeUsername = interaction.options.getString("inductee", true);

    const inductees = await sheetsService.getAllData();
    const inducteeData = inductees.get(inducteeUsername);
    if (inducteeData === undefined) {
      await this.replyError(
        interaction,
        "No registered inductee found with username " +
        `${inlineCode(inducteeUsername)}!`,
      );
      return;
    }

    const inducteeMember = await this.getMember(
      interaction.guild!.members,
      inducteeUsername,
    );

    const embed = await this.prepareEmbed(inducteeMember, inducteeData);
    await interaction.reply({ embeds: [embed], ephemeral: true });
  }

  public override async autocomplete(
    interaction: AutocompleteInteraction,
  ): Promise<void> {
    let focusedValue = interaction.options.getFocused();
    // Normalize to username alone, which is what we store usernames as.
    if (focusedValue.startsWith("@")) {
      focusedValue = focusedValue.slice(1);
    }

    // Don't force cache update every time, for performance.
    const inductees = await sheetsService.getAllData(false);

    const allUsernames = Array.from(inductees.keys());
    const choices: ApplicationCommandOptionChoiceData[] = allUsernames
      .filter(username => username.startsWith(focusedValue))
      .slice(0, AUTOCOMPLETE_MAX_CHOICES)
      .map(username => ({ name: `@${username}`, value: username }));

    await interaction.respond(choices);
  }

  private async getMember(
    members: GuildMemberManager,
    username: string,
  ): Promise<GuildMember | null> {
    const result = await members.fetch({ query: username, limit: 1 });
    const [member] = result.values();
    return member ?? null;
  }

  private async determineGroup(member: GuildMember): Promise<Role | null> {
    let groupRole = this.groupRoleCache.get(member.user.username);
    if (groupRole !== undefined) {
      return groupRole;
    }

    const group = await determineGroup(member);
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
      ? await this.determineGroup(inducteeMember)
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
