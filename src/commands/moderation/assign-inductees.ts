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
  bold,
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
    affected,
    skipped,
    missing,
    failed,
  ] = await findAndUpdateMembersWithInfo(inducteesInfo, guild);

  const embed = prepareResponseEmbed(affected, skipped, missing, failed, role);
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

/**
 * Trivalent return value type for the functions that make API requests. We want
 * to know if it succeeded or failed, but also if there was no need to make a
 * change in the first place (no mutation request made).
 */
const enum APIResult {
  /** A request was made and it succeeded. */
  SUCCESS,
  /** A request was made and it failed. */
  FAILURE,
  /** A request was not made because there was no need to. */
  SKIPPED,
}

async function findAndUpdateMembersWithInfo(
  inducteesInfo: InducteeInfo[],
  guild: Guild,
): Promise<[
  newInductees: GuildMember[],
  skippedInductees: GuildMember[],
  missingMembers: InducteeInfo[],
  failedMembers: GuildMember[],
]> {
  const newInductees: GuildMember[] = [];
  const skippedInductees: GuildMember[] = [];
  const missingMembers: InducteeInfo[] = [];
  const failedMembers: GuildMember[] = [];

  for (const inducteeInfo of inducteesInfo) {
    const { discordUsername: providedUsername } = inducteeInfo;

    // Search for the member by username.
    const members = await guild.members.fetch({
      query: providedUsername,
      limit: 1,
    });

    // Unpack the singular member.
    const [member] = members.values();

    // Query returned no results or the username doesn't match for some reason.
    if (!member || member.user.username !== providedUsername) {
      missingMembers.push(inducteeInfo);
      continue;
    }

    // Do the actual updating.
    const result = await makeUpdateCallsToDiscordAPI(member, inducteeInfo);
    switch (result) {
      case APIResult.SUCCESS:
        newInductees.push(member);
        break;
      case APIResult.FAILURE:
        failedMembers.push(member);
        break;
      case APIResult.SKIPPED:
        skippedInductees.push(member);
        break;
    }
  }

  return [newInductees, skippedInductees, missingMembers, failedMembers];
}

async function makeUpdateCallsToDiscordAPI(
  member: GuildMember,
  inducteeInfo: InducteeInfo,
): Promise<APIResult> {
  const { firstName, lastName } = inducteeInfo;

  const nickname = `${firstName} ${lastName}`;
  const roleResult = await assignInducteeRole(member);
  const nickResult = await updateMemberNickname(member, nickname);

  // Determine overall result state. Note that the above operations do NOT form
  // a transaction. It's possible that a role is assigned but the
  // nickname-changing failed or vice versa.
  if (roleResult === APIResult.SKIPPED && nickResult === APIResult.SKIPPED) {
    return APIResult.SKIPPED;
  }
  if (roleResult === APIResult.FAILURE || nickResult === APIResult.FAILURE) {
    return APIResult.FAILURE;
  }
  return APIResult.SUCCESS;
}

async function assignInducteeRole(member: GuildMember): Promise<APIResult> {
  if (member.roles.cache.has(INDUCTEES_ROLE_ID)) {
    return APIResult.SKIPPED;
  }

  try {
    await member.roles.add(INDUCTEES_ROLE_ID);
    return APIResult.SUCCESS;
  } catch (error) {
    const { code, message } = error as DiscordAPIError;
    console.error(
      `FAILED to assign Inductees role to @${member.user.username}: ` +
      `DiscordAPIError[${code}] ${message}`,
    );
    return APIResult.FAILURE;
  }
}

async function updateMemberNickname(
  member: GuildMember,
  nickname: string,
): Promise<APIResult> {
  if (member.nickname === nickname) {
    return APIResult.SKIPPED;
  }

  try {
    await member.setNickname(
      nickname,
      `/${COMMAND_NAME}: used inductee's provided preferred name`,
    );
    return APIResult.SUCCESS;
  } catch (error) {
    const { code, message } = error as DiscordAPIError;
    console.error(
      `FAILED to update @${member.user.username} nickname to '${nickname}': ` +
      `DiscordAPIError[${code}] ${message}`,
    );
    return APIResult.FAILURE;
  }
}

function prepareResponseEmbed(
  affected: GuildMember[],
  skipped: GuildMember[],
  missing: InducteeInfo[],
  failed: GuildMember[],
  role: Role,
): EmbedBuilder {
  function formatSuccessString(): string {
    const numSucceeded = affected.length + skipped.length;
    if (numSucceeded === 0) return "";

    const updatedString = (
      `✅ Assigned ${role} and updated nickname for ` +
      `${bold(numSucceeded.toString())} members!`
    );

    let affectedString = `${bold(affected.length.toString())} affected`;
    if (affected.length > 0) {
      affectedString += `:\n${affected.join(", ")}`;
    }
    else {
      affectedString += "."
    }

    return `${updatedString} ${affectedString}`;
  }

  function formatMissingString(): string {
    if (missing.length === 0) return "";

    const formattedUserList = missing.map(info => {
      const { firstName, lastName, discordUsername: username } = info;
      return inlineCode(`@${username}`) + " " + `(${firstName} ${lastName})`;
    }).join(", ");

    return (
      `⚠️ It doesn't seem like these ${bold(missing.length.toString())} ` +
      `users are in the server:\n${formattedUserList}`
    );
  }

  function formatFailedString(): string {
    if (failed.length === 0) return "";

    return (
      `🚨 I wasn't allowed to update these ${bold(failed.length.toString())}` +
      `members:\n${failed.join(", ")}`
    );
  }

  const successString = formatSuccessString();
  const missingString = formatMissingString();
  const failedString = formatFailedString();

  const allGood = missing.length === 0 && failed.length === 0;
  if (allGood) {
    const embed = new EmbedBuilder()
      .setDescription(successString || "🤔 No inductees to assign!")
      .setColor(role.color);
    return embed;
  }

  const descriptionWithErrors = [
    successString,
    missingString,
    failedString,
  ].filter(Boolean).join("\n\n");

  const embed = makeErrorEmbed(descriptionWithErrors);
  return embed;
}
