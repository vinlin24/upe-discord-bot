const Byte = require("../../schemas/byte");
import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { IByte } from "src/schemas/byte";
const mongoose = require("mongoose");
import { getEventPoints } from "../../functions/get-points"

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
        .setMinValue(1)
    )
    .addAttachmentOption((option) =>
      option
        .setName("picture")
        .setDescription("Please attach a picture of the event")
        .setRequired(true)
    ),
  async execute(interaction: ChatInputCommandInteraction) {
    const num_attended = interaction.options.getInteger("members")

    const newEvent = {
      location: interaction.options.getString("location")!,
      num_mems: num_attended!,
      pic: interaction.options.getAttachment("picture")?.url!,
      caption: interaction.options.getString("caption")!,
      date: interaction.createdAt!
    }

    const byte = await Byte.findOne({byte_ids: interaction.user.id})

    if (byte.total_mems < num_attended!) {
      await interaction.reply({content: `Error: There are less than ${num_attended} inductees in your byte.`})
      return
    }

    byte.events.push(newEvent)
    await byte.save().catch(console.error)
    await interaction.reply({ 
      content: `Successfully saved event\nLocation: ${interaction.options.getString("location")}\nPoints Earned: ${getEventPoints(newEvent, byte.total_mems)} ${interaction.options.getAttachment("picture")?.url}`,
    });
    console.log(byte)
  },
};
