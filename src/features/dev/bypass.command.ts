import {
  codeBlock,
  Colors,
  EmbedBuilder,
  inlineCode,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";

import type { SlashCommandCheck } from "../../abc/check.abc";
import { SlashCommandHandler } from "../../abc/command.abc";
import { commandLoader } from "../../bot/loaders";
import {
  Privilege,
  PrivilegeCheck,
} from "../../middleware/privilege.middleware";
import { formatContext } from "../../utils/formatting.utils";

class BypassCommand extends SlashCommandHandler {
  public override readonly definition = new SlashCommandBuilder()
    .setName("devbypass")
    .setDescription("Enable/disable developer bypass for a command.")
    .addStringOption(input => input
      .setName("command_name")
      .setDescription("Name of command to set bypass state.")
      .setRequired(true),
    )
    .addBooleanOption(input => input
      .setName("enable")
      .setDescription("True for enable, false for disable.")
      .setRequired(true)
    )
    .toJSON();

  public override readonly checks: SlashCommandCheck[] = [
    new PrivilegeCheck(this).atLeast(Privilege.Developer),
  ];

  public override async execute(
    interaction: ChatInputCommandInteraction,
  ): Promise<void> {
    let commandName = interaction.options.getString("command_name", true);
    const enable = interaction.options.getBoolean("enable", true);

    if (commandName.startsWith("/")) {
      commandName = commandName.slice(1);
    }

    const handler = commandLoader.get(commandName);
    if (handler === null) {
      await this.replyError(
        interaction,
        `Unrecognized command ${inlineCode("/" + commandName)}.`,
      );
      return;
    }

    handler.setDevBypass(enable);
    console.warn(
      `${formatContext(interaction)}: ${enable ? "enabled" : "disabled"} ` +
      `developer bypass for /${commandName}`,
    );

    const description = codeBlock("diff", enable ? "+ Enabled" : "- Disabled");
    const successEmbed = new EmbedBuilder()
      .setTitle(`Developer Bypass: /${commandName}`)
      .setDescription(description)
      .setColor(enable ? Colors.Green : Colors.Red);

    await interaction.reply({
      embeds: [successEmbed],
      ephemeral: true,
    });
  }
}

export default new BypassCommand();
