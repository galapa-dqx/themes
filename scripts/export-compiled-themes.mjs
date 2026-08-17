import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';
import { createServer } from 'vite';

const argumentsWithoutSeparator = process.argv.slice(2).filter((value) => value !== '--');
const outputDirectory = resolve(argumentsWithoutSeparator[0] ?? 'compiled-themes');
const publicDirectory = resolve('public');
const nativeFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (!url.startsWith('/')) return nativeFetch(input, init);
  const assetPath = resolve(publicDirectory, url.slice(1));
  const relativeAssetPath = relative(publicDirectory, assetPath);
  if (relativeAssetPath.startsWith('..') || isAbsolute(relativeAssetPath)) {
    return new Response('Forbidden', { status: 403 });
  }
  try {
    return new Response(await readFile(assetPath), { status: 200 });
  } catch {
    return new Response('Not found', { status: 404 });
  }
};
const server = await createServer({
  appType: 'custom',
  server: { middlewareMode: true },
});

try {
  const { THEMES } = await server.ssrLoadModule('/src/theme/themes/index.ts');
  const { resolveTheme } = await server.ssrLoadModule('/src/theme/resolve.ts');
  await mkdir(outputDirectory, { recursive: true });

  for (const [id, theme] of Object.entries(THEMES).sort(([left], [right]) =>
    left.localeCompare(right),
  )) {
    const { compiled, warnings } = await resolveTheme(theme);
    if (warnings.length > 0) {
      throw new Error(`Theme '${id}' compiled with ${warnings.length} warning(s).`);
    }
    await writeFile(
      resolve(outputDirectory, `${id}.compiled.json`),
      `${JSON.stringify(compiled, null, 2)}\n`,
      'utf8',
    );
  }
} finally {
  await server.close();
  globalThis.fetch = nativeFetch;
}
