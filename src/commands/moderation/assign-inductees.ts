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

const COMMAND_NAME = "assigninductees";

const INDUCTEE_INFO_CSV_PATH = "inductees.csv"; // Placed at CWD for now.
const FIRST_NAME_COL_NAME = "Preferred First Name";
const LAST_NAME_COL_NAME = "Preferred Last Name";
const DISCORD_USERNAME_COL_NAME = "Discord Username";

module.exports = {
  data: new SlashCommandBuilder()
    .setName(COMMAND_NAME)
    .setDescription("Update all server members that are registered inductees.")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  execute: updateInducteeMembers,
};

async function updateInducteeMembers(
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
      ephemeral: true,
      embeds: [makeErrorEmbed(
        "Could not find the inductee role " +
        `(expected role with ID ${inlineCode(INDUCTEES_ROLE_ID)}).`,
      )],
    });
    return;
  }

  const inducteesInfo = parseInducteeInfoFromCSV();
  if (inducteesInfo === "File Not Found") {
    await interaction.reply({
      ephemeral: true,
      embeds: [makeErrorEmbed(
        "Could not find the file with inductee information!",
      )],
    });
    return;
  }
  if (inducteesInfo === "File Malformed") {
    await interaction.reply({
      ephemeral: true,
      embeds: [makeErrorEmbed(
        "Inductee info file has an unexpected format!",
      )],
    })
    return;
  }

  // Not sure how long updating takes with many inductees, so just in case.
  await interaction.deferReply();

  const [
    succeeded,
    notFound,
    failed,
  ] = await findAndUpdateMembersWithInfo(inducteesInfo, guild);

  const embed = prepareResponseEmbed(succeeded, notFound, failed, role);
  await interaction.editReply({ embeds: [embed] });
}

type InducteeInfo = {
  firstName: string;
  lastName: string;
  discordUsername: string;
};

function parseInducteeInfoFromCSV():
  InducteeInfo[] | "File Not Found" | "File Malformed" {
  if (!fs.existsSync(INDUCTEE_INFO_CSV_PATH)) {
    console.error(`ERROR: file at path ${INDUCTEE_INFO_CSV_PATH} not found.`);
    return "File Not Found";
  }

  const content = fs.readFileSync(INDUCTEE_INFO_CSV_PATH).toString();
  const [header, ...rows] = CSV.parse(content);

  if (header === undefined || rows.length === 0) {
    console.error(`WARNING: ${INDUCTEE_INFO_CSV_PATH} is empty!`);
    return [];
  }

  const firstNameColumnIndex = header.indexOf(FIRST_NAME_COL_NAME);
  if (firstNameColumnIndex === -1) {
    console.error(`ERROR: no '${FIRST_NAME_COL_NAME}' column.`);
    return "File Malformed";
  }

  const lastNameColumnIndex = header.indexOf(LAST_NAME_COL_NAME);
  if (lastNameColumnIndex === -1) {
    console.error(`ERROR: no '${LAST_NAME_COL_NAME}' column.`);
    return "File Malformed";
  }

  const usernameColumnIndex = header.indexOf(DISCORD_USERNAME_COL_NAME);
  if (usernameColumnIndex === -1) {
    console.error(`ERROR: no '${DISCORD_USERNAME_COL_NAME}' column`);
    return "File Malformed";
  }

  const inducteesInfo: InducteeInfo[] = rows.map(row => ({
    firstName: row[firstNameColumnIndex],
    lastName: row[lastNameColumnIndex],
    discordUsername: row[usernameColumnIndex],
  }));

  return inducteesInfo;
}

async function findAndUpdateMembersWithInfo(
  inducteesInfo: InducteeInfo[],
  guild: Guild,
): Promise<[
  succeededMembers: GuildMember[],
  notFoundUsers: InducteeInfo[],
  failedMembers: GuildMember[]
]> {
  const succeededMembers: GuildMember[] = [];
  const notFoundUsers: InducteeInfo[] = [];
  const failedMembers: GuildMember[] = [];

  for (const inducteeInfo of inducteesInfo) {
    const {
      firstName,
      lastName,
      discordUsername: providedUsername,
    } = inducteeInfo;

    // Make the API call.
    const members = await guild.members.fetch({
      query: providedUsername,
      limit: 1,
    });

    // Unpack the singular member.
    const [member] = members.values();

    // Query returned no results or the username doesn't match for some reason.
    if (!member || member.user.username !== providedUsername) {
      notFoundUsers.push(inducteeInfo);
      continue;
    }

    // Do the actual updating.
    const nickname = `${firstName} ${lastName}`;
    const success =
      await assignInducteeRole(member) &&
      await updateMemberNickname(member, nickname);

    if (success) {
      succeededMembers.push(member);
    } else {
      failedMembers.push(member);
    }
  }

  return [succeededMembers, notFoundUsers, failedMembers];
}

async function assignInducteeRole(member: GuildMember): Promise<boolean> {
  try {
    await member.roles.add(INDUCTEES_ROLE_ID);
    return true;
  } catch (error) {
    const { code, message } = error as DiscordAPIError;
    console.error(
      `FAILED to assign Inductees role to @${member.user.username}: ` +
      `DiscordAPIError[${code}] ${message}`,
    );
    return false;
  }
}

async function updateMemberNickname(
  member: GuildMember,
  nickname: string,
): Promise<boolean> {
  try {
    await member.setNickname(
      nickname,
      `/${COMMAND_NAME}: used inductee's provided preferred name`,
    );
    return true;
  } catch (error) {
    const { code, message } = error as DiscordAPIError;
    console.error(
      `FAILED to update @${member.user.username} nickname to '${nickname}': ` +
      `DiscordAPIError[${code}] ${message}`,
    );
    return false;
  }
}

function prepareResponseEmbed(
  succeeded: GuildMember[],
  notFound: InducteeInfo[],
  failed: GuildMember[],
  role: Role,
): EmbedBuilder {
  const successString = succeeded.length > 0 ? (
    `✅ Assigned ${role} and updated nickname for ${succeeded.length} members!`
  ) : "";

  const notFoundString = notFound.length > 0 ? (
    "⚠️ It doesn't seem like these users are in the server:\n" +
    notFound.map(info => {
      const { firstName, lastName, discordUsername: username } = info;
      return inlineCode(`@${username}`) + " " + `(${firstName} ${lastName})`;
    }).join(", ")
  ) : "";

  const failedString = failed.length > 0 ? (
    "🚨 I wasn't allowed to update these members:\n" +
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
