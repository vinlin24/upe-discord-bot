import {
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
  inlineCode,
  type ChatInputCommandInteraction,
  type Role,
} from "discord.js";

import {
  isMissingAccessError,
  isMissingPermissionsError,
} from "../../utils/errors.utils";
import {
  INDUCTEES_ROLE_ID,
  MEMBERS_ROLE_ID,
} from "../../utils/snowflakes.utils";

const COMMAND_NAME = "inductall";

module.exports = {
  data: new SlashCommandBuilder()
    .setName(COMMAND_NAME)
    .setDescription("Exchange everyone's inductee role for the members role.")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addBooleanOption((option) => option
      .setName("preserve")
      .setDescription("Preserve inductee role, just add members role.")
    ),
  execute: inductAll,
};

async function inductAll(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const { guild } = interaction;
  if (!guild) {
    await interaction.reply(
      "⚠️ This command can only be used within the UPE server.",
    );
    return;
  }

  const inducteesRole = guild.roles.cache.get(INDUCTEES_ROLE_ID);
  if (!inducteesRole) {
    await interaction.reply({
      content:
        "⚠️ Could not find the inductee role " +
        `(expected role with ID ${inlineCode(INDUCTEES_ROLE_ID)}).`,
      ephemeral: true,
    });
    return;
  }

  const membersRole = guild.roles.cache.get(MEMBERS_ROLE_ID);
  if (!membersRole) {
    await interaction.reply({
      content:
        "⚠️ Could not find the members role " +
        `(expected role with ID ${inlineCode(MEMBERS_ROLE_ID)}).`,
      ephemeral: true,
    });
    return;
  }

  const preserveInductees = !!interaction.options.getBoolean("preserve");

  await exchangeRoleForAllInductees(
    inducteesRole,
    membersRole,
    interaction,
    preserveInductees,
  );
}

async function exchangeRoleForAllInductees(
  inducteesRole: Role,
  membersRole: Role,
  interaction: ChatInputCommandInteraction,
  preserveInductees: boolean = false,
): Promise<void> {
  await interaction.deferReply();

  const { user: caller } = interaction;

  const numInductees = inducteesRole.members.size;
  let numSucceeded = 0;

  const reason = `@${caller.username}: /${COMMAND_NAME}`;
  for (const guildMember of inducteesRole.members.values()) {
    try {
      await guildMember.roles.add(membersRole, reason);
      if (!preserveInductees) {
        await guildMember.roles.remove(inducteesRole, reason);
      }
      numSucceeded += 1;
    }
    catch (error) {
      if (isMissingAccessError(error) || isMissingPermissionsError(error)) {
        console.error(
          "ERROR: bot is not allowed to add and/or remove roles for " +
          `member @${guildMember.user.username} (ID=${guildMember.id}).`,
        );
        continue;
      }
      throw error; // Propagate to outer handler.
    }
  }

  const embed = new EmbedBuilder()
    .setColor(membersRole.color)
    .setDescription(
      `Converted ${numSucceeded}/${numInductees} ` +
      `${inducteesRole} to ${membersRole}. Congratulations!`,
    );

  await interaction.editReply({ embeds: [embed] });
}
