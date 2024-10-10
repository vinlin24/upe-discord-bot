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

import { z } from "zod";
import { GOOGLE_CREDENTIALS_PATH, GOOGLE_INDUCTEE_DATA_SHEET_NAME, GOOGLE_INDUCTEE_DATA_SPREADSHEET_ID, sheetsRowToInducteeData, type InducteeData } from "../../listeners/inductee-join.listener";
import { GoogleSheetsService } from "../../services/sheets.service";
import { makeErrorEmbed } from "../../utils/errors.utils";
import { INDUCTEES_ROLE_ID } from "../../utils/snowflakes.utils";

const COMMAND_NAME = "assigninductees";

const INDUCTEE_INFO_CSV_PATH = "inductees.csv"; // Placed at CWD for now.
const FIRST_NAME_COL_NAME = "Preferred First Name";
const LAST_NAME_COL_NAME = "Preferred Last Name";
const DISCORD_USERNAME_COL_NAME = "Discord Username";
const PREFERRED_EMAIL_COL_NAME = "Preferred Email for Communications";

module.exports = {
  data: new SlashCommandBuilder()
    .setName(COMMAND_NAME)
    .setDescription("Update all server members that are registered inductees.")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  execute: updateInducteeMembers,
};

// ========================================================================== //
// #region APPLICATION LAYER

/** Top-level command callback. */
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

  // Legacy approach (downloading CSV file from responses):

  // const inducteesInfo = parseInducteeInfoFromCSV();
  // if (inducteesInfo === "File Not Found") {
  //   await interaction.reply({
  //     ephemeral: true,
  //     embeds: [makeErrorEmbed(
  //       "Could not find the file with inductee information!",
  //     )],
  //   });
  //   return;
  // }
  // if (inducteesInfo === "File Malformed") {
  //   await interaction.reply({
  //     ephemeral: true,
  //     embeds: [makeErrorEmbed(
  //       "Inductee info file has an unexpected format!",
  //     )],
  //   })
  //   return;
  // }

  // New approach (dynamically using Sheets):

  const inducteesInfo = await getInducteeInfoFromSheets();
  if (inducteesInfo === "Failed") {
    await interaction.reply({
      ephemeral: true,
      embeds: [makeErrorEmbed(
        "Failed to retrieve inductee data from Google Sheets.",
      )],
    });
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

  // Dump the full list of people to reach out to for being missing from the
  // server/malformed username, in case the list was truncated in the embed.
  logAllMissingInductees(missing);
}

// #endregion
// ========================================================================== //
// #region DATA ACCESS LAYER

/**
 * DTO for the relevant inductee information used to update their corresponding
 * Discord users.
 */
type InducteeInfo = {
  firstName: string;
  lastName: string;
  discordUsername: string;
  email: string;
};

/**
 * Top-level function for loading inductee information from our source of truth.
 */
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

  const emailColumnIndex = header.indexOf(PREFERRED_EMAIL_COL_NAME);
  if (emailColumnIndex === -1) {
    console.error(`ERROR: no '${PREFERRED_EMAIL_COL_NAME}' column`);
    return "File Malformed";
  }

  const inducteesInfo: InducteeInfo[] = rows.map(row => ({
    firstName: row[firstNameColumnIndex].trim(),
    lastName: row[lastNameColumnIndex].trim(),
    discordUsername: cleanProvidedUsername(row[usernameColumnIndex]),
    email: row[emailColumnIndex].trim(),
  }));

  return inducteesInfo;
}

async function getInducteeInfoFromSheets(): Promise<InducteeData[] | "Failed"> {
  const sheetsService = GoogleSheetsService.fromCredentialsFile(
    GOOGLE_CREDENTIALS_PATH,
    GOOGLE_INDUCTEE_DATA_SPREADSHEET_ID,
  );

  const sheetsData = await sheetsService.getValues(
    GOOGLE_INDUCTEE_DATA_SHEET_NAME,
  );
  if (sheetsData === null) {
    console.error("Failed to read inductee data from Google Sheets.");
    return "Failed";
  }

  const inducteesData: InducteeData[] = [];
  // TODO: This loop is duplicated from inductee-join.listener.ts.
  for (let rowIndex = 1; rowIndex < sheetsData.length; rowIndex++) {
    const row = sheetsData[rowIndex];
    try {
      const inducteeData = sheetsRowToInducteeData(row);
      if (inducteeData === null) {
        continue;
      }
      inducteesData.push(inducteeData);
    }
    catch (error) {
      if (error instanceof z.ZodError) {
        console.error(
          `Error validating inductee response data (row ${rowIndex + 1}): ` +
          error.message,
        );
        continue;
      }
      throw error;
    }
  }

  return inducteesData;
}

/**
 * Apply some post-processing on the provided response for the Discord username
 * to catch and correct some common mistakes.
 */
function cleanProvidedUsername(providedUsername: string): string {
  // Mistake: "@username" instead of "username".
  if (providedUsername.startsWith("@")) {
    providedUsername = providedUsername.slice(1);
  }

  // Mistake: "username#0" instead of "username".
  const discriminatorIndex = providedUsername.indexOf("#");
  if (discriminatorIndex !== -1) {
    providedUsername = providedUsername.slice(0, discriminatorIndex);
  }

  // Mistake: "Username" instead of "username".
  providedUsername = providedUsername.toLowerCase();

  // Mistake: "username " instead of "username".
  providedUsername = providedUsername.trim();

  return providedUsername;
}

