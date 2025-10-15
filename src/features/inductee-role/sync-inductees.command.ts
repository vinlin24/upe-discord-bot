import {
  codeBlock,
  Colors,
  EmbedBuilder,
  inlineCode,
  italic,
  roleMention,
  SlashCommandBuilder,
  spoiler,
  userMention,
  type ChatInputCommandInteraction,
  type Guild,
  type GuildMember,
  type Message,
  type Role,
} from "discord.js";
import _ from "lodash";

import type { SlashCommandCheck } from "../../abc/check.abc";
import { SlashCommandHandler } from "../../abc/command.abc";
import { GoogleSheetsClient } from "../../clients/sheets.client";
import env from "../../env";
import {
  Privilege,
  PrivilegeCheck,
} from "../../middleware/privilege.middleware";
import channelsService from "../../services/channels.service";
import inducteeSheetsService, {
  InducteeStatus,
  type InducteeData,
} from "../../services/inductee-sheets.service";
import type { UrlString, UserId } from "../../types/branded.types";
import { setDifference } from "../../utils/data.utils";
import {
  EMOJI_CHECK,
  EMOJI_IN_PROGRESS,
  EMOJI_INFORMATION,
  EMOJI_WARNING,
} from "../../utils/emojis.utils";
import { isUnknownMemberError } from "../../utils/errors.utils";
import {
  boldNum,
  quietHyperlink,
  toBulletedList,
} from "../../utils/formatting.utils";
import { INDUCTEES_ROLE_ID } from "../../utils/snowflakes.utils";

const REGISTRY_URL = GoogleSheetsClient.idToUrl(
  env.INDUCTEE_DATA_SPREADSHEET_ID,
);

class SyncInducteesCommand extends SlashCommandHandler {
  public override readonly definition = new SlashCommandBuilder()
    .setName("syncinductees")
    .setDescription("Sync inductees role with inductee registry spreadsheet")
    .toJSON();

  public override readonly checks: SlashCommandCheck[] = [
    new PrivilegeCheck(this).atLeast(Privilege.Induction),
  ];

  public override async execute(
    interaction: ChatInputCommandInteraction,
  ): Promise<void> {
    await interaction.deferReply();

    const upe = interaction.guild!;
    const caller = interaction.member as GuildMember;
    let inducteeRole = await this.getInducteeRole(upe);

    const loadingLines: string[] = [];

    loadingLines.push(
      `Reading inductee data from ${quietHyperlink("registry", REGISTRY_URL)}`,
    );
    await interaction.editReply(this.formatLoadingLines(loadingLines));

    const registeredInductees = await inducteeSheetsService.getAllData(true);
    const activeIds = new Set(
      registeredInductees
        .filter(data => data.status === InducteeStatus.Active)
        .map(data => data.discordId),
    );

    // Users that are not active && have the role should have role removed.
    const idsWithRole = new Set(inducteeRole.members.keys()) as Set<UserId>;
    const idsExpiredRole = setDifference(idsWithRole, activeIds);
    loadingLines.push(`Revoking role from ${idsExpiredRole.size} users`);
    await interaction.editReply(this.formatLoadingLines(loadingLines));
    await this.revokeInducteeRole(
      upe,
      idsExpiredRole,
      caller,
    );

    // Users that are active && don't have the role need the role.
    const idsNeedingRole = setDifference(activeIds, idsWithRole);
    loadingLines.push(
      `Attempting to grant role to ${idsNeedingRole.size} users`,
    );
    await interaction.editReply(this.formatLoadingLines(loadingLines));
    const idsNotInServer = await this.grantInducteeRole(
      upe,
      idsNeedingRole,
      caller,
    );

    // Sanity check that num @Inductees === num active.
    inducteeRole = await this.getInducteeRole(upe);
    const numInducteeUsersNow = inducteeRole.members.size;

    // Final ACK.
    const ackEmbed = new EmbedBuilder();
    const ackDetails = [
      `There are ${boldNum(activeIds.size)} ` +
      quietHyperlink("active inductees", REGISTRY_URL),

      `There ${italic("were")} ${boldNum(idsWithRole.size)} server members ` +
      `already with ${roleMention(INDUCTEES_ROLE_ID)}`,

      `There are ${italic("now")} ${boldNum(numInducteeUsersNow)} server ` +
      `members with ${roleMention(INDUCTEES_ROLE_ID)}`,

      `Revoked ${roleMention(INDUCTEES_ROLE_ID)} from ` +
      `${boldNum(idsExpiredRole.size)} server members`,
    ];
    if (
      idsNotInServer.length === 0
      && activeIds.size === numInducteeUsersNow
    ) {
      ackEmbed.setColor(Colors.Green);
      ackEmbed.setTitle(`${EMOJI_INFORMATION} ${this.id} Success`);
      ackDetails.push(
        `Granted ${roleMention(INDUCTEES_ROLE_ID)} to ` +
        `${boldNum(idsNeedingRole.size)} server members`,
      )
    }
    else {
      ackEmbed.setColor(Colors.Red);
      ackEmbed.setTitle(`${EMOJI_WARNING} ${this.id} Partial Success`);
      const actualNumGranted = idsNeedingRole.size - idsNotInServer.length;
      ackDetails.push(
        `Granted ${roleMention(INDUCTEES_ROLE_ID)} to ` +
        `${boldNum(actualNumGranted)} server members`,
      );
      ackDetails.push(
        `Couldn't find ${boldNum(idsNotInServer.length)} active ` +
        "inductees in the server",
      )
    }
    ackEmbed.setDescription(toBulletedList(ackDetails));

    await interaction.editReply({
      content: this.formatLoadingLines(loadingLines, true),
      embeds: [ackEmbed],
    });

    // Finally, log missing inductees, if any.
    const missingInductees = idsNotInServer.map(
      userId => registeredInductees.get(userId)!,
    )
    const messageReply = await interaction.fetchReply();
    const loggedMessage = await this.logAllMissingInductees(
      missingInductees,
      messageReply.url as UrlString,
    )

    if (loggedMessage !== null) {
      // Have our command response & log dump message link to each other.
      await interaction.editReply({
        content: `${messageReply.content}\nSee: ${loggedMessage.url}`,
        embeds: [ackEmbed],
      });
    }
  }

