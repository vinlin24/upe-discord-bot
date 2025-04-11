import {
  bold,
  EmbedBuilder,
  inlineCode,
  roleMention,
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
import {
  EMOJI_CHECK,
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
import { REQUIREMENTS_DOCUMENT_LINK, UPE_WEBSITE } from "../../utils/upe.utils";

// TODO: Could centralize such details in some "requirements spec".
const NUM_PROFESSIONAL_EVENTS_REQUIRED = 1;
const NUM_SOCIAL_EVENTS_REQUIRED = 2;
const NUM_ONE_ON_ONES_REQUIRED = 2;
const NUM_TESTS_REQUIRED = 3;

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

  public override async execute(
    interaction: ChatInputCommandInteraction,
  ): Promise<void> {
    const broadcast = interaction.options.getBoolean("broadcast");
    let targetInductee = interaction.options.getMember(
      "inductee",
    ) as GuildMember | null;
    const caller = interaction.member as GuildMember;

    if (targetInductee && highestPrivilege(caller) < Privilege.Officer) {
      const errorEmbed = makeErrorEmbed(
        "You can only specify another inductee user if you're an officer.",
      );
      await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
      return;
    }
    targetInductee ??= caller;

    const { username } = targetInductee.user;
    const inducteeData = await inducteeSheetsService.getData(username);
    if (inducteeData === null) {
      const errorEmbed = makeErrorEmbed(
        "We don't seem to have data based on your username " +
        `${inlineCode(username)}. If you believe this is a mistake, ` +
        `reach out to ${roleMention(INDUCTION_AND_MEMBERSHIP_ROLE_ID)}!`,
      );
      await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
      return;
    }

    const trackerName = inducteeData.preferredName ?? inducteeData.legalName;
    const requirementsData = await requirementSheetsService.getData(
      trackerName,
    );
    if (requirementsData === null) {
      const errorEmbed = makeErrorEmbed(
        "Failed to retrieve requirement tracker data based on your provided " +
        `name ${inlineCode(trackerName)}. If you believe this is a mistake, ` +
        `reach out to ${roleMention(INDUCTION_AND_MEMBERSHIP_ROLE_ID)}!`,
      );
      await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
      return;
    }

    const embed = this.formatProgressEmbed(requirementsData, targetInductee);
    await interaction.reply({ embeds: [embed], ephemeral: !broadcast });
  }

  private formatProgressEmbed(
    data: RequirementsData,
    inductee: GuildMember,
  ): EmbedBuilder {
    // NOTE: Due to how requirements are trickily spread across different
    // sources of truth, the details returned may not be exhaustive.

    const mention = `${bold("Inductee member:")} ${roleMention(inductee.id)}`;
    const progressLines = toBulletedList(this.formatProgressLines(data));

    const information = (
      `${EMOJI_INFORMATION} View the full list of requirements in our ` +
      `${quietHyperlink("requirements document", REQUIREMENTS_DOCUMENT_LINK)}.`
    );

    const disclaimer = (
      `${EMOJI_WARNING} This is an experimental feature. If you believe ` +
      "there is a discrepancy, refer to the " +
      bold(quietHyperlink(
        "public requirement tracker spreadsheet",
        REQUIREMENTS_DOCUMENT_LINK,
      )) +
      " as the source of truth."
    );

    const [
      lastUpdatedMention,
      lastUpdatedRelative,
    ] = timestampPair(requirementSheetsService.lastUpdateTime);
    const lastUpdated = littleText(
      `Data parsed from our private tracker, last synced ` +
      `${lastUpdatedMention} (${lastUpdatedRelative}).`,
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
      .setDescription(description);
  }

  private formatProgressLines(data: RequirementsData): string[] {
    return [
      this.formatUnhandledProgress(
        "Weekly Drop-In Tutoring",
        "main tracker spreadsheet",
      ),
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
      this.formatBooleanProgress("DEI Group Discussion", data.dei),
      this.formatCountProgress(
        "Officer One-on-Ones",
        data.oneOnOnes,
        NUM_ONE_ON_ONES_REQUIRED,
      ),
      this.formatBooleanProgress("Bit-Byte Challenge", data.bitByteChallenge),
      this.formatBooleanProgress("CS Town Hall Survey", data.townHall),
      this.formatBooleanProgress(
        "Technical Interview Workshop",
        data.interview,
      ),
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
      return `${EMOJI_CHECK} ${bold(title + ":")} Satisfied`;
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

  private formatUnhandledProgress(title: string, referTo: string): string {
    return `${EMOJI_INFORMATION} ${bold(title + ":")} Refer to ${referTo}.`;
  }
}

export default new TrackerCommand();
