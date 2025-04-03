import {
  bold,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type Client,
} from "discord.js";

import type { SlashCommandCheck } from "../../abc/check.abc";
import { SlashCommandHandler } from "../../abc/command.abc";
import { Privilege, PrivilegeCheck } from "../../middleware/privilege.middleware";

class PingCommand extends SlashCommandHandler {
  public override readonly definition = new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Basic sanity check command.")
    .addBooleanOption(input => input
      .setName("broadcast")
      .setDescription("Whether to respond publicly instead of ephemerally")
    )
    .toJSON();

  public override readonly checks: SlashCommandCheck[] = [
    new PrivilegeCheck(this).atLeast(Privilege.Developer),
  ];

  public override async execute(
    interaction: ChatInputCommandInteraction,
  ): Promise<void> {
    const broadcast = interaction.options.getBoolean("broadcast");
    const content = `Hello there! ${this.formatLatency(interaction.client)}`;
    await interaction.reply({ content, ephemeral: !broadcast });
  }

  private formatLatency(client: Client): string {
    const latency = client.ws.ping;
    if (latency === -1) {
      return "Latency: (still being calculated...)";
    }
    return `Latency: ${bold(latency.toString())} ms`;
  }
}

export default new PingCommand();
