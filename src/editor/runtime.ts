/** The app's Effect runtime: OPFS-backed services, built once at startup. */
import { FetchHttpClient } from '@effect/platform';
import { ConfigProvider, Layer, ManagedRuntime } from 'effect';
import { FontTools } from '@/compiler/fontTools';
import { GoogleFonts } from '@/compiler/googleFonts';
import { Images } from '@/compiler/images';
import { layerOpfs } from '@/compiler/opfs';
import { Svg } from '@/compiler/svg';
import { Slicer } from './slicer';

const config = Layer.setConfigProvider(
  ConfigProvider.fromMap(
    new Map([
      ['GOOGLE_FONTS_API_KEY', import.meta.env.VITE_GOOGLE_FONTS_API_KEY ?? ''],
    ]),
  ),
);

// The config provider must be part of the runtime itself: the catalog is
// fetched lazily on the caller's fiber, not while the layer is built.
export const runtime = ManagedRuntime.make(
  Layer.mergeAll(
    config,
    layerOpfs,
    FontTools.worker(
      () =>
        new Worker(new URL('../compiler/fontWorker.ts', import.meta.url), {
          type: 'module',
        }),
    ),
    GoogleFonts.Default.pipe(Layer.provide(FetchHttpClient.layer)),
    Slicer.Default,
    Svg.Default,
    Images.browser,
  ),
);
