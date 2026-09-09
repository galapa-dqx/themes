import { useState } from 'react';
import { useProjectStore } from './projectStore';
import { renameToken, type TokenCategory } from './tokenView';

export const mono = { ff: 'monospace', fz: 12 } as const;
// Selectors must return a stable reference; a fresh `{}` per call re-renders forever.
export const EMPTY: Record<string, never> = Object.freeze({});
export const controlLabel = (id: string) =>
  id.charAt(0).toUpperCase() + id.slice(1).replaceAll('-', ' ');
export const kb = (n: number) => `${Math.max(1, Math.round(n / 1024))} KB`;
/** A kebab-case token name from a file name: `Play Hover@2x.png` → `play-hover-2x`. */
export const nameFromFile = (file: string) =>
  file
    .replace(/\.[^.]+$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'asset';
/** A project path segment: lowercase, no spaces, percents, or backslashes. */
export const safeFileName = (file: string) =>
  file.toLowerCase().replace(/[\s%\\]+/g, '-');

export const useRename = (category: TokenCategory) => {
  const edit = useProjectStore((s) => s.edit);
  const [renaming, setRenaming] = useState<{ from: string; to: string }>();
  const commit = () => {
    if (renaming && renaming.to && renaming.to !== renaming.from)
      edit(`Rename ${renaming.from}`, (d) =>
        renameToken(d, category, renaming.from, renaming.to),
      );
    setRenaming(undefined);
  };
  return { renaming, setRenaming, commit };
};
