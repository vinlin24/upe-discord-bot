import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  EmbedBuilder,
  MessageComponentInteraction
} from "discord.js";

export async function eventPages(
  interaction: MessageComponentInteraction,
  pages: Array<EmbedBuilder>,
  images: AttachmentBuilder[],
  time: number = 300000,
) {
  await interaction.deferReply();

  let index = 0;

  if (pages.length === 0) {
    return await interaction.editReply({ content: "No events yet" });
  }

  const first = new ButtonBuilder()
    .setCustomId("first")
    .setEmoji("⏮️")
    .setStyle(ButtonStyle.Primary)
    .setDisabled(true);

  const prev = new ButtonBuilder()
    .setCustomId("prev")
    .setEmoji("◀️")
    .setStyle(ButtonStyle.Primary)
    .setDisabled(true);

  const next = new ButtonBuilder()
    .setCustomId("next")
    .setEmoji("▶️")
    .setStyle(ButtonStyle.Primary)
    .setDisabled(pages.length <= 1)

  const end = new ButtonBuilder()
    .setCustomId("end")
    .setEmoji("⏭️")
    .setStyle(ButtonStyle.Primary)
    .setDisabled(pages.length <= 1)

  const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    first,
    prev,
    next,
    end
  );

  const currentPage = await interaction.editReply({
    embeds: [pages[index]],
    components: [buttonRow],
    files: [images[index]],
  });

  const collector = await currentPage.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time,
  });

  collector.on("collect", async (i) => {
    await i.deferUpdate();

    switch (i.customId) {
      case "first":
        index = 0;
        break;
      case "prev":
        if (index > 0) index--;
        break;
      case "next":
        if (index < pages.length - 1) index++;
        break;
      case "end":
        index = pages.length - 1;
        break;
    }

    first.setDisabled(index === 0);
    prev.setDisabled(index === 0);
    next.setDisabled(index === pages.length - 1);
    end.setDisabled(index === pages.length - 1);

    await currentPage.edit({
      embeds: [pages[index]],
      components: [buttonRow],
      files: [images[index]],
    });

    collector.resetTimer();
  });

  collector.on("end", async (i) => {
    await currentPage.edit({
      embeds: [pages[index]],
      components: [],
      files: [images[index]],
    });
  });
}
