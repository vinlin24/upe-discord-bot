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
    .addBooleanOption(input => input
      .setName("enable")
      .setDescription("True for enable, false for disable.")
      .setRequired(true)
    )
    .addStringOption(input => input
      .setName("command_name")
      .setDescription("Name of command to set bypass state (omit for all).")
    )
    .toJSON();

  public override readonly checks: SlashCommandCheck[] = [
    new PrivilegeCheck(this).atLeast(Privilege.Developer),
  ];

  public override async execute(
    interaction: ChatInputCommandInteraction,
  ): Promise<void> {
    let commandName = interaction.options.getString("command_name");
    const enable = interaction.options.getBoolean("enable", true);

    if (commandName === null) {
      await interaction.reply({
        embeds: [this.processBypassAllOption(interaction, enable)],
        ephemeral: true,
      })
      return;
    }

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

  private processBypassAllOption(
    interaction: ChatInputCommandInteraction,
    enable: boolean,
  ): EmbedBuilder {
    for (const handler of commandLoader.getAll().values()) {
      handler.setDevBypass(enable);
    }
    console.warn(
      `${formatContext(interaction)}: ${enable ? "enabled" : "disabled"} ` +
      "developer bypass for ALL commands.",
    );

    const description = codeBlock("diff", enable ? "+ Enabled" : "- Disabled");
    const successEmbed = new EmbedBuilder()
      .setTitle("Developer Bypass: ALL Commands")
      .setDescription(description)
      .setColor(enable ? Colors.Green : Colors.Red);
    return successEmbed;
  }
}

export default new BypassCommand();
