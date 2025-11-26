import {
  bold,
  Colors,
  EmbedBuilder,
  inlineCode,
  roleMention,
  time,
  TimestampStyles,
  underscore,
  userMention,
  type ChatInputCommandInteraction,
  type GuildMember,
} from "discord.js";

import type { SlashCommandCheck } from "../../abc/check.abc";
import { SlashCommandHandler } from "../../abc/command.abc";
import {
  highestPrivilege,
  Privilege,
  PrivilegeCheck,
} from "../../middleware/privilege.middleware";
import inducteeSheetsService from "../../services/inductee-sheets.service";
import requirementSheetsService, {
  type RequirementsData,
} from "../../services/requirement-sheets.service";
import type { TutoringData } from "../../services/tutoring-sheets.service";
import type { UserId } from "../../types/branded.types";
import { SystemDateClient, type IDateClient } from "../../utils/date.utils";
import {
  EMOJI_CHECK,
  EMOJI_CLOCK,
  EMOJI_CROSS,
  EMOJI_IN_PROGRESS,
  EMOJI_INFORMATION,
  EMOJI_WARNING,
  type BuiltinEmoji,
} from "../../utils/emojis.utils";
import { makeErrorEmbed } from "../../utils/errors.utils";
import {
  littleText,
  possessive,
  quietHyperlink,
  timestampPair,
  toBulletedList,
} from "../../utils/formatting.utils";
import { ExtendedSlashCommandBuilder } from "../../utils/options.utils";
import { INDUCTION_AND_MEMBERSHIP_ROLE_ID } from "../../utils/snowflakes.utils";
import {
  PUBLIC_REQUIREMENT_TRACKER_SPREADSHEET_URL,
  REQUIREMENTS_DOCUMENT_LINK,
  UPE_WEBSITE,
} from "../../utils/upe.utils";

// TODO: Could centralize such details in some "requirements spec".
const NUM_PROFESSIONAL_EVENTS_REQUIRED = 1;
const NUM_SOCIAL_EVENTS_REQUIRED = 2;
const NUM_ONE_ON_ONES_REQUIRED = 2;
const NUM_TESTS_REQUIRED = 3;

const TRACKER_HYPERLINK = quietHyperlink(
  "official requirement tracker spreadsheet",
  PUBLIC_REQUIREMENT_TRACKER_SPREADSHEET_URL,
);

class TrackerCommand extends SlashCommandHandler {
  public override readonly definition = new ExtendedSlashCommandBuilder()
    .setName("progress")
    .setDescription(
      "Get an overview of your progress on induction requirements.",
    )
    .addUserOption(input => input
      .setName("inductee")
      .setDescription("[OFFICERS ONLY] Specific inductee to view.")
    )
    .addBroadcastOption()
    .toJSON();

  public override readonly checks: SlashCommandCheck[] = [
    new PrivilegeCheck(this).atLeast(Privilege.Inductee),
  ];

  public constructor(private readonly dateClient: IDateClient) { super(); }

  public override async execute(
    interaction: ChatInputCommandInteraction,
  ): Promise<void> {
    const broadcast = interaction.options.getBoolean("broadcast");
    await interaction.deferReply({ ephemeral: !broadcast });

    const caller = interaction.member as GuildMember;
    let targetInductee = interaction.options.getMember(
      "inductee",
    ) as GuildMember | null;

    if (targetInductee && highestPrivilege(caller) < Privilege.Officer) {
      const errorEmbed = makeErrorEmbed(
        "You can only specify another inductee user if you're an officer.",
      );
      await interaction.editReply({ embeds: [errorEmbed] });
      return;
    }
    targetInductee ??= caller;

    const loadingLines: string[] = [];

    loadingLines.push(
      `Resolving inductee (${this.getAgoMention()})...`,
    );
    await interaction.editReply(this.formatLoadingLines(loadingLines));
    const userId = targetInductee.user.id as UserId;
    const inducteeData = await inducteeSheetsService.getData(userId);
    if (inducteeData === null) {
      const errorEmbed = makeErrorEmbed(
        "We don't seem to have data for your user. " +
        "If you believe this is a mistake, " +
        `reach out to ${roleMention(INDUCTION_AND_MEMBERSHIP_ROLE_ID)}!\n\n` +
        `You can also visit the ${TRACKER_HYPERLINK} to view progress.`,
      );
      await interaction.editReply({ embeds: [errorEmbed] });
      return;
    }

    loadingLines.push(
      `Fetching requirements data (${this.getAgoMention()})...`,
    );
    await interaction.editReply(this.formatLoadingLines(loadingLines));
    const trackerName = inducteeData.preferredName ?? inducteeData.legalName;
    const requirementsData = await requirementSheetsService.getData(
      trackerName,
    );
    if (requirementsData === null) {
      const errorEmbed = makeErrorEmbed(
        "Failed to retrieve requirement tracker data based on your provided " +
        `name ${inlineCode(trackerName)}. If you believe this is a mistake, ` +
        `reach out to ${roleMention(INDUCTION_AND_MEMBERSHIP_ROLE_ID)}!\n\n` +
        `You can also visit the ${TRACKER_HYPERLINK} to view progress.`,
      );
      await interaction.editReply({ embeds: [errorEmbed] });
      return;
    }

    loadingLines.push(
      `Formatting your progress (${this.getAgoMention()})...`,
    );
    await interaction.editReply(this.formatLoadingLines(loadingLines));
    const embed = this.formatProgressEmbed(requirementsData, targetInductee);

    await interaction.editReply({ content: "", embeds: [embed] });
  }

