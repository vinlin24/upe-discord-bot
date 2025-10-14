import {
  EmbedBuilder,
  roleMention,
  SlashCommandBuilder,
  type APIEmbedField,
  type ChatInputCommandInteraction,
  type Role,
} from "discord.js";

import { SlashCommandHandler } from "../../abc/command.abc";
import { type BitByteGroup } from "../../models/bit-byte.model";
import bitByteService from "../../services/bit-byte.service";
import type { RoleId } from "../../types/branded.types";
import { isNonEmptyArray } from "../../types/generic.types";
import { EmbedPagesManager } from "../../utils/components.utils";
import { SystemDateClient, type IDateClient } from "../../utils/date.utils";

class ViewEventsCommand extends SlashCommandHandler {
  public override readonly definition = new SlashCommandBuilder()
    .setName("eventsbitbyte")
    .setDescription("Look through a bit-byte family's submitted events.")
    .addRoleOption(input => input
      .setName("family_role")
      .setDescription("Role associated with bit-byte family.")
      .setRequired(true),
    )
    .toJSON();

  public constructor(private readonly dateClient: IDateClient) { super(); }

  public override async execute(
    interaction: ChatInputCommandInteraction,
  ): Promise<void> {
    const familyRole = interaction.options.getRole("family_role", true) as Role;
    const family = await bitByteService.getActiveGroup(familyRole.id as RoleId);

    if (family === null) {
      await this.replyError(
        interaction,
        `The ${roleMention(familyRole.id)} role does not seem to be ` +
        "associated with a bit-byte family this season!",
      );
      return;
    }

    const pages = await this.preparePages(family);
    await this.handlePages(interaction, pages);
  }

  private preparePages(group: BitByteGroup): EmbedBuilder[] {
    return group.events.map((event, index) => {
      const pointsField: APIEmbedField = {
        name: "Points Earned",
        value: (
          `${bitByteService.calculateBitByteEventPoints(event)} ` +
          `(${event.numAttended} bits in ${event.location})`
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
    interaction: ChatInputCommandInteraction,
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
