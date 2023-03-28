const Byte = require("../schemas/byte");
import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
const mongoose = require("mongoose");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("submit")
    .setDescription("Get points for events with your Byte family!")
    .addStringOption((option) =>
      option
        .setName("location")
        .setDescription("Where did your family hang out?")
        .setRequired(true)
        .addChoices(
          { name: "On-campus", value: "campus" },
          { name: "Westwood", value: "westwood" },
          { name: "LA", value: "la" }
        )
    )
    .addStringOption((option) =>
      option
        .setName("caption")
        .setDescription("Brief summary of what your family did")
        .setRequired(true)
    )
    .addIntegerOption((option) =>
      option
        .setName("members")
        .setDescription("How many members attended?")
        .setRequired(true)
    )
    .addAttachmentOption((option) =>
      option
        .setName("picture")
        .setDescription("Please attach a picture of the event")
        .setRequired(true)
    ),
  async execute(interaction: ChatInputCommandInteraction) {
    const newEvent = {
      location: interaction.options.getString("location"),
      num_mems: interaction.options.getInteger("members"),
      pic: interaction.options.getAttachment("picture")?.url,
      caption: interaction.options.getString("caption") 
    }

    const byte = await Byte.findOne({byte_ids: interaction.user.id})
    byte.events.push(newEvent)
    await byte.save().catch(console.error)
    await interaction.reply({ 
      content: `Successfully saved event:`,
    });
    console.log(byte)
  },
};