  private formatProgressEmbed(
    data: RequirementsData,
    inductee: GuildMember,
  ): EmbedBuilder {
    // NOTE: Due to how requirements are trickily spread across different
    // sources of truth, the details returned may not be exhaustive.

    let mention = `${bold("Inductee member:")} ${userMention(inductee.id)}`;

    const isReady = this.isReadyToInduct(data);
    if (isReady) {
      mention += (
        `\n${EMOJI_CHECK} ` +
        underscore(bold("READY TO INDUCT. Attend ceremony!"))
      );
    }

    const progressLines = toBulletedList(this.formatProgressLines(data));

    const information = (
      `${EMOJI_INFORMATION} View the requirements in more detail in our ` +
      `${quietHyperlink("requirements document", REQUIREMENTS_DOCUMENT_LINK)}.`
    );

    const disclaimer = (
      `${EMOJI_WARNING} This is an experimental feature. If you believe ` +
      `there is a discrepancy, refer to the ${bold(TRACKER_HYPERLINK)} ` +
      "as the source of truth."
    );

    const [
      lastUpdatedMention,
      lastUpdatedRelative,
    ] = timestampPair(requirementSheetsService.lastUpdateTime);
    const lastUpdated = littleText(
      `${EMOJI_CLOCK} Data parsed from our private tracker spreadsheet, ` +
      `last synced ${lastUpdatedMention} (${lastUpdatedRelative}).`,
    );

    const description = [
      mention,
      progressLines,
      information,
      disclaimer,
      lastUpdated,
    ].join("\n\n");

    return new EmbedBuilder()
      .setTitle(`${possessive(data.name)} Induction Progress`)
      .setDescription(description)
      .setColor(isReady ? Colors.Green : null);
  }

  private formatProgressLines(data: RequirementsData): string[] {
    return [
      // TODO: For F25 only, this check is bypassed. Tutoring tracker was broken
      // the only quarter.
      // this.formatTutoringProgress(data.tutoring),
      this.formatBooleanProgress("Demographics Survey", data.demographics),
      this.formatCountProgress(
        "Professional Events",
        data.professional,
        NUM_PROFESSIONAL_EVENTS_REQUIRED,
      ),
      this.formatCountProgress(
        "Social Events",
        data.social,
        NUM_SOCIAL_EVENTS_REQUIRED,
      ),
      this.formatBooleanProgress("Ethics Discussion", data.ethics),
      this.formatCountProgress(
        "Officer One-on-Ones",
        data.oneOnOnes,
        NUM_ONE_ON_ONES_REQUIRED,
      ),
      this.formatBooleanProgress("CS Town Hall Survey", data.townHall),
      this.formatUnhandledProgress(
        `Upload ${NUM_TESTS_REQUIRED} Tests`,
        quietHyperlink("your web portal", UPE_WEBSITE),
      ),
      this.formatBooleanProgress("One-Time Initiation Fee", data.fee),
      this.formatBooleanProgress("Induction Ceremony", data.ceremony),
    ];
  }

  private formatBooleanProgress(title: string, satisfied: boolean): string {
    if (satisfied) {
      return `${EMOJI_CHECK} ${bold(title + ":")} Completed`;
    }
    return `${EMOJI_CROSS} ${bold(title + ":")} Missing`;
  }

  private formatCountProgress(
    title: string,
    currentCount: number,
    requiredCount: number,
  ): string {
    let emoji: BuiltinEmoji;
    let statusPhrase: string;
    if (currentCount >= requiredCount) {
      emoji = EMOJI_CHECK;
      statusPhrase = "Completed";
    }
    else if (currentCount > 0) {
      emoji = EMOJI_IN_PROGRESS;
      statusPhrase = "In Progress";
    }
    else {
      emoji = EMOJI_CROSS;
      statusPhrase = "Not Started";
    }
    return (
      `${emoji} ${bold(title + ":")} ` +
      `${statusPhrase} (${currentCount} / ${requiredCount})`
    );
  }

  private formatTutoringProgress(tutoringData: TutoringData | null): string {
    const title = "Weekly Drop-In Tutoring";

    if (tutoringData === null) {
      return (
        `${EMOJI_WARNING} ${bold(title)}: Failed to load, ` +
        `refer to ${TRACKER_HYPERLINK}`
      );
    }

    return this.formatCountProgress(
      title,
      tutoringData.cappedTotal,
      tutoringData.requiredCount,
    );
  }

  private formatUnhandledProgress(title: string, referTo: string): string {
    return `${EMOJI_INFORMATION} ${bold(title + ":")} Refer to ${referTo}.`;
  }

  private formatLoadingLines(loadingLines: string[]): string {
    const editedLines: string[] = [];

    for (let index = 0; index < loadingLines.length - 1; index++) {
      editedLines.push(`${loadingLines[index]} Done.`);
    }
    editedLines.push(loadingLines[loadingLines.length - 1]);
    editedLines.push(
      `You can directly visit the ${TRACKER_HYPERLINK} if this takes too long.`,
    );

    return editedLines.join("\n");
  }

  private isReadyToInduct(data: RequirementsData): boolean {
    return (
      data.demographics &&
      data.ethics &&
      data.fee &&
      data.oneOnOnes >= NUM_ONE_ON_ONES_REQUIRED &&
      data.professional >= NUM_PROFESSIONAL_EVENTS_REQUIRED &&
      data.social >= NUM_SOCIAL_EVENTS_REQUIRED &&
      // data.tests === NUM_TESTS_REQUIRED &&
      data.townHall
      // TODO: For F25 only, this check is bypassed. Tutoring tracker was broken
      // the only quarter.
      // data.tutoring?.cappedTotal === data.tutoring?.requiredCount
    );
  }

  private getAgoMention(): string {
    return time(this.dateClient.getNow(), TimestampStyles.RelativeTime);
  }
}

export default new TrackerCommand(new SystemDateClient());
