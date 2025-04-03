import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  EmbedBuilder,
  inlineCode,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  type APIEmbedField,
  type APISelectMenuOption,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type MessageComponentInteraction,
} from "discord.js";

import { SlashCommandHandler } from "../../abc/command.abc";
import type { Milliseconds, RoleId } from "../../types/branded.types";
import { isNonEmptyArray } from "../../types/generic.types";
import { SystemDateClient, type IDateClient } from "../../utils/date.utils";
import { BitByteGroupModel, type BitByteGroup } from "./bit-byte.model";
import { calculateBitByteEventPoints } from "./bit-byte.utils";

class ViewEventsCommand extends SlashCommandHandler {
  public override readonly definition = new SlashCommandBuilder()
    .setName("eventsbitbyte")
    .setDescription("Look through any bit-byte group's submitted events.")
    .toJSON();

  public override readonly componentIds = ["byteselector"];

  public constructor(private readonly dateClient: IDateClient) { super(); }

  public override async execute(
    interaction: ChatInputCommandInteraction,
  ): Promise<void> {
    const groups = await this.getAllGroups();

    const selectMenuOptions: APISelectMenuOption[] = [];
    for (const group of groups) {
      const role = interaction.guild!.roles.cache.get(group.roleId);
      if (role === undefined) {
        await this.replyError(
          interaction,
          `It seems like a bit-byte group's role (ID: ${group.roleId}) ` +
          `does not exist anymore! Notify an admin.`,
        );
        return;
      }
      selectMenuOptions.push({ label: role.name, value: role.id });
    }

    const groupSelector = new ActionRowBuilder<StringSelectMenuBuilder>()
      .addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(this.componentIds[0])
          .setPlaceholder("Pick a group")
          .addOptions(selectMenuOptions),
      );

    await interaction.reply({ components: [groupSelector] });
  }

  public override async onComponent(
    interaction: MessageComponentInteraction,
  ): Promise<void> {
    if (!interaction.isStringSelectMenu()) {
      return;
    }

    const selectedRoleId = interaction.values[0] as RoleId;
    const group = await this.getGroup(selectedRoleId);
    if (group === null) {
      await interaction.editReply({
        content: (
          "Something went wrong in retrieving the bit-byte group " +
          `for role ID: ${inlineCode(selectedRoleId)}?! Notify an admin.`
        )
      });
      return;
    }

    const pages = this.preparePages(group);
    await this.handlePages(interaction, pages);
  }

  private async getAllGroups(): Promise<BitByteGroup[]> {
    return await BitByteGroupModel.find({});
  }

  private async getGroup(roleId: RoleId): Promise<BitByteGroup | null> {
    return await BitByteGroupModel.findOne({ roleId });
  }

  private preparePages(group: BitByteGroup): EmbedBuilder[] {
    return group.events.map((event, index) => {
      const pointsField: APIEmbedField = {
        name: "Points Earned",
        value: (
          `${calculateBitByteEventPoints(event)} (${event.numAttended} / ` +
          `${event.numTotal} bits in ${event.location})`
        ),
      };
      const dateField: APIEmbedField = {
        name: "Date Submitted",
        value: this.dateClient.getDate(event.timestamp).toLocaleDateString(),
      };

      return new EmbedBuilder()
        .setTitle(event.caption)
        .setImage(event.picture)
        .addFields(pointsField, dateField)
        .setFooter({ text: `Page ${index + 1} / ${group.events.length}` });
    });
  }

  private async handlePages(
    interaction: MessageComponentInteraction,
    pages: EmbedBuilder[],
  ): Promise<void> {
    await interaction.deferReply();

    if (!isNonEmptyArray(pages)) {
      await interaction.editReply({ content: "No events yet." });
      return;
    }

    const pagesManager = new EmbedPagesManager(pages);
    await pagesManager.start(interaction);
  }
}

type EmbedPagesManagerOptions = {
  timeout: Milliseconds;
  initialIndex: number;
};

const enum ButtonId {
  First = "first",
  Previous = "previous",
  Next = "next",
  Last = "last",
};

// TODO: Could promote?
class EmbedPagesManager {
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

export default new ViewEventsCommand(new SystemDateClient());
