const Byte = require("../../schemas/byte");
import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { IByte } from "src/schemas/byte";
const mongoose = require("mongoose");
import { getEventPoints } from "../../functions/get-points";
import { image } from "image-downloader";
const download = require("image-downloader");
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
        .setDescription("Brief summary of what you did")
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
    const num_attended = interaction.options.getInteger("members");

    const newEvent = {
      location: interaction.options.getString("location")!,
      num_mems: num_attended!,
      pic: interaction.options.getAttachment("picture")?.url!,
      caption: interaction.options.getString("caption")!,
      date: interaction.createdAt!,
    };

    const byte = await Byte.findOne({ byte_ids: interaction.user.id });

    if (byte.total_mems < num_attended!) {
      await interaction.reply({
        content: `Error: There are less than ${num_attended} inductees in your byte.`,
      });
      return;
    }
    const IMAGES_DIR = "../../event-pics/";
    const imageFileName =
      Date.now() + newEvent.pic.substring(newEvent.pic.lastIndexOf("."));

    await download
      .image({
        url: newEvent.pic,
        dest: `${IMAGES_DIR + imageFileName}`,
        // extractFilename: false,
      })
      .then((filename: any) => console.log(filename))
      .catch((err: any) => console.error(err));

    // byte.events.push(newEvent)
    // await byte.save().catch(console.error)

    interaction
      .reply({
        content: `Location: ${interaction.options.getString(
          "location"
        )}\nPoints Earned: ${getEventPoints(newEvent, byte.total_mems)}`,
        files: [{ attachment: "event-pics/" + imageFileName }],
      })
      .then((msg) => {});

    await interaction
      .fetchReply()
      .then((reply) => {
        newEvent.pic = reply.attachments.first()?.proxyURL!;
      })
      .catch(console.error);

    byte.events.push(newEvent);
    await byte.save().catch(console.error);
  },
};
