import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import download from "image-downloader";
import { Model } from "mongoose";
import { IByte } from "src/schemas/byte";
import { getEventPoints } from "../../functions/get-points";
const Byte = require("../../schemas/byte") as Model<IByte>;

module.exports = {
  data: new SlashCommandBuilder()
    .setName("submit")
    .setDescription("Get points for events with your bits!")
    .addStringOption((option) =>
      option
        .setName("location")
        .setDescription("Where did you hang out?")
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
        .setDescription("How many bits attended?")
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

    if (!byte) {
      await interaction.reply({
        content: "Error: You are not a byte!",
        ephemeral: true,
      });
      console.warn(
        `@${interaction.user.username} is not a byte but tried to submit.`
      );
      return;
    }

    if (byte.total_mems < num_attended!) {
      await interaction.reply({
        content: `Error: There are less than ${num_attended} inductees in your byte.`,
      });
      return;
    }

    const IMAGES_DIR = "../../event-pics/";
    let imageFileName = generateImageFileName(newEvent.pic, byte.name);

    const downloadResult = await download.image({
      url: newEvent.pic,
      dest: `${IMAGES_DIR + imageFileName}`,
    });
    imageFileName = downloadResult.filename;

    interaction
      .reply({
        content: `Location: ${interaction.options.getString(
          "location"
        )}\nPoints Earned: ${getEventPoints(newEvent, byte.total_mems)}`,
        files: [{ attachment: imageFileName }],
      });

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

function generateImageFileName(url: string, byteName: string): string {
  const timestamp = Date.now();
  const fileExtension = url.substring(
    url.lastIndexOf("."),
    url.indexOf("?"), // Discord attaches query params to the end of the URL.
  );
  // Replace spaces with dashes and converting to lowercase. Not bullet-proof as
  // someone can still use illegal filename characters, but it's good enough.
  const normalizedByteName = byteName
    .replace(/\s+/g, "-")
    .toLowerCase();
  return `${timestamp}-${normalizedByteName}${fileExtension}`;
}
