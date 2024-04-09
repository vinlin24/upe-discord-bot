import fs from "node:fs";

import * as CSV from "csv-string";
import {
  ChatInputCommandInteraction,
  DiscordAPIError,
  EmbedBuilder,
  Guild,
  GuildMember,
  PermissionFlagsBits,
  Role,
  SlashCommandBuilder,
  inlineCode,
} from "discord.js";

import { makeErrorEmbed } from "../../utils/errors.utils";
import { INDUCTEES_ROLE_ID } from "../../utils/snowflakes.utils";

module.exports = {
  data: new SlashCommandBuilder()
    .setName("assigninductees")
    .setDescription("Assign the Inductees role to all registered inductees.")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  execute: assignInducteesRole,
};

const INDUCTEE_INFO_CSV_PATH = "inductees.csv"; // Placed at CWD for now.

async function assignInducteesRole(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const { guild } = interaction;
  if (!guild) {
    await interaction.reply({
      embeds: [makeErrorEmbed(
        "This command can only be used within the UPE server.",
      )],
    });
    return;
  }

  const role = guild.roles.cache.get(INDUCTEES_ROLE_ID);
  if (!role) {
    await interaction.reply({
      embeds: [makeErrorEmbed(
        "Could not find the inductee role " +
        `(expected role with ID ${inlineCode(INDUCTEES_ROLE_ID)}).`,
      )],
      ephemeral: true,
    });
    return;
  }

  // Not sure how long this takes with many inductees, so just in case.
  await interaction.deferReply();

  const usernames = parseInducteeUsernamesFromCSV();
  const [members, notFound] = await getMembersFromUsernames(usernames, guild);
  const [succeeded, failed] = await assignInducteesRoleToMembers(members);

  const embed = prepareResponseEmbed(succeeded, notFound, failed, role);
  await interaction.editReply({ embeds: [embed] });
}

function parseInducteeUsernamesFromCSV(): string[] {
  const content = fs.readFileSync(INDUCTEE_INFO_CSV_PATH).toString();
  const [header, ...rows] = CSV.parse(content);
  if (header === undefined || rows.length === 0) {
    console.error(`WARNING: ${INDUCTEE_INFO_CSV_PATH} is empty!`);
    return [];
  }
  const usernameColumnIndex = header.indexOf("Discord Username");
  const usernames = rows.map(row => row[usernameColumnIndex]);
  return usernames;
}

async function getMembersFromUsernames(
  usernames: string[],
  guild: Guild,
): Promise<[
  foundMembers: GuildMember[],
  notFoundUsernames: string[],
]> {
  const foundMembers: GuildMember[] = [];
  const notFoundUsernames: string[] = [];

  for (const username of usernames) {
    const members = await guild.members.fetch({ query: username, limit: 1 });

    // Unpack the singular member.
    const [member] = members.values();

    // Query returned no results or the username doesn't match for some reason.
    if (!member || member.user.username !== username) {
      notFoundUsernames.push(username);
      continue;
    }

    foundMembers.push(member);
  }

  return [foundMembers, notFoundUsernames];
}

async function assignInducteesRoleToMembers(
  members: GuildMember[],
): Promise<[
  succeededMembers: GuildMember[],
  failedMembers: GuildMember[],
]> {
  const succeededMembers: GuildMember[] = [];
  const failedMembers: GuildMember[] = [];

  for (const member of members) {
    try {
      await member.roles.add(INDUCTEES_ROLE_ID);
      succeededMembers.push(member);
    } catch (error) {
      const { code, message } = error as DiscordAPIError;
      console.error(
        `FAILED to assign Inductees role to @${member.user.username}: ` +
        `DiscordAPIError[${code}] ${message}`,
      );
      failedMembers.push(member);
    }
  }

  return [succeededMembers, failedMembers];
}

function prepareResponseEmbed(
  succeeded: GuildMember[],
  notFound: string[],
  failed: GuildMember[],
  role: Role,
): EmbedBuilder {
  const successString = succeeded.length > 0 ? (
    `✅ Assigned ${role} to ${succeeded.length} member(s)!`
  ) : "";

  const notFoundString = notFound.length > 0 ? (
    "⚠️ It doesn't seem like these users are in the server:\n" +
    notFound.map(username => inlineCode(`@${username}`)).join(", ")
  ) : "";

  const failedString = failed.length > 0 ? (
    "🚨 An error occurred when trying to give these members the role:\n" +
    failed.join(", ")
  ) : "";

  const allGood = notFound.length === 0 && failed.length === 0;
  if (allGood) {
    const embed = new EmbedBuilder()
      .setDescription(successString || "🤔 No inductees to assign!")
      .setColor(role.color);
    return embed;
  }

  const descriptionWithErrors = [
    successString,
    notFoundString,
    failedString,
  ].filter(Boolean).join("\n\n");

  const embed = makeErrorEmbed(descriptionWithErrors);
  return embed;
}
