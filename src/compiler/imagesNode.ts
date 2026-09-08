/** Node layer for `Images` on sharp. Not for the browser bundle. */
import { Effect, Layer } from 'effect';
import sharp from 'sharp';
import { ImageError, imageFormat, Images } from './images';

export const imagesSharp = Layer.succeed(Images, {
  strip: (bytes) =>
    Effect.tryPromise({
      try: async () => {
        const format = imageFormat(bytes);
        if (!format) throw new Error('not a PNG or JPEG');
        // rotate() with no angle applies and removes EXIF orientation; sharp
        // drops all other metadata unless asked to keep it.
        const image = sharp(bytes).rotate().keepIccProfile();
        const { data, info } = await (
          format === 'png' ? image.png() : image.jpeg({ quality: 92 })
        ).toBuffer({ resolveWithObject: true });
        return {
          bytes: new Uint8Array(data),
          format,
          width: info.width,
          height: info.height,
        };
      },
      catch: (e) => new ImageError({ message: (e as Error).message }),
    }),
});
