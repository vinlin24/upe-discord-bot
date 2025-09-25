import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";

import { SlashCommandHandler } from "../../abc/command.abc";

class WhoamiCommand extends SlashCommandHandler {
  public override readonly definition = new SlashCommandBuilder()
    .setName("whoami")
    .setDescription("Get your Discord ID")
    .addUserOption(input => input
      .setName("user")
      .setDescription("User whose ID to check. Defaults to yourself.")
    )
    .toJSON();

  public override async execute(
    interaction: ChatInputCommandInteraction,
  ): Promise<void> {
    const targetUser = interaction.options.getUser("user") ?? interaction.user;
    await interaction.reply({
      content: targetUser.id,
      ephemeral: true,
    });
  }
}

export default new WhoamiCommand();
