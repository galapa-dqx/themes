// Compiles a theme project folder into a compiled-theme folder.
// Usage: pnpm compile <project-dir> <out-dir>   (GOOGLE_FONTS_API_KEY for gfont: sources)
import { resolve } from 'node:path';
import { FetchHttpClient } from '@effect/platform';
import { NodeFileSystem } from '@effect/platform-node';
import { Effect, Layer } from 'effect';
import { loadPyodide } from 'pyodide';
import { compileProject } from '@/compiler/compiler';
import { Diagnostics, type Diagnostic } from '@/compiler/diagnostics';
import { FontTools } from '@/compiler/fontTools';
import { GoogleFonts } from '@/compiler/googleFonts';
import { imagesSharp } from '@/compiler/imagesNode';
import { Svg } from '@/compiler/svg';

const [projectDir, outDir] = process.argv.slice(2);
if (!projectDir || !outDir) {
  console.error('Usage: pnpm compile <project-dir> <out-dir>');
  process.exit(2);
}

const layer = Layer.mergeAll(
  NodeFileSystem.layer,
  Diagnostics.Default,
  Svg.Default,
  imagesSharp,
  FontTools.inProcess(() =>
    loadPyodide({
      packages: ['fonttools'],
      packageCacheDir: resolve(import.meta.dirname, '..', '.pyodide-assets'),
    }),
  ),
  GoogleFonts.Default.pipe(Layer.provide(FetchHttpClient.layer)),
);

const print = (d: Diagnostic) =>
  console.error(
    `${d.severity}: ${d.file ?? ''}${d.path ? `#${d.path}` : ''}: ${d.message}`,
  );

const exit = await Effect.runPromiseExit(
  compileProject(projectDir, outDir).pipe(Effect.provide(layer)),
);
if (exit._tag === 'Success') {
  exit.value.diagnostics.forEach(print);
  console.log(`compiled to ${exit.value.dir}`);
} else {
  const failure = exit.cause;
  if (failure._tag === 'Fail' && failure.error._tag === 'CompileFailed') {
    failure.error.diagnostics.forEach(print);
  } else {
    console.error(failure.toString());
  }
  process.exit(1);
}
