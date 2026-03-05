import {
  AttachmentBuilder,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";

import type { SlashCommandCheck } from "../../abc/check.abc";
import { SlashCommandHandler } from "../../abc/command.abc";
import qrcodeService from "../../services/qrcode.service";

class QRCommand extends SlashCommandHandler {
  public override readonly definition = new SlashCommandBuilder()
    .setName("qr")
    .setDescription("Generate a QR code for a given URL or text.")
    .addStringOption(input =>
      input
        .setName("content")
        .setDescription("The URL or text to encode in the QR code")
        .setRequired(true),
    )
    .toJSON();

  public override readonly checks: SlashCommandCheck[] = [];

  public override async execute(
    interaction: ChatInputCommandInteraction,
  ): Promise<void> {
    const content = interaction.options.getString("content", true);

    try {
      await interaction.deferReply();

      // Generate QR code buffer
      const qrBuffer = await qrcodeService.generateQRCode(content);

      // Create an attachment from the buffer
      const attachment = new AttachmentBuilder(qrBuffer, {
        name: "qrcode.png",
      });

      // Reply with the QR code image
      await interaction.editReply({
        files: [attachment],
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      await interaction.editReply({
        content: `Failed to generate QR code: ${errorMessage}`,
      });
    }
  }
}

export default new QRCommand();