  private async grantInducteeRole(
    upe: Guild,
    userIds: Iterable<UserId>,
    caller: GuildMember,
  ): Promise<UserId[]> {
    const missingIds: UserId[] = [];

    for (const userId of userIds) {
      let member: GuildMember;
      try {
        member = await upe.members.fetch(userId);
      }
      catch (error) {
        if (isUnknownMemberError(error)) {
          console.warn(
            `Inductee with user Id ${userId} active in registry but ` +
            "not found in the server."
          )
          missingIds.push(userId);
          continue;
        }
        throw error;
      }

      await member.roles.add(
        INDUCTEES_ROLE_ID,
        `${this.id} by @${caller.user.username}`,
      );
    }

    return missingIds;
  }

  private async revokeInducteeRole(
    upe: Guild,
    userIds: Iterable<UserId>,
    caller: GuildMember,
  ): Promise<void> {
    for (const userId of userIds) {
      // Supposedly shouldn't error.
      const member = await upe.members.fetch(userId);

      await member.roles.remove(
        INDUCTEES_ROLE_ID,
        `${this.id} by ${caller.user.username}`,
      );
    }
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
      embedEntries.push(`${legalName} (${inlineCode(userMention(discordId))})`);
    }

    const commaSepEmails = missing.map(info => info.preferredEmail).join(",");
    console.warn(
      "ENDWARNING. The following are the email addresses you can use to " +
      "contact these users to let them know their Discord ID is invalid " +
      "and/or they are not in the server:",
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

  // TODO: If this pattern is used enough, make it its own helper. At the
  // moment, /progress also uses it.
  private formatLoadingLines(
    loadingLines: string[],
    done: boolean = false,
  ): string {
    const editedLines: string[] = [];

    // Acknowledge "completed" on all but the last line, unless all done.
    for (let index = 0; index < loadingLines.length - 1; index++) {
      editedLines.push(`${EMOJI_CHECK} ${loadingLines[index]}`);
    }
    if (loadingLines.length > 0) {
      if (done) {
        editedLines.push(
          `${EMOJI_CHECK} ${loadingLines[loadingLines.length - 1]}`,
        );
      }
      else {
        editedLines.push(
          `${EMOJI_IN_PROGRESS} ${loadingLines[loadingLines.length - 1]}`,
        );
      }
    }

    return editedLines.join("\n");
  }

  private async getInducteeRole(upe: Guild): Promise<Role> {
    const role = await upe.roles.fetch(INDUCTEES_ROLE_ID);
    if (role === null) {
      throw new Error(
        `CRITICAL: Inductee role not found (expected ID ${INDUCTEES_ROLE_ID})`,
      );
    }
    return role;
  }
}

export default new SyncInducteesCommand();
