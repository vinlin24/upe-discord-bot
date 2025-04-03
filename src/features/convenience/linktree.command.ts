import cheerio from "cheerio";
import {
  bold,
  ChatInputCommandInteraction,
  ColorResolvable,
  EmbedBuilder,
  hyperlink,
} from "discord.js";

import { SlashCommandHandler } from "../../abc/command.abc";
import type { UrlString } from "../../types/branded.types";
import { ExtendedSlashCommandBuilder } from "../../utils/options.utils";

const INDUCTION_LINKTREE_URL = "https://linktr.ee/upe_induction" as UrlString;
const UPE_BLUE: ColorResolvable = "#3067d3";

type LinkEntry = {
  redirectLink?: UrlString;
  displayedText: string;
};

type CategoryLinks = {
  name: string;
  entries: LinkEntry[];
}

class LinktreeCommand extends SlashCommandHandler {
  public override readonly definition = new ExtendedSlashCommandBuilder()
    .setName("linktree")
    .setDescription("Get the UPE Linktree links.")
    .addBooleanOption(input => input
      .setName("simple")
      .setDescription("Just output the Linktree URL itself and nothing else.")
    )
    .addBroadcastOption()
    .toJSON();

  public override async execute(
    interaction: ChatInputCommandInteraction,
  ): Promise<void> {
    const simple = interaction.options.getBoolean("simple");
    const broadcast = interaction.options.getBoolean("broadcast");

    let responseEmbed: EmbedBuilder;
    if (simple) {
      responseEmbed = this.prepareSimpleResponse();
    }
    else {
      const linktreeHtml = await this.fetchHTMLOfWebPage(
        INDUCTION_LINKTREE_URL,
      );
      // Fetching failed, just display the Linktree link.
      if (linktreeHtml === null) {
        responseEmbed = this.prepareSimpleResponse();
      }
      else {
        const linktreeEntries = this.extractLinktreeEntries(linktreeHtml);
        responseEmbed = this.prepareExpandedResponse(linktreeEntries);
      }
    }

    await interaction.reply({
      embeds: [responseEmbed],
      ephemeral: !broadcast,
    });
  }

  private prepareSimpleResponse(): EmbedBuilder {
    return new EmbedBuilder()
      .setDescription(INDUCTION_LINKTREE_URL)
      .setColor(UPE_BLUE);
  }

  private prepareExpandedResponse(categories: CategoryLinks[]): EmbedBuilder {
    function entryToHyperlink(entry: LinkEntry): string {
      const { redirectLink, displayedText } = entry;
      return redirectLink
        ? hyperlink(displayedText, redirectLink)
        : displayedText;
    }

    function categoryToBulletedList(category: CategoryLinks): string {
      const { name, entries } = category;
      const bulletedList = entries
        .map(entryToHyperlink)
        .map(text => `* ${text}`)
        .join("\n");
      return `${bold(name)}\n${bulletedList}`;
    }

    const sections = categories.map(categoryToBulletedList);

    const addendum = `Visit the Linktree here: ${INDUCTION_LINKTREE_URL}`;
    sections.push(bold(addendum));

    const description = sections.join("\n\n");

    return new EmbedBuilder()
      .setTitle("UPE Induction Linktree")
      .setDescription(description)
      .setColor(UPE_BLUE)
      .setFooter({
        text: "TIP: the Linktree is in the inductee channel topic too.",
      });
  }

  private async fetchHTMLOfWebPage(url: string): Promise<string | null> {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`);
      }
      const html = await response.text();
      return html;
    } catch (error) {
      const { name, message } = error as Error;
      console.error(`ERROR: ${name} when fetching ${url}: ${message}`);
      return null;
    }
  }

  private extractLinktreeEntries(html: string): CategoryLinks[] {
    /** Selector of the actual link buttons in the Linktree. */
    const LINK_BUTTON_SELECTOR = 'a[data-testid="LinkButton"]';

    const $ = cheerio.load(html);
    const categories: CategoryLinks[] = [];

    // The category titles are found as <h3>s in the HTML. Traverse each <h3>
    // and subsequent links to build each category.
    $("h3").each((_, element) => {
      const categoryName = $(element).text().trim();
      const entries: LinkEntry[] = [];

      // Traverse from the <h3>s parent div to the next <div>s containing the
      // <a> elements.
      let nextDiv = $(element).parent().parent().next("div");

      // Continue to traverse & extract links while <div>s contain link buttons.
      while (nextDiv.length && nextDiv.find(LINK_BUTTON_SELECTOR).length) {
        // Iterate over each link button inside the current <div>.
        nextDiv.find(LINK_BUTTON_SELECTOR).each((_, linkElement) => {
          const redirectLink = $(linkElement)
            .attr("href") as UrlString | undefined;
          const displayedText = $(linkElement)
            .find("p").text().trim();

          entries.push({ redirectLink, displayedText });
        });

        nextDiv = nextDiv.next("div");
      }

      categories.push({ name: categoryName, entries });
    });

    return categories;
  }
}

export default new LinktreeCommand();
