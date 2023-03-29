const Byte = require("../../schemas/byte");
import {
    ActionRowBuilder, ChatInputCommandInteraction,
    SlashCommandBuilder, StringSelectMenuBuilder
} from "discord.js";
import type { IByte } from "../../schemas/byte";
const mongoose = require("mongoose");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("viewevents")
    .setDescription("Look through any byte's events"),
  async execute(interaction: ChatInputCommandInteraction) {
    const all: Array<IByte> = await Byte.find({});

    const byteSelector =
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId("byteselector")
          .setPlaceholder("Pick a byte")
          .addOptions(
            all.map((entry) => {
              return { label: entry.name, value: entry._id.toString() };
            })
          )
      );
    await interaction.reply({components: [byteSelector]})

  },
};
