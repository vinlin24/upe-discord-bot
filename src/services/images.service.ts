import * as imageToPdf from "image-to-pdf";
import sharp from "sharp";

import { WritableMemoryStream } from "../utils/data.utils";

export class ImagesService {
  public async toPdf(imageData: Buffer): Promise<Buffer> {
    // To support any image format (including .webp), we first normalize data to
    // PNG format via the Sharp library, then use the image-to-pdf library to
    // convert it into a PDF. The transformation flow looks like: any image
    // buffer => Sharp object => PNG buffer => PDF document => PDF buffer.

    const sharpPng = sharp(imageData).png();
    const pngBuffer = await sharpPng.toBuffer();
    const pdfDocument = imageToPdf.convert(
      [pngBuffer],
      imageToPdf.sizes.LETTER,
    );
    const outputStream = new WritableMemoryStream();
    // @ts-ignore .pipe() requires a NodeJS.WritableStream, which
    // WritableMemoryStream LITERALLY implements (via extending
    // stream.Writable). Compiler seems to be fine but IntelliSense is wilding.
    pdfDocument.pipe(outputStream);
    return await outputStream.getData();
  }
}

export default new ImagesService();
