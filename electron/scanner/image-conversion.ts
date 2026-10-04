import { nativeImage } from 'electron';
import { ScanFormat } from '../../shared/desktop-contracts';
import { UserError } from '../files/file-store';
export function convertImage(bytes: Buffer, format: ScanFormat): Buffer {
  const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8;
  const png = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (!jpeg && !png)
    throw new UserError('INVALID_IMAGE', 'Il file non è un’immagine JPEG o PNG valida.');
  let image = nativeImage.createFromBuffer(bytes);
  if (image.isEmpty()) throw new UserError('INVALID_IMAGE', 'Impossibile leggere questa immagine.');
  if (format === 'jpeg') {
    const size = image.getSize();
    const bitmap = image.toBitmap();
    for (let i = 0; i < bitmap.length; i += 4) {
      const alpha = bitmap[i + 3]! / 255;
      // nativeImage exposes premultiplied channels. Composite onto a white background.
      for (let c = 0; c < 3; c++)
        bitmap[i + c] = Math.min(255, Math.round(bitmap[i + c]! + 255 * (1 - alpha)));
      bitmap[i + 3] = 255;
    }
    image = nativeImage.createFromBitmap(bitmap, size);
  }
  return format === 'jpeg' ? image.toJPEG(95) : image.toPNG();
}
