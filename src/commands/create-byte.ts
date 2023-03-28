const Byte = require("../schemas/byte");
import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
const mongoose = require("mongoose");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("createbyte")
    .setDescription("Initialize a new byte.")
    .addStringOption((option) =>
      option
        .setName("name")
        .setDescription("Name of Byte Family")
        .setRequired(true)
    )
    .addIntegerOption((option) =>
      option
        .setName("members")
        .setDescription("How many inductees are in this byte?")
        .setRequired(true)
    ),
  async execute(interaction: ChatInputCommandInteraction) {
    let newByte = await new Byte({
      _id: new mongoose.Types.ObjectId(),
      name: interaction.options.getString("name"),
      byte_ids: [interaction.user.id],
      events: [],
      total_mems: interaction.options.getInteger("members"),
    });

    await newByte.save().catch(console.error);
    await interaction.reply({
      content: `Successfully saved event: ${newByte._id}`,
    });
  },
};
