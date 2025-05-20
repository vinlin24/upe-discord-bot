import {
  bold,
  channelMention,
  Colors,
  DiscordAPIError,
  EmbedBuilder,
  hyperlink,
  inlineCode,
  roleMention,
  SlashCommandBuilder,
  userMention,
  type ChatInputCommandInteraction,
  type Collection,
  type ColorResolvable,
  type Guild,
  type GuildMember,
  type Message,
} from "discord.js";

import type { SlashCommandCheck } from "../../abc/check.abc";
import { SlashCommandHandler } from "../../abc/command.abc";
import {
  Privilege,
  PrivilegeCheck,
} from "../../middleware/privilege.middleware";
import channelsService from "../../services/channels.service";
import type { RoleId } from "../../types/branded.types";
import { EMOJI_ALERT, EMOJI_WARNING } from "../../utils/emojis.utils";
import {
  DIRECTORS_ROLE_ID,
  OFFICERS_ROLE_ID,
} from "../../utils/snowflakes.utils";
import {
  COMMITTEE_ROLE_MAP,
  Title,
  type Committee,
} from "../../utils/upe.utils";
import officersServiceFactory, { type OfficerData } from "./officers.service";

class OfficerAssignCommand extends SlashCommandHandler {
  public override readonly definition = new SlashCommandBuilder()
    .setName("assignofficers")
    .setDescription(
      "Assign roles to users based on officer contact information spreadsheet",
    )
    .addStringOption(input => input
      .setName("spreadsheet_url")
      .setDescription("URL to Google Sheets responses spreadsheet")
      .setRequired(true),
    )
    .toJSON();

  public override readonly checks: SlashCommandCheck[] = [
    new PrivilegeCheck(this).atLeast(Privilege.Administrator),
  ];

  public override async execute(
    interaction: ChatInputCommandInteraction,
  ): Promise<void> {
    const { guild, options } = interaction;
    if (guild === null) {
      await this.replyError(interaction, (
        "This command can only be used in the server."
      ));
      return;
    }

    const spreadsheetUrl = options.getString("spreadsheet_url", true);
    const spreadsheetId = this.extractSpreadsheetId(spreadsheetUrl);
    if (spreadsheetId === null) {
      await this.replyError(interaction, (
        `${inlineCode(spreadsheetUrl)} is not a valid Google Sheets URL.`
      ));
      return;
    }

    const commandResponse = await interaction.deferReply({ fetchReply: true });

    // Fetch officer contact information.

    const officersService = officersServiceFactory.make(spreadsheetId);
    const allData = await officersService.getAllData(true);

    // The actual updating. Individual output is written to logs sink channel.

    const [
      missingUsernames,
      missingRoles,
    ] = await this.processAllOfficers(guild, allData, commandResponse);

    // Report success/missing by updating the original command response.

    const embed = this.prepareResponseEmbed(
      allData.size,
      spreadsheetUrl,
      missingUsernames,
      missingRoles,
    );
    await interaction.editReply({ embeds: [embed] });
  }

  private extractSpreadsheetId(url: string): string | null {
    const SPREADSHEET_URL_RE
      = /https:\/\/docs\.google\.com\/spreadsheets\/d\/([a-z0-9_-]+)($|\/)/i;
    const match = SPREADSHEET_URL_RE.exec(url);
    return match == null ? null : match[1];
  }

  private async processAllOfficers(
    guild: Guild,
    allData: Collection<string, OfficerData>,
    commandResponse: Message,
  ): Promise<[missingUsernames: string[], missingRoles: Committee[]]> {
    const missingUsernames: string[] = [];
    const missingRoles: Committee[] = [];

    for (const [discordUsername, data] of allData) {
      const members = await guild.members.fetch({
        query: discordUsername,
        limit: 1,
      });
      const [member] = members.values();

      if (member === undefined) {
        missingUsernames.push(discordUsername);
        continue;
      }

      await this.processOfficer(member, data, missingRoles, commandResponse);
    }

    return [missingUsernames, missingRoles];
  }

  private async processOfficer(
    member: GuildMember,
    data: OfficerData,
    missingRoles: Committee[],
    commandResponse: Message,
  ): Promise<void> {
    // Everyone gets the officers blanket role.

    const officerGiven = await this.addRoleIfNotHave(member, OFFICERS_ROLE_ID);

    // Now give them their specific committee role.

    const committeeRoleId = COMMITTEE_ROLE_MAP.get(data.committee);
    let committeeGiven = false;
    if (committeeRoleId === undefined) {
      missingRoles.push(data.committee);
    }
    else {
      committeeGiven = await this.addRoleIfNotHave(member, committeeRoleId);
    }

    // Now give them the director role if needed.

    let directorGiven = false;
    if (data.title === Title.Director) {
      directorGiven = await this.addRoleIfNotHave(member, DIRECTORS_ROLE_ID);
    }

    // Acknowledge.

    await this.sendIndividualAcknowledgement(
      officerGiven,
      committeeGiven,
      committeeRoleId,
      directorGiven,
      member,
      commandResponse,
    );
  }

