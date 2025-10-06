import {
  ChatInputCommandInteraction,
  Colors,
  DiscordAPIError,
  EmbedBuilder,
  Guild,
  GuildMember,
  PermissionFlagsBits,
  Role,
  SlashCommandBuilder,
  bold,
  codeBlock,
  inlineCode,
  roleMention,
  spoiler,
  userMention,
  type Collection,
  type Message,
} from "discord.js";
import _ from "lodash";

import type { SlashCommandCheck } from "../../abc/check.abc";
import { SlashCommandHandler } from "../../abc/command.abc";
import {
  Privilege,
  PrivilegeCheck,
} from "../../middleware/privilege.middleware";
import channelsService from "../../services/channels.service";
import inducteeSheetsService, { type InducteeData } from "../../services/inductee-sheets.service";
import type { UrlString } from "../../types/branded.types";
import {
  EMOJI_ALERT,
  EMOJI_CHECK,
  EMOJI_THINKING,
  EMOJI_WARNING,
} from "../../utils/emojis.utils";
import { makeErrorEmbed } from "../../utils/errors.utils";
import { toBulletedList } from "../../utils/formatting.utils";
import {
  ADMINS_ROLE_ID,
  INDUCTEES_ROLE_ID,
} from "../../utils/snowflakes.utils";

/**
 * Trivalent return value type for the functions that make API requests. We want
 * to know if it succeeded or failed, but also if there was no need to make a
 * change in the first place (no mutation request made).
 */
const enum APIResult {
  /** A request was made and it succeeded. */
  Success,
  /** A request was made and it failed. */
  Failure,
  /** A request was not made because there was no need to. */
  Skipped,
}

// To prevent exceeding message/embed character limit.
const MAX_FAILED_MENTIONS = 10;
const MAX_MISSING_MENTIONS = 10;

class AssignInducteesCommand extends SlashCommandHandler {
  public override readonly definition = new SlashCommandBuilder()
    .setName("assigninductees")
    .setDescription("Update all server members that are registered inductees.")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .toJSON();

  public override readonly checks: SlashCommandCheck[] = [
    new PrivilegeCheck(this).atLeast(Privilege.Administrator),
  ];

  // ======================================================================== //
  // #region APPLICATION LAYER

  public override async execute(
    interaction: ChatInputCommandInteraction,
  ): Promise<void> {
    await interaction.deferReply();

    const guild = interaction.guild!;
    const role = guild.roles.cache.get(INDUCTEES_ROLE_ID);

    if (role === undefined) {
      const errorMessage = (
        "Could not find the inductee role " +
        `(expected role with ID ${inlineCode(INDUCTEES_ROLE_ID)}).`
      );
      await interaction.reply({
        content: roleMention(ADMINS_ROLE_ID),
        embeds: [makeErrorEmbed(errorMessage)],
      });
      await channelsService.sendDevError(errorMessage, interaction);
      return;
    }

    const inducteesInfo = await this.getInducteeInfo();

    const [
      affected,
      skipped,
      missing,
      failed,
    ] = await this.findAndUpdateMembersWithInfo(inducteesInfo, guild);

    const embed = this.prepareResponseEmbed(
      affected,
      skipped,
      missing,
      failed,
      role,
    );
    await interaction.editReply({ embeds: [embed] });

    const messageReply = await interaction.fetchReply();

    // Dump the full list of people to reach out to for being missing from the
    // server/malformed username, in case the list was truncated in the embed.
    const loggedMessage = await this.logAllMissingInductees(
      missing,
      messageReply.url as UrlString,
    );
    if (loggedMessage !== null) {
      await interaction.editReply({
        // Have our two main response & log dump link to each other.
        content: `See: ${loggedMessage.url}`,
        embeds: [embed],
      });
    }
  }

  // #endregion
  // ======================================================================== //
  // #region DATA ACCESS LAYER

  private async getInducteeInfo(): Promise<Collection<string, InducteeData>> {
    return await inducteeSheetsService.getAllData();
  }

  // #endregion
  // ======================================================================== //
  // #region BUSINESS LAYER