// #endregion
// ========================================================================== //
// #region BUSINESS LAYER

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

/**
 * Top-level business logic function. Given the inductee DTOs, find their
 * corresponding Discord users within the UPE server and make the appropriate
 * updates on them to reflect their inductee status. This function does NOT
 * short-circuit on the first failure. Instead, it gives every struct a chance
 * to process and returns a tuple, which is as partition of the provided
 * inductees representing their different success/failure states.
 */
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

  for (const [index, inducteeInfo] of inducteesInfo.entries()) {
    const {
      firstName,
      lastName,
      discordUsername: providedUsername,
    } = inducteeInfo;

    // e.g. [5/79]
    const progressString = `[${index + 1}/${inducteesInfo.length}]`;
    const nameForLogs = `${firstName} ${lastName} (${providedUsername})`;

    // Search for the member by username.
    const members = await guild.members.fetch({
      query: providedUsername,
      limit: 1,
    });

    // Unpack the singular member.
    const [member] = members.values();

    // Query returned no results.
    if (!member) {
      missingMembers.push(inducteeInfo);
      console.error(`${progressString} MISSING: ${nameForLogs}`);
      continue;
    }

    // Username doesn't match for some reason: might need to check on that.
    if (member.user.username !== providedUsername) {
      console.log(
        `${progressString} WARNING: found @${member.user.username} from ` +
        `searching with provided username "${providedUsername}", but they ` +
        "are not an exact match",
      );
    }

    // Do the actual updating.
    const result = await makeUpdateCallsToDiscordAPI(member, inducteeInfo);

    // Process and log result.
    switch (result) {
      case APIResult.SUCCESS:
        newInductees.push(member);
        console.log(`${progressString} SUCCESS: ${nameForLogs}`);
        break;
      case APIResult.FAILURE:
        failedMembers.push(member);
        console.error(`${progressString} FAILURE: ${nameForLogs}`);
        break;
      case APIResult.SKIPPED:
        skippedInductees.push(member);
        console.log(`${progressString} SKIPPED: ${nameForLogs}`);
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

// #endregion
// ========================================================================== //
// #region PRESENTATION LAYER

// To prevent exceeding message/embed character limit.
const MAX_FAILED_MENTIONS = 10;
const MAX_MISSING_MENTIONS = 10;

/** Top-level function for preparing the embed to display back to the caller. */
function prepareResponseEmbed(
  affected: GuildMember[],
  skipped: GuildMember[],
  missing: InducteeInfo[],
  failed: GuildMember[],
  role: Role,
): EmbedBuilder {
  const successString = formatSuccessString(affected, skipped, role);
  const missingString = formatMissingString(missing);
  const failedString = formatFailedString(failed);

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

function formatSuccessString(
  affected: GuildMember[],
  skipped: GuildMember[],
  role: Role,
): string {
  const numSucceeded = affected.length + skipped.length;
  if (numSucceeded === 0) return "";

  const updatedString = (
    `✅ Assigned ${role} and updated nickname for ` +
    `${bold(numSucceeded.toString())} members!`
  );
  const affectedString = `${bold(affected.length.toString())} affected.`;

  return `${updatedString} ${affectedString}`;
}

function formatMissingString(missing: InducteeInfo[]): string {
  if (missing.length === 0) return "";

  function infoToBulletPoint(info: InducteeInfo): string {
    const { firstName, lastName, discordUsername: username } = info;
    return (
      "* " + inlineCode(`@${username}`) + " " + `(${firstName} ${lastName})`
    );
  }

  let formattedUserList = missing
    .slice(0, MAX_MISSING_MENTIONS)
    .map(infoToBulletPoint)
    .join("\n");

  if (missing.length > MAX_MISSING_MENTIONS) {
    const numOmitted = missing.length - MAX_MISSING_MENTIONS;
    formattedUserList += `\n* ...(${bold(numOmitted.toString())} more)...`;
  }

  return (
    `⚠️ It doesn't seem like these ${bold(missing.length.toString())} ` +
    `users are in the server:\n${formattedUserList}`
  );
}

function formatFailedString(failed: GuildMember[]): string {
  if (failed.length === 0) return "";

  let mentionsString = failed.slice(0, MAX_FAILED_MENTIONS).join(", ");
  if (failed.length > MAX_FAILED_MENTIONS) {
    const numOmitted = failed.length - MAX_FAILED_MENTIONS;
    mentionsString += `, ...(${bold(numOmitted.toString())} more)...`;
  }

  return (
    `🚨 I wasn't allowed to update these ${bold(failed.length.toString())}` +
    `members:\n${mentionsString}`
  );
}

function logAllMissingInductees(missing: InducteeInfo[]): void {
  if (missing.length === 0) return;

  console.error("WARNING: The following users were not found in the server:");
  for (const { firstName, lastName, discordUsername } of missing) {
    console.error(`${firstName} ${lastName} (@${discordUsername})`);
  }
  console.error(
    "ENDWARNING. The following are the email addresses you can use to " +
    "contact these users to let them know their Discord username is " +
    "invalid and/or they are not in the server:",
  );
  console.error(missing.map(info => info.email).join(","))
}

// #endregion
