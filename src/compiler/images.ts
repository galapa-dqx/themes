/**
 * Preview image processing: decode, apply EXIF orientation, drop every
 * non-rendering metadata block, re-encode. Layers: `Images.browser` here
 * (canvas), `imagesSharp` in imagesNode.ts (sharp).
 */
import { Context, Data, Effect, Layer } from 'effect';

export interface Image {
  readonly bytes: Uint8Array;
  readonly format: 'png' | 'jpeg';
  readonly width: number;
  readonly height: number;
}
export class ImageError extends Data.TaggedError('ImageError')<{
  readonly message: string;
}> {}

/** Raster size for an SVG preview that declares no width/height. */
export const DEFAULT_RASTER = { width: 800, height: 600 } as const;

const PNG = [0x89, 0x50, 0x4e, 0x47];
const JPEG = [0xff, 0xd8, 0xff];
/** Sniffs the container from its magic bytes. */
export const imageFormat = (bytes: Uint8Array): Image['format'] | undefined =>
  PNG.every((b, i) => bytes[i] === b)
    ? 'png'
    : JPEG.every((b, i) => bytes[i] === b)
      ? 'jpeg'
      : undefined;

export class Images extends Context.Tag('Images')<
  Images,
  {
    readonly strip: (bytes: Uint8Array) => Effect.Effect<Image, ImageError>;
    /** Renders SVG text to a PNG at its declared width/height (`DEFAULT_RASTER` when absent). */
    readonly rasterize: (svg: string) => Effect.Effect<Image, ImageError>;
  }
>() {
  /**
   * Canvas re-encode. ponytail: converts to sRGB (ICC profiles are not kept)
   * and recompresses JPEG at high quality; a lossless APP-segment stripper
   * would preserve both if that ever matters. Unverified outside a browser.
   */
  static browser = Layer.succeed(Images, {
    rasterize: (svg) =>
      Effect.tryPromise({
        try: async () => {
          const url = URL.createObjectURL(
            new Blob([svg], { type: 'image/svg+xml' }),
          );
          try {
            const img = new Image();
            await new Promise<void>((ok, err) => {
              img.onload = () => ok();
              img.onerror = () => err(new Error('SVG failed to decode'));
              img.src = url;
            });
            const width = img.naturalWidth || DEFAULT_RASTER.width;
            const height = img.naturalHeight || DEFAULT_RASTER.height;
            const canvas = new OffscreenCanvas(width, height);
            canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
            const blob = await canvas.convertToBlob({ type: 'image/png' });
            return {
              bytes: new Uint8Array(await blob.arrayBuffer()),
              format: 'png' as const,
              width,
              height,
            };
          } finally {
            URL.revokeObjectURL(url);
          }
        },
        catch: (e) => new ImageError({ message: (e as Error).message }),
      }),
    strip: (bytes) =>
      Effect.tryPromise({
        try: async () => {
          const format = imageFormat(bytes);
          if (!format) throw new Error('not a PNG or JPEG');
          const type = `image/${format}`;
          const bitmap = await createImageBitmap(
            new Blob([bytes as BlobPart], { type }),
            {
              imageOrientation: 'from-image',
            },
          );
          const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
          canvas.getContext('2d')!.drawImage(bitmap, 0, 0);
          const blob = await canvas.convertToBlob({ type, quality: 0.92 });
          return {
            bytes: new Uint8Array(await blob.arrayBuffer()),
            format,
            width: bitmap.width,
            height: bitmap.height,
          };
        },
        catch: (e) => new ImageError({ message: (e as Error).message }),
      }),
  });
}