  /**
   * Top-level business logic function. Given the inductee DTOs, find their
   * corresponding Discord users within the UPE server and make the appropriate
   * updates on them to reflect their inductee status. This function does NOT
   * short-circuit on the first failure. Instead, it gives every struct a chance
   * to process and returns a tuple, which is as partition of the provided
   * inductees representing their different success/failure states.
   */
  private async findAndUpdateMembersWithInfo(
    inducteesInfo: Collection<string, InducteeData>,
    guild: Guild,
  ): Promise<[
    newInductees: GuildMember[],
    skippedInductees: GuildMember[],
    missingMembers: InducteeData[],
    failedMembers: GuildMember[],
  ]> {
    const newInductees: GuildMember[] = [];
    const skippedInductees: GuildMember[] = [];
    const missingMembers: InducteeData[] = [];
    const failedMembers: GuildMember[] = [];

    let count = 0;

    for (const [providedUsername, inducteeData] of inducteesInfo) {
      count++;

      const { legalName } = inducteeData;

      // e.g. [5/79]
      const progressString = `[${count}/${inducteesInfo.size}]`;
      const nameForLogs = `${legalName} (${providedUsername})`;

      // Search for the member by username.
      const members = await guild.members.fetch({
        query: providedUsername,
        limit: 1,
      });

      // Unpack the singular member.
      const [member] = members.values();

      // Query returned no results.
      if (member === undefined) {
        missingMembers.push(inducteeData);
        console.error(`${progressString} MISSING: ${nameForLogs}`);
        continue;
      }

      // Username doesn't match for some reason: might need to check on that.
      if (member.user.username !== providedUsername) {
        console.warn(
          `${progressString} WARNING: found @${member.user.username} from ` +
          `searching with provided username "${providedUsername}", but they ` +
          "are not an exact match",
        );
      }

      // Do the actual updating.
      const result = await this.assignInducteeRole(member);

      // Process and log result.
      switch (result) {
        case APIResult.Success:
          newInductees.push(member);
          console.log(`${progressString} SUCCESS: ${nameForLogs}`);
          break;
        case APIResult.Failure:
          failedMembers.push(member);
          console.error(`${progressString} FAILURE: ${nameForLogs}`);
          break;
        case APIResult.Skipped:
          skippedInductees.push(member);
          console.log(`${progressString} SKIPPED: ${nameForLogs}`);
          break;
      }
    }

    return [newInductees, skippedInductees, missingMembers, failedMembers];
  }

  private async assignInducteeRole(member: GuildMember): Promise<APIResult> {
    if (member.roles.cache.has(INDUCTEES_ROLE_ID)) {
      return APIResult.Skipped;
    }

    try {
      await member.roles.add(INDUCTEES_ROLE_ID);
      return APIResult.Success;
    } catch (error) {
      const { code, message } = error as DiscordAPIError;
      console.error(
        `FAILED to assign Inductees role to @${member.user.username}: ` +
        `DiscordAPIError[${code}] ${message}`,
      );
      return APIResult.Failure;
    }
  }

  /**
   * @deprecated
   * We shouldn't update members' nicknames without their consent tbh.
   * */
  private async updateMemberNickname(
    member: GuildMember,
    nickname: string,
  ): Promise<APIResult> {
    if (member.nickname === nickname) {
      return APIResult.Skipped;
    }

    try {
      await member.setNickname(
        nickname,
        `${this.id}: used inductee's provided preferred name`,
      );
      return APIResult.Success;
    } catch (error) {
      const { code, message } = error as DiscordAPIError;
      console.error(
        `FAILED to update @${member.user.username} nickname to ` +
        `'${nickname}': DiscordAPIError[${code}] ${message}`,
      );
      return APIResult.Failure;
    }
  }

  // #endregion
  // ======================================================================== //
  // #region PRESENTATION LAYER

