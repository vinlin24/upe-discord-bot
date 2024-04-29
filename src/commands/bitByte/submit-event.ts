import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import heicConvert from "heic-convert";
import download from "image-downloader";
import { Model } from "mongoose";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
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
    if (downloadResult.filename.match(/\.heic$/i)) {
      imageFileName = await convertHeicToJpg(downloadResult.filename);
    }

    // Use the filename of the image saved to the server's filesystem instead of
    // Discord's attachment URL. This is because the attachment URL may expire,
    // and it also causes issues with unsupported formats like HEIC.
    newEvent.pic = path.basename(imageFileName);

    interaction
      .reply({
        content: `Location: ${interaction.options.getString(
          "location"
        )}\nPoints Earned: ${getEventPoints(newEvent, byte.total_mems)}`,
        files: [{ attachment: imageFileName }],
      });

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
    .replace(/[,&]/, "")
    .replace(/\s+/g, "-")
    .toLowerCase();
  return `${timestamp}-${normalizedByteName}${fileExtension}`;
}

async function convertHeicToJpg(heicPath: string): Promise<string> {
  const inputBuffer = await promisify(fs.readFile)(heicPath);
  const outputBuffer = await heicConvert({
    buffer: inputBuffer,
    format: "JPEG",
    quality: 1,
  });

  const {
    name: withoutExtension,
    dir: outputDir,
  } = path.parse(heicPath);
  const newFilePath = path.join(outputDir, `${withoutExtension}.jpg`);
  await promisify(fs.writeFile)(newFilePath, Buffer.from(outputBuffer));

  // Delete the original HEIC file.
  await promisify(fs.unlink)(heicPath);

  return newFilePath;
}
