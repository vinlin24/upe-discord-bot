import path from "node:path";

import {
  AttachmentBuilder,
  inlineCode,
  type ChatInputCommandInteraction,
} from "discord.js";

import type { SlashCommandCheck } from "../../abc/check.abc";
import { SlashCommandHandler } from "../../abc/command.abc";
import {
  Privilege,
  PrivilegeCheck,
} from "../../middleware/privilege.middleware";
import channelsService from "../../services/channels.service";
import imagesService from "../../services/images.service";
import { makeErrorEmbed } from "../../utils/errors.utils";
import { ExtendedSlashCommandBuilder } from "../../utils/options.utils";

class ImageToPdfCommand extends SlashCommandHandler {
  public override readonly definition = new ExtendedSlashCommandBuilder()
    .setName("imagetopdf")
    .setDescription("Convert an image to a PDF file.")
    .addAttachmentOption(input => input
      .setName("image")
      .setDescription("Image to convert")
      .setRequired(true),
    )
    .addEphemeralOption()
    .toJSON();

  public override readonly checks: SlashCommandCheck[] = [
    new PrivilegeCheck(this).atLeast(Privilege.Officer),
  ];

  public override async execute(
    interaction: ChatInputCommandInteraction,
  ): Promise<void> {
    const imageAttachment = interaction.options.getAttachment("image", true);
    const ephemeral = interaction.options.getBoolean("ephemeral") ?? false;

    await interaction.deferReply({ ephemeral });

    const imageBuffer = await this.imageUrlToBuffer(imageAttachment.url);

    let pdfBuffer: Buffer;
    try {
      pdfBuffer = await imagesService.toPdf(imageBuffer);
    }
    catch (error) {
      const embed = makeErrorEmbed(
        `Your uploaded attachment ${inlineCode(imageAttachment.name)} does ` +
        "not seem to contain valid image data."
      );
      await interaction.editReply({ embeds: [embed] });
      await channelsService.sendDevError(error, interaction);
      return;
    }

    const pdfName = this.replaceExtension(imageAttachment.name, ".pdf");
    const pdfAttachment = new AttachmentBuilder(pdfBuffer).setName(pdfName);

    await interaction.editReply({ files: [pdfAttachment] });
  }

  private async imageUrlToBuffer(url: string): Promise<Buffer> {
    // Ref: https://stackoverflow.com/a/65945192/14226122.
    const response = await fetch(url);
    return Buffer.from(await response.arrayBuffer());
  }

  private replaceExtension(pathName: string, newExtension: string): string {
    return path.parse(pathName).name + newExtension;
  }
}

export default new ImageToPdfCommand();
