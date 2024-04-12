import cheerio from "cheerio";
import {
  ChatInputCommandInteraction,
  ColorResolvable,
  EmbedBuilder,
  SlashCommandBuilder,
  bold,
  hyperlink,
} from "discord.js";

import { addBroadcastOption } from "../../utils/options.utils";

const COMMAND_NAME = "linktree";

const INDUCTION_LINKTREE_URL = "https://linktr.ee/upe_induction";
const UPE_BLUE: ColorResolvable = "#3067d3";

const commandDefinition = new SlashCommandBuilder()
  .setName(COMMAND_NAME)
  .setDescription("Get the UPE Linktree links.")
  .addBooleanOption(input => input
    .setName("simple")
    .setDescription("Just output the Linktree URL itself and nothing else.")
  );
addBroadcastOption(commandDefinition);

module.exports = {
  data: commandDefinition,
  execute: displayUPELinktree,
};

async function displayUPELinktree(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const simple = interaction.options.getBoolean("simple");
  const broadcast = interaction.options.getBoolean("broadcast");

  let responseEmbed: EmbedBuilder;
  if (simple) {
    responseEmbed = prepareSimpleResponse();
  }
  else {
    const linktreeHtml = await fetchHTMLOfWebPage(INDUCTION_LINKTREE_URL);
    // Fetching failed, just display the Linktree link.
    if (linktreeHtml === null) {
      responseEmbed = prepareSimpleResponse();
    }
    else {
      const linktreeEntries = extractLinktreeEntries(linktreeHtml);
      responseEmbed = prepareExpandedResponse(linktreeEntries);
    }
  }

  await interaction.reply({
    embeds: [responseEmbed],
    ephemeral: !broadcast,
  });
}

type LinkEntry = {
  redirectLink: string;
  displayedText: string;
};

type CategoryLinks = {
  name: string;
  entries: LinkEntry[];
}

function prepareSimpleResponse(): EmbedBuilder {
  return new EmbedBuilder()
    .setDescription(INDUCTION_LINKTREE_URL)
    .setColor(UPE_BLUE);
}

function prepareExpandedResponse(categories: CategoryLinks[]): EmbedBuilder {
  function entryToHyperlink(entry: LinkEntry): string {
    const { redirectLink, displayedText } = entry;
    return hyperlink(displayedText, redirectLink);
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

async function fetchHTMLOfWebPage(url: string): Promise<string | null> {
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

function extractLinktreeEntries(html: string): CategoryLinks[] {
  /** Selector of the actual link buttons in the Linktree. */
  const LINK_BUTTON_SELECTOR = 'a[data-testid="LinkButton"]';

  const $ = cheerio.load(html);
  const categories: CategoryLinks[] = [];

  // The category titles are found as <h3>'s in the HTML. Traverse each <h3> and
  // subsequent links to build each category.
  $("h3").each((_, element) => {
    const categoryName = $(element).text().trim();
    const entries: LinkEntry[] = [];

    // Traverse from the <h3>'s parent div to the next <div>'s containing the
    // <a> elements.
    let nextDiv = $(element).parent().next("div");

    // Continue to traverse & extract links while <div>'s contain link buttons.
    while (nextDiv.length && nextDiv.find(LINK_BUTTON_SELECTOR).length) {
      const linkButtonElement = nextDiv.find(LINK_BUTTON_SELECTOR);

      const redirectLink = $(linkButtonElement).attr("href") || "";
      const displayedText = $(linkButtonElement).find("p").text().trim();
      entries.push({ redirectLink, displayedText });

      nextDiv = nextDiv.next("div");
    }

    categories.push({ name: categoryName, entries });
  });

  return categories;
}
