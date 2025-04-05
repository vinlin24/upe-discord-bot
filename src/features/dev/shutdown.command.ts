import {
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
import dmService from "../../services/dm.service";
import { formatContext } from "../../utils/formatting.utils";

class ShutdownCommand extends SlashCommandHandler {
  public override readonly definition = new SlashCommandBuilder()
    .setName("shutdown")
    .setDescription("Terminate the bot.")
    .toJSON();

  public override readonly checks: SlashCommandCheck[] = [
    new PrivilegeCheck(this).atLeast(Privilege.Administrator),
  ];

  public override async execute(
    interaction: ChatInputCommandInteraction,
  ): Promise<never> {
    try {
      console.warn(`${formatContext(interaction)}: shutting down the bot.`);
      await interaction.reply("Shutting down!");
      await dmService.getDev().send(
        `${userMention(interaction.user.id)} has shut down the bot!`,
      );
    }
    catch { } // Just don't prevent shutdown.
    process.exit(0);
  }
}

export default new ShutdownCommand();
