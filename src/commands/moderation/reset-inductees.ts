import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
  Role,
  SlashCommandBuilder,
  bold,
  inlineCode,
  roleMention,
} from "discord.js";

import {
  isMissingAccessError,
  isMissingPermissionsError,
} from "../../utils/errors.utils";
import { clearRole } from "../../utils/moderation.utils";
import { INDUCTEES_ROLE_ID } from "../../utils/snowflakes.utils";

const COMMAND_NAME = "resetinductees";

module.exports = {
  data: new SlashCommandBuilder()
    .setName(COMMAND_NAME)
    .setDescription("Remove the Inductees role from every member.")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  execute: clearInducteesRole,
};

async function clearInducteesRole(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const { guild } = interaction;
  if (!guild) {
    await interaction.reply(
      "⚠️ This command can only be used within the UPE server.",
    );
    return;
  }

  const role = guild.roles.cache.get(INDUCTEES_ROLE_ID);
  if (!role) {
    await interaction.reply({
      content:
        "⚠️ Could not find the inductee role " +
        `(expected role with ID ${inlineCode(INDUCTEES_ROLE_ID)}).`,
      ephemeral: true,
    });
    return;
  }

  await clearRoleAndReply(role, interaction);
}

async function clearRoleAndReply(
  role: Role,
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  await interaction.deferReply();

  const numInductees = role.members.size;
  const { user: caller } = interaction;

  try {
    await clearRole(role, `@${caller.username}: /${COMMAND_NAME}`);
  } catch (error) {
    if (isMissingAccessError(error) || isMissingPermissionsError(error)) {
      console.error("ERROR: bot is not allowed to remove roles.");
      await interaction.reply({
        content: "⚠️ I'm not allowed to perform this action!",
        ephemeral: true,
      });
      return;
    }
    throw error; // Propagate to outer handler.
  }

  console.log(`ACK: Removed role @${role.name} from ${numInductees} members.`);

  const embed = new EmbedBuilder()
    .setColor(role.color)
    .setDescription(
      `Removed ${roleMention(INDUCTEES_ROLE_ID)} ` +
      `from all members (${bold(numInductees.toString())} affected).`
    );
  await interaction.editReply({ embeds: [embed] });
}
