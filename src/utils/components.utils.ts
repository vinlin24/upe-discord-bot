import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  type ButtonInteraction,
  type EmbedBuilder,
  type MessageComponentInteraction,
} from "discord.js";

import type { Milliseconds } from "../types/branded.types";

const enum ButtonId {
  First = "first",
  Previous = "previous",
  Next = "next",
  Last = "last",
};

export type EmbedPagesManagerOptions = {
  timeout: Milliseconds;
  initialIndex: number;
};

export class EmbedPagesManager {
  private options: EmbedPagesManagerOptions;

  private pageIndex: number;

  private readonly buttonFirst: ButtonBuilder;
  private readonly buttonPrevious: ButtonBuilder;
  private readonly buttonNext: ButtonBuilder;
  private readonly buttonLast: ButtonBuilder;
  private readonly buttonRow: ActionRowBuilder<ButtonBuilder>;

  public constructor(
    private readonly pages: [EmbedBuilder, ...EmbedBuilder[]],
    options?: Partial<EmbedPagesManagerOptions>,
  ) {
    this.options = {
      timeout: options?.timeout ?? 300_000 as Milliseconds,
      initialIndex: options?.initialIndex ?? 0,
    };

    this.pageIndex = this.options.initialIndex;

    // NOTE: For some reason, we can't use BuiltinEmojis here. `.setEmoji()`
    // seems to require the actual Unicode emojis.

    this.buttonFirst = new ButtonBuilder()
      .setCustomId(ButtonId.First)
      .setEmoji("⏮️")
      .setStyle(ButtonStyle.Primary);

    this.buttonPrevious = new ButtonBuilder()
      .setCustomId(ButtonId.Previous)
      .setEmoji("◀️")
      .setStyle(ButtonStyle.Primary);

    this.buttonNext = new ButtonBuilder()
      .setCustomId(ButtonId.Next)
      .setEmoji("▶️")
      .setStyle(ButtonStyle.Primary);

    this.buttonLast = new ButtonBuilder()
      .setCustomId(ButtonId.Last)
      .setEmoji("⏭️")
      .setStyle(ButtonStyle.Primary);

    this.updateButtonDisableStates();

    this.buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      this.buttonFirst,
      this.buttonPrevious,
      this.buttonNext,
      this.buttonLast,
    );
  }

  public async start(interaction: MessageComponentInteraction): Promise<void> {
    const currentPage = await interaction.editReply({
      embeds: [this.currentEmbed],
      components: [this.buttonRow],
    });

    const collector = await currentPage.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: this.options.timeout,
    });

    collector.on("collect", async (interaction: ButtonInteraction) => {
      await interaction.deferUpdate();
      this.applyButtonStateChange(interaction.customId as ButtonId);
      await currentPage.edit({
        embeds: [this.currentEmbed],
        components: [this.buttonRow],
      });
      collector.resetTimer();
    });

    collector.on("end", async () => {
      await currentPage.edit({
        embeds: [this.currentEmbed],
        components: [], // Hide the button row.
      });
    });
  }

  private get currentEmbed(): EmbedBuilder {
    return this.pages[this.pageIndex];
  }

  private applyButtonStateChange(buttonId: ButtonId): void {
    switch (buttonId) {
      case ButtonId.First:
        this.pageIndex = 0;
        break;
      case ButtonId.Previous:
        if (this.pageIndex > 0) {
          this.pageIndex--;
        }
        break;
      case ButtonId.Next:
        if (this.pageIndex < this.pages.length - 1) {
          this.pageIndex++;
        }
        break;
      case ButtonId.Last:
        this.pageIndex = this.pages.length - 1;
        break;
    }

    this.updateButtonDisableStates();
  }

  private updateButtonDisableStates(): void {
    this.buttonFirst.setDisabled(this.pageIndex === 0);
    this.buttonPrevious.setDisabled(this.pageIndex === 0);
    this.buttonNext.setDisabled(this.pageIndex >= this.pages.length - 1);
    this.buttonLast.setDisabled(this.pageIndex >= this.pages.length - 1);
  }
}
