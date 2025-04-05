import {
  ActionRowBuilder,
  EmbedBuilder,
  inlineCode,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  type APIEmbedField,
  type APISelectMenuOption,
  type ChatInputCommandInteraction,
  type MessageComponentInteraction,
} from "discord.js";

import { SlashCommandHandler } from "../../abc/command.abc";
import type { RoleId } from "../../types/branded.types";
import { isNonEmptyArray } from "../../types/generic.types";
import { EmbedPagesManager } from "../../utils/components.utils";
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

export default new ViewEventsCommand(new SystemDateClient());