  private async sendIndividualAcknowledgement(
    officerGiven: boolean,
    committeeGiven: boolean,
    committeeRoleId: RoleId | undefined,
    directorGiven: boolean,
    member: GuildMember,
    commandResponse: Message,
  ): Promise<void> {
    const rolesGivenString = [
      officerGiven ? OFFICERS_ROLE_ID : "",
      committeeGiven && committeeRoleId ? committeeRoleId : "",
      directorGiven ? DIRECTORS_ROLE_ID : "",
    ].filter(Boolean).map(roleMention).join(", ");

    // The member was parsed from the data but they already have all the roles
    // they need. No need to clutter the output.
    if (!rolesGivenString) {
      return;
    }

    const description = `Gave ${rolesGivenString} to ${userMention(member.id)}`;

    const logSink = channelsService.getLogSink();
    if (logSink === null) {
      console.warn(
        `LOG SINK CHANNEL IS MISSING, CANNOT ACKNOWLEDGE ${this.id} ` +
        `PROCESSING FOR MEMBER @${member.user.username}: ${description}`
      );
      return;
    }

    let committeeRoleColor: ColorResolvable | null = null;
    if (committeeRoleId !== undefined) {
      const committeeRole = member.roles.cache.get(committeeRoleId);
      if (committeeRole !== undefined) {
        committeeRoleColor = committeeRole.color;
      }
    }

    const embed = new EmbedBuilder()
      .setTitle("Officer Roles Updated")
      .setDescription(description)
      .setColor(committeeRoleColor);

    try {
      await logSink.send({
        content: `${bold(this.id)}: ${commandResponse.url}`,
        embeds: [embed],
      });
    }
    // Don't compromise the rest of the handling.
    catch (error) {
      if (error instanceof DiscordAPIError) {
        console.error(`ERROR IN SENDING ${this.id} ACK TO LOG SINK:`);
        console.error(error);
        try { await channelsService.sendDevError(error); } catch { }
      }
      throw error;
    }
  }

  private async addRoleIfNotHave(
    member: GuildMember,
    roleId: RoleId,
  ): Promise<boolean> {
    if (member.roles.cache.has(roleId)) {
      return false;
    }
    await member.roles.add(roleId);
    return true;
  }

  private prepareResponseEmbed(
    numOfficers: number,
    spreadsheetUrl: string,
    missingUsernames: string[],
    missingRoles: Committee[],
  ): EmbedBuilder {
    const spreadsheetHyperlink = hyperlink(
      "officer contact information spreadsheet",
      spreadsheetUrl,
    );

    const logSink = channelsService.getLogSink();
    const logsHyperlink = logSink ? channelMention(logSink.id) : null;

    // Success case.
    if (missingUsernames.length === 0 && missingRoles.length === 0) {
      let description = (
        `Successfully updated all ${bold(numOfficers.toString())} officers ` +
        `using data from the ${spreadsheetHyperlink}.`
      );
      if (logsHyperlink !== null) {
        description += `\n\nSee: ${logsHyperlink}`;
      }
      return new EmbedBuilder()
        .setTitle("Officer Roles Updated")
        .setDescription(description)
        .setColor(Colors.Green);
    }

    const errorDescriptionLines = [
      `Of the ${bold(numOfficers.toString())} officers parsed from the ` +
      `${spreadsheetHyperlink}, we have:`,
    ];
    if (missingUsernames.length > 0) {
      const missingUsernamesString = missingUsernames
        .map(username => inlineCode(`@${username}`))
        .join(", ");
      errorDescriptionLines.push(
        `- ${EMOJI_WARNING} Missing usernames: ${missingUsernamesString}`,
      );
    }
    if (missingRoles.length > 0) {
      const missingRolesString = missingRoles.map(inlineCode).join(", ");
      errorDescriptionLines.push(
        `- ${EMOJI_ALERT} Missing role for committees: ${missingRolesString}`,
      );
    }
    if (logsHyperlink !== null) {
      errorDescriptionLines.push(
        `See successfully updated officers: ${logsHyperlink}`,
      );
    }

    return new EmbedBuilder()
      .setTitle("Officer Roles Updated [SOME ERROR]")
      .setDescription(errorDescriptionLines.join("\n"))
      .setColor(Colors.Red);
  }
}

export default new OfficerAssignCommand();