  /**
   * Top-level function for preparing the embed to display back to the caller.
   */
  private prepareResponseEmbed(
    affected: GuildMember[],
    skipped: GuildMember[],
    missing: InducteeData[],
    failed: GuildMember[],
    role: Role,
  ): EmbedBuilder {
    const successString = this.formatSuccessString(affected, skipped, role);
    const missingString = this.formatMissingString(missing);
    const failedString = this.formatFailedString(failed);

    const allGood = missing.length === 0 && failed.length === 0;
    if (allGood) {
      return new EmbedBuilder()
        .setColor(role.color)
        .setDescription(
          successString || `${EMOJI_THINKING} No inductees to assign!`,
        );
    }

    const descriptionWithErrors = [
      successString,
      missingString,
      failedString,
    ].filter(Boolean).join("\n\n");

    const embed = makeErrorEmbed(descriptionWithErrors);
    return embed;
  }

  private formatSuccessString(
    affected: GuildMember[],
    skipped: GuildMember[],
    role: Role,
  ): string {
    const numSucceeded = affected.length + skipped.length;
    if (numSucceeded === 0) {
      return "";
    }

    const updatedString = (
      `${EMOJI_CHECK} Assigned ${role} for ` +
      `${bold(numSucceeded.toString())} members!`
    );
    const affectedString = `${bold(affected.length.toString())} affected.`;

    return `${updatedString} ${affectedString}`;
  }

  private formatMissingString(missing: InducteeData[]): string {
    if (missing.length === 0) {
      return "";
    }

    function infoToBulletPoint(info: InducteeData): string {
      const { legalName, discordId } = info;
      return (
        "* " + inlineCode(userMention(discordId)) + " " + `(${legalName})`
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
      `${EMOJI_WARNING} It doesn't seem like these ` +
      `${bold(missing.length.toString())} users are in the server:\n` +
      formattedUserList
    );
  }

  private formatFailedString(failed: GuildMember[]): string {
    if (failed.length === 0) {
      return "";
    }

    let mentionsString = failed.slice(0, MAX_FAILED_MENTIONS).join(", ");
    if (failed.length > MAX_FAILED_MENTIONS) {
      const numOmitted = failed.length - MAX_FAILED_MENTIONS;
      mentionsString += `, ...(${bold(numOmitted.toString())} more)...`;
    }

    return (
      `${EMOJI_ALERT} I wasn't allowed to update these ` +
      `${bold(failed.length.toString())} members:\n` +
      mentionsString
    );
  }

  private async logAllMissingInductees(
    missing: InducteeData[],
    interactionLink: UrlString,
  ): Promise<Message | null> {
    if (missing.length === 0) {
      return null;
    }

    console.warn("WARNING: The following users were not found in the server:");
    const embedEntries: string[] = [];

    for (const { legalName, discordId } of missing) {
      console.error(`${legalName} (${discordId})`);
      embedEntries.push(`${legalName} (${inlineCode(userMention(discordId))}`);
    }

    const commaSepEmails = missing.map(info => info.preferredEmail).join(",");
    console.warn(
      "ENDWARNING. The following are the email addresses you can use to " +
      "contact these users to let them know their Discord username is " +
      "invalid and/or they are not in the server:",
    );
    console.warn(commaSepEmails);

    const logsChannel = channelsService.getLogSink();
    if (logsChannel === null) {
      return null;
    }

    const MAX_ENTRIES_PER_EMBED = 30;
    const pages: EmbedBuilder[] = _
      .chunk(embedEntries, MAX_ENTRIES_PER_EMBED)
      .map(toBulletedList)
      .map((description, index, array) => new EmbedBuilder()
        .setColor(Colors.Yellow)
        .setTitle(`${this.id}: Inductees Still Missing from Server`)
        .setDescription(description)
        .setFooter({ text: `Page ${index + 1} / ${array.length}` }),
      );
    pages.push(new EmbedBuilder()
      .setColor(Colors.Yellow)
      .setTitle(`${this.id}: Inductees Still Missing from Server`)
      .setDescription(spoiler(codeBlock(commaSepEmails)))
      .setFooter({ text: "Emails to copy-paste" }),
    );

    return await logsChannel.send({
      content: `From: ${interactionLink}`,
      embeds: pages,
    });
  }

  // #endregion
  // ======================================================================== //
}

export default new AssignInducteesCommand();
