import { pagination } from "@devraelfreeze/discordjs-pagination";
import {
  chatInputApplicationCommandMention,
  inlineCode,
  quote,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";

import type { SlashCommandCheck } from "../../abc/check.abc";
import { SlashCommandHandler } from "../../abc/command.abc";
import {
  Privilege,
  PrivilegeCheck,
} from "../../middleware/privilege.middleware";
import { splitIntoEmbedPages } from "../../utils/formatting.utils";

class CommandsCommand extends SlashCommandHandler {
  public override readonly definition = new SlashCommandBuilder()
    .setName("commands")
    .setDescription("List all commands.")
    .toJSON();

  public override readonly checks: SlashCommandCheck[] = [
    new PrivilegeCheck(this).atLeast(Privilege.Developer),
  ];

  public override async execute(
    interaction: ChatInputCommandInteraction,
  ): Promise<void> {
    const { client } = interaction;

    const entries: string[] = [];
    for (const apiCommand of client.application.commands.cache.values()) {
      const { id, name, description } = apiCommand;
      const mention = chatInputApplicationCommandMention(name, id);
      entries.push(`${mention}: ${inlineCode(mention)}\n${quote(description)}`);
    }

    const pages = splitIntoEmbedPages(entries);
    await pagination({
      // @ts-expect-error: Requires Embed, but Embed constructor is private, and
      // we can't get Embed from EmbedBuilder. Leaving it as EmbedBuilder seems
      // to work just fine...
      embeds: pages,
      author: interaction.user,
      interaction,
      ephemeral: true,
    });
  }
}

export default new CommandsCommand();
