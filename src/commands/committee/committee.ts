import {
  ChatInputCommandInteraction,
  Colors,
  EmbedBuilder,
  GuildMember,
  Role,
  SlashCommandBuilder,
  bold,
} from "discord.js";

import {
  ADVOCACY_ROLE_ID,
  ALUMNI_ROLE_ID,
  ALUM_ROLE_ID,
  CORPORATE_ROLE_ID,
  DESIGN_AND_PUBLICITY_ROLE_ID,
  DIRECTORS_ROLE_ID,
  EMERITUS_ROLE_ID,
  ENTREPRENEURSHIP_ROLE_ID,
  FINANCE_AND_FACILITIES_ROLE_ID,
  INDUCTION_AND_MEMBERSHIP_ROLE_ID,
  INTERNS_ROLE_ID,
  MENTORSHIP_ROLE_ID,
  SOCIAL_ROLE_ID,
  TUTORING_ROLE_ID,
  WEB_ROLE_ID,
} from "../../utils/snowflakes.utils";

module.exports = {
  data: new SlashCommandBuilder()
    .setName("committee")
    .setDescription("List details about a committee within UPE!")
    .addRoleOption(input => input
      .setName("committee_mention")
      .setDescription("Role of the committee to view.")
      .setRequired(true)
    )
    // TODO: Adding a flag for "broadcast"/"hidden" seems like it can be common
    // across different commands, so this addition can be refactored into a
    // helper function if need be.
    .addBooleanOption(input => input
      .setName("broadcast")
      .setDescription("Whether to respond publicly instead of ephemerally.")
    ),
  execute: listCommitteeDetails,
};

type CommitteeName =
  | "Web"
  | "Advocacy"
  | "Design & Publicity"
  | "Finance & Facilities"
  | "Induction & Membership"
  | "Mentorship"
  | "Social"
  | "Tutoring"
  | "Entrepreneurship"
  | "Corporate"
  | "Alumni";

// TODO: Could also add "Exec" as a team type, with President/IVP/EVP as special
// "committees" under it.
type TeamType = "Core" | "Internal" | "External";

type CommitteeData = {
  name: CommitteeName;
  team: TeamType;
  description: string[];
};

type CommitteeJSON = {
  committees: CommitteeData[];
};

const { committees } = require("../../data/committees.json") as CommitteeJSON;

async function listCommitteeDetails(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const role = interaction.options.getRole("committee_mention", true) as Role;
  const broadcast = !!interaction.options.getBoolean("broadcast");

  const committeeData = getCommitteeDataFromRole(role);

  if (!committeeData) {
    const errorEmbed = new EmbedBuilder()
      .setDescription(`The mention ${role} does not correspond to a committee!`)
      .setColor(Colors.Red);
    await interaction.reply({
      embeds: [errorEmbed],
      ephemeral: true,
    });
    return;
  }

  const embed = prepareCommitteeEmbed(role, committeeData);
  await interaction.reply({
    embeds: [embed],
    ephemeral: !broadcast,
  });
}

/**
 * Example embed format:
 *
 * || Tutoring Committee (Internal Team)
 * ||
 * || * Bullet point 1 about the committee's duty/description.
 * || * Bullet point 2 about the committee's duty/description.
 * || * Bullet point 3 about the committee's duty/description.
 * ||
 * || Emeriti:
 * || <mention1>
 * ||
 * || Directors:
 * || <mention1>, <mention2>
 * ||
 * || Chairs:
 * || <mention1>, <mention2>, <mention3>
 * ||
 * || Interns:
 * || <mention1>
 */
function prepareCommitteeEmbed(
  role: Role,
  data: CommitteeData,
): EmbedBuilder {
  // Convert lines of description into a bulleted Markdown list.
  const committeeDescriptionBulletList = data.description
    .map(line => `* ${line}`)
    .join("\n");

  const [emeriti, directors, chairs, interns] = partitionCommittee(role);

  function formatMentions(prefix: string, members: GuildMember[]): string {
    const commaSeparatedMentions = members.join(", ")
    // Return a falsy string to get filtered out when building the embed body.
    // This way, titles that have no members are omitted entirely instead of
    // having a bunch of awkward "(none)"s or similar.
    if (!commaSeparatedMentions) return "";
    return `${bold(prefix)}\n${commaSeparatedMentions}`;
  }

  const embedBody = [
    committeeDescriptionBulletList || "No description provided...",
    formatMentions("🎓 Emeriti:", emeriti),
    formatMentions("📢 Directors:", directors),
    formatMentions("🫡 Chairs:", chairs),
    formatMentions("🐣 Interns:", interns),
  ].filter(Boolean).join("\n\n");

  const embed = new EmbedBuilder()
    .setTitle(`${data.name} Committee (${data.team} Team)`)
    .setDescription(embedBody)
    .setColor(role.color);

  return embed;
}

/**
 * Extract the members of a committee role and partition them based on title.
 */
function partitionCommittee(role: Role): [
  emeriti: GuildMember[],
  directors: GuildMember[],
  chairs: GuildMember[],
  interns: GuildMember[],
] {
  const emeriti = [];
  const directors = [];
  const chairs = [];
  const interns = [];

  for (const member of role.members.values()) {
    if (member.roles.cache.has(EMERITUS_ROLE_ID)) {
      emeriti.push(member);
    }
    else if (member.roles.cache.has(DIRECTORS_ROLE_ID)) {
      directors.push(member);
    }
    else if (member.roles.cache.has(INTERNS_ROLE_ID)) {
      interns.push(member);
    }
    // If they don't have any of the above special roles, they're likely a
    // chair. However, lots of officers seem to keep their role after they
    // graduate. If they don't assume the Emeritus role, I think it would
    // make more sense to exclude them from the listing as they are no longer
    // active within the committee.
    else if (!member.roles.cache.has(ALUM_ROLE_ID)) {
      chairs.push(member);
    }
  }

  return [emeriti, directors, chairs, interns];
}

/**
 * Return null if the role does not successfully map to a known committee.
 */
function getCommitteeDataFromRole(role: Role): CommitteeData | null {
  let committeeName: CommitteeName;

  // lol is this a code smell?
  switch (role.id) {
    case FINANCE_AND_FACILITIES_ROLE_ID:
      committeeName = "Finance & Facilities";
      break;
    case ADVOCACY_ROLE_ID:
      committeeName = "Advocacy";
      break;
    case ALUMNI_ROLE_ID:
      committeeName = "Alumni";
      break;
    case DESIGN_AND_PUBLICITY_ROLE_ID:
      committeeName = "Design & Publicity";
      break;
    case MENTORSHIP_ROLE_ID:
      committeeName = "Mentorship";
      break;
    case TUTORING_ROLE_ID:
      committeeName = "Tutoring";
      break;
    case SOCIAL_ROLE_ID:
      committeeName = "Social";
      break;
    case WEB_ROLE_ID:
      committeeName = "Web";
      break;
    case CORPORATE_ROLE_ID:
      committeeName = "Corporate";
      break;
    case INDUCTION_AND_MEMBERSHIP_ROLE_ID:
      committeeName = "Induction & Membership";
      break;
    case ENTREPRENEURSHIP_ROLE_ID:
      committeeName = "Entrepreneurship";
      break;
    default:
      return null;
  }

  return committees.find(data => data.name === committeeName)!;
}
