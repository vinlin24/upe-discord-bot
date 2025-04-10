import {
  bold,
  channelMention,
  chatInputApplicationCommandMention,
  Colors,
  EmbedBuilder,
  roleMention,
  SlashCommandBuilder,
  userMention,
  type ChatInputCommandInteraction,
} from "discord.js";

import type { SlashCommandCheck } from "../../abc/check.abc";
import { SlashCommandHandler } from "../../abc/command.abc";
import {
  Privilege,
  PrivilegeCheck,
} from "../../middleware/privilege.middleware";
import type { UrlString } from "../../types/branded.types";
import { quietHyperlink, toBulletedList } from "../../utils/formatting.utils";
import {
  ADVOCACY_ROLE_ID,
  CORPORATE_ROLE_ID,
  DEVELOPER_USER_ID,
  INDUCTEES_CHAT_CHANNEL_ID,
  INDUCTEES_ROLE_ID,
  INDUCTION_AND_MEMBERSHIP_ROLE_ID,
  INDUCTION_ANNOUNCEMENTS_CHANNEL_ID,
  SOCIAL_ROLE_ID,
  WEB_ROLE_ID,
} from "../../utils/snowflakes.utils";
import {
  INDUCTION_EMAIL,
  INDUCTION_LINKTREE,
  UPE_WEBSITE,
} from "../../utils/upe.utils";
import { LinktreeCommand } from "./linktree.command";

const LINKTREE_COMMAND_MENTION = chatInputApplicationCommandMention(
  LinktreeCommand.COMMAND_NAME,
  LinktreeCommand.COMMAND_ID,
);

const INDUCTION_EMAIL_LINK = quietHyperlink(
  INDUCTION_EMAIL,
  `mailto:${INDUCTION_EMAIL}` as UrlString,
);

const LINKTREE_DESCRIPTION = bold(
  "All important links are in one place in " +
  `${quietHyperlink("the Linktree", INDUCTION_LINKTREE)}.`,
) + ` You can also load it by running ${LINKTREE_COMMAND_MENTION}.`;

const CHANNEL_NAVIGATION =
  `Your ${roleMention(INDUCTEES_ROLE_ID)} role grants you access to:\n` +
  toBulletedList([
    `${channelMention(INDUCTION_ANNOUNCEMENTS_CHANNEL_ID)}: important ` +
    "announcements about the induction process, including action items.",

    `${channelMention(INDUCTEES_CHAT_CHANNEL_ID)}: where you can chat with ` +
    "other inductees or ask officers any questions.",
  ]);

const POINTS_OF_CONTACT =
  "Your points of contact:\n" +
  toBulletedList([
    "General question: feel free to ping " +
    `${roleMention(INDUCTION_AND_MEMBERSHIP_ROLE_ID)}.`,

    `Private question: email ${bold(INDUCTION_EMAIL_LINK)}.`,

    `Issue with ${bold(quietHyperlink("the web portal", UPE_WEBSITE))}: ` +
    `reach out to ${roleMention(WEB_ROLE_ID)}.`,

    `Question about a specific ${bold("social event")}: reach out to ` +
    `${roleMention(SOCIAL_ROLE_ID)}.`,

    `Question about a specific ${bold("professional event")}: reach out to ` +
    `${roleMention(CORPORATE_ROLE_ID)}.`,

    `Question about a specific ${bold("DEI workshop")}: reach out to ` +
    `${roleMention(ADVOCACY_ROLE_ID)}.`,

    "Discord-related question or if I ever go down due to developer " +
    `incompetence: reach out to ${userMention(DEVELOPER_USER_ID)}.`,
  ]);

const COMBINED_DESCRIPTION = [
  LINKTREE_DESCRIPTION,
  CHANNEL_NAVIGATION,
  POINTS_OF_CONTACT,
].join("\n\n");

class HelpCommand extends SlashCommandHandler {
  public override readonly definition = new SlashCommandBuilder()
    .setName("help")
    .setDescription(
      "List resources & points of contact for induction-related questions.",
    )
    .toJSON();

  public override readonly checks: SlashCommandCheck[] = [
    new PrivilegeCheck(this).atLeast(Privilege.Inductee),
  ];

  public override async execute(
    interaction: ChatInputCommandInteraction,
  ): Promise<void> {
    const embed = new EmbedBuilder()
      .setColor(Colors.Green)
      .setTitle("General Induction Help")
      .setDescription(COMBINED_DESCRIPTION);

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
}

export default new HelpCommand();
