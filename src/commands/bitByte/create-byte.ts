const Byte = require("../../schemas/byte");
import {
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
const mongoose = require("mongoose");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("createbyte")
    .setDescription("Initialize a new byte.")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption((option) =>
      option
        .setName("name")
        .setDescription(
          "This is the name that will be displayed on leaderboard rankings."
        )
        .setRequired(true)
    )
    .addIntegerOption((option) =>
      option
        .setName("members")
        .setDescription("How many inductees are in this byte?")
        .setRequired(true)
    )
    .addUserOption((option) =>
      option
        .setName("head")
        .setDescription("Who is head of this byte?")
        .setRequired(true)
    )
    .addUserOption((option) =>
      option
        .setName("co-head")
        .setDescription("[OPTIONAL] Who is co-head of this byte?")
        .setRequired(false)
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
      content: `Successfully created byte: ${newByte.name}`,
    });
  },
};
