import { useMemo } from 'react';
import { parseAsset, type Asset } from '@/editor/nineSlice';
import { useProjectStore } from '@/editor/projectStore';
import { EMPTY } from '@/editor/tokensUtil';
import { bakeColors } from '@/editor/tokenView';
import { useProjectFile } from '@/editor/useProjectFile';

/** A project SVG as text, with `{colors.x}` baked; `raw` keeps the references. */
export function useSvgText(path: string | undefined): {
  text?: string;
  raw?: string;
  error?: string;
} {
  const file = useProjectFile(path, 'image/svg+xml');
  const colors = useProjectStore((s) => s.doc.tokens.colors ?? EMPTY);
  return useMemo(() => {
    if (!file?.file) return { error: file?.error };
    const raw = new TextDecoder().decode(file.file.bytes);
    return { raw, text: bakeColors(raw, colors) };
  }, [file, colors]);
}

/** A project SVG parsed into the nine-slice model, its art baked. */
export function useAsset(path: string | undefined): {
  asset?: Asset;
  error?: string;
} {
  const { raw, error } = useSvgText(path);
  const colors = useProjectStore((s) => s.doc.tokens.colors ?? EMPTY);
  return useMemo(() => {
    if (!raw) return { error };
    try {
      const a = parseAsset(raw);
      return { asset: { ...a, art: bakeColors(a.art, colors) } };
    } catch (e) {
      return { error: (e as Error).message };
    }
  }, [raw, error, colors]);
}
