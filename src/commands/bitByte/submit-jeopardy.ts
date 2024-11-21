import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import type { Model } from "mongoose";
import type { IByte, IEvent } from "../../schemas/byte";

const Byte: Model<IByte> = require("../../schemas/byte");

const command = new SlashCommandBuilder()
  .setName("jeopardy")
  .setDescription("Submit a jeopardy event for your byte")
  .addNumberOption((option) => option
    .setName("points")
    .setDescription("Curved points for the event")
    .setRequired(true)
    .setMinValue(0)
  )
  .addUserOption((option) => option
    .setName("byte")
    .setDescription("The byte to get the points for")
  );

async function submitJeopardy(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  const points = interaction.options.getNumber("points", true);
  const userBehalf = interaction.options.getUser("byte") ?? interaction.user;

  const byte = await Byte.findOne({ byte_ids: userBehalf.id });
  if (!byte) {
    await interaction.reply({
      content: `Error: ${userBehalf.username} is not one of the recognized bytes.`,
      ephemeral: true,
    });
    return;
  }

  const newEvent: IEvent = {
    location: "Jeopardy",
    // Dummy value that isn't actually used (`getEventPoints()` just uses the
    // caption as the points to use for `Jeopardy` events).
    num_mems: 1,
    pic: "https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg",
    caption: points.toString(),
    date: interaction.createdAt,
  };

  byte.events.push(newEvent);
  await byte.save().catch(console.error);

  await interaction.editReply({
    content: `Submitted ${points} points for ${byte.name}!`,
  });
}

module.exports = { data: command, execute: submitJeopardy };
