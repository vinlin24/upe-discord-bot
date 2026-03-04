import QRCode from "qrcode";

class QRCodeService {
  public async generateQRCode(link: string): Promise<Buffer> {
    try {
      const buffer = await QRCode.toBuffer(link, {
        errorCorrectionLevel: "H",
        type: "png",
        width: 300,
        margin: 1,
        color: {
          dark: "#000000",
          light: "#FFFFFF",
        },
      });
      return buffer;
    } catch (error) {
      throw new Error(`Failed to generate QR code: ${error}`);
    }
  }
}

export default new QRCodeService();
