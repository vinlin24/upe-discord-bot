import { pagination } from "@devraelfreeze/discordjs-pagination";
import {
  inlineCode,
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
import { commandLoader } from "../../bot/loaders";

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
    const loadedCommands = commandLoader.getAll();

    const entries: string[] = [];
    for (const handler of loadedCommands.values()) {
      const { name, description } = handler.definition;
      const formattedName = inlineCode(`/${name}`);
      entries.push(`${formattedName}: ${description}`);
    }

    const pages = splitIntoEmbedPages(entries);

    if (pages.length === 0) {
      await this.replyError(
        interaction,
        "No commands found somehow! This is a bug.",
      );
      return;
    }

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
