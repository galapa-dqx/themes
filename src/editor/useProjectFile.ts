import { useEffect, useState } from 'react';
import { Effect } from 'effect';
import { FontTools, type FontInfo } from '@/compiler/fontTools';
import {
  gfontFamily,
  GoogleFonts,
  type GoogleFont,
} from '@/compiler/googleFonts';
import { useStore } from 'zustand';
import { fileRevisions, readProjectFile } from './persistence';
import { useProjectStore } from './projectStore';
import { runtime } from './runtime';

export interface ProjectFile {
  readonly bytes: Uint8Array;
  /** Object URL for the bytes; revoked when the hook unmounts or the path changes. */
  readonly url: string;
}

/** Reads a project-relative file from OPFS. Undefined while loading or missing. */
export function useProjectFile(
  path: string | undefined,
  type = 'application/octet-stream',
) {
  const dir = useProjectStore((s) => s.dir);
  const rev = useStore(
    fileRevisions,
    (s) => s[`${dir}/${path?.replace(/^\.\//, '')}`] ?? 0,
  );
  const [file, setFile] = useState<{
    path: string;
    file?: ProjectFile;
    error?: string;
  }>();
  useEffect(() => {
    if (!path || !dir) return;
    let url: string | undefined;
    let live = true;
    runtime
      .runPromise(readProjectFile(dir, path).pipe(Effect.either))
      .then((r) => {
        if (!live) return;
        if (r._tag === 'Left') return setFile({ path, error: r.left.message });
        url = URL.createObjectURL(new Blob([r.right as BlobPart], { type }));
        setFile({ path, file: { bytes: r.right, url } });
      });
    return () => {
      live = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [dir, path, type, rev]);
  return file?.path === path ? file : undefined;
}

let catalogPromise: Promise<readonly GoogleFont[]> | undefined;
/** The Google Fonts catalog, fetched once; empty until loaded or when unavailable. */
export function useGoogleCatalog() {
  const [catalog, setCatalog] = useState<readonly GoogleFont[]>([]);
  useEffect(() => {
    let live = true;
    catalogPromise ??= runtime.runPromise(
      Effect.flatMap(GoogleFonts, (g) => g.list).pipe(
        Effect.catchAll((e) => {
          console.warn('Google Fonts catalog unavailable:', e.message);
          return Effect.succeed([] as readonly GoogleFont[]);
        }),
      ),
    );
    catalogPromise.then((c) => live && setCatalog(c));
    return () => {
      live = false;
    };
  }, []);
  return catalog;
}

/** Weight/style faces a catalog entry offers: axis ranges for variable families, variants otherwise. */
export const googleFaces = (font: GoogleFont) => {
  const variants = Object.keys(font.files).map((k) => ({
    weight: parseInt(k) || 400,
    italic: k.includes('italic'),
  }));
  const wght = font.axes?.find((a) => a.tag === 'wght');
  return {
    variable: !!font.axes,
    wght: wght ? ([wght.start, wght.end] as const) : undefined,
    otherAxes:
      font.axes?.filter((a) => a.tag !== 'wght').map((a) => a.tag) ?? [],
    weights: [...new Set(variants.map((v) => v.weight))].sort((a, b) => a - b),
    italic: variants.some((v) => v.italic),
  };
};

/** A CSS API stylesheet URL covering exactly what the family offers. */
const gfontCssUrl = (family: string, font: GoogleFont | undefined) => {
  const name = encodeURIComponent(family).replaceAll('%20', '+');
  if (!font)
    return `https://fonts.googleapis.com/css2?family=${name}&display=swap`;
  const f = googleFaces(font);
  const spec = f.wght
    ? `ital,wght@0,${f.wght[0]}..${f.wght[1]}${f.italic ? `;1,${f.wght[0]}..${f.wght[1]}` : ''}`
    : `ital,wght@${f.weights.flatMap((w) => (f.italic ? [`0,${w}`, `1,${w}`] : [`0,${w}`])).join(';')}`;
  return `https://fonts.googleapis.com/css2?family=${name}:${spec}&display=swap`;
};

/** The catalog entry for a `gfont:` source, once the catalog has loaded. */
export function useGoogleFont(source: string | undefined) {
  const catalog = useGoogleCatalog();
  if (!source?.startsWith('gfont:')) return undefined;
  const wanted = gfontFamily(source).toLowerCase();
  return catalog.find((f) => f.family.toLowerCase() === wanted);
}

/** A font-family name the browser can render `source` with, once loaded. */
export function useFontFamily(source: string | undefined) {
  const gfont = source?.startsWith('gfont:') ? gfontFamily(source) : undefined;
  const entry = useGoogleFont(source);
  const local = useProjectFile(gfont ? undefined : source);
  const [loaded, setLoaded] = useState<string>();
  useEffect(() => {
    if (!gfont) return;
    const id = `gfont-${gfont}`;
    const href = gfontCssUrl(gfont, entry);
    const existing = document.getElementById(id) as HTMLLinkElement | null;
    if (existing?.href === href) return;
    existing?.remove();
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = href;
    document.head.append(link);
  }, [gfont, entry]);
  useEffect(() => {
    const bytes = local?.file?.bytes;
    if (!bytes || !source) return;
    let live = true;
    const family = `galapa-${source.replace(/[^a-z0-9]+/gi, '-')}`;
    const existing = [...document.fonts].find((f) => f.family === family);
    const ready = existing
      ? existing.loaded
      : new FontFace(family, bytes as BufferSource).load().then((f) => {
          document.fonts.add(f);
          return f;
        });
    ready.then(
      () => live && setLoaded(family),
      () => live && setLoaded(undefined),
    );
    return () => {
      live = false;
    };
  }, [local?.file?.bytes, source]);
  return gfont ?? (local?.file ? loaded : undefined);
}

// ponytail: per-session cache keyed by path; bytes changing under the same path is rare.
const infoCache = new Map<string, Promise<FontInfo>>();

/** Faces, axes, and license of a local font file, inspected by fontTools in the worker. */
export function useFontInfo(
  path: string | undefined,
  bytes: Uint8Array | undefined,
) {
  const [state, setState] = useState<{
    path: string;
    info?: FontInfo;
    error?: string;
  }>();
  useEffect(() => {
    if (!path || !bytes) return;
    let live = true;
    let p = infoCache.get(path);
    if (!p) {
      p = runtime.runPromise(
        Effect.flatMap(FontTools, (f) => f.inspect(bytes)),
      );
      infoCache.set(path, p);
    }
    p.then(
      (info) => live && setState({ path, info }),
      (e) => {
        infoCache.delete(path);
        if (live) setState({ path, error: (e as Error).message });
      },
    );
    return () => {
      live = false;
    };
  }, [path, bytes]);
  return state?.path === path ? state : undefined;
}
