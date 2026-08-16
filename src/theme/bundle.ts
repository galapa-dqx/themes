import type { CompiledTheme } from './types';

/** A filesystem-safe slug from a theme label: "Aurelia Dusk" → "aurelia-dusk",
 *  falling back to "theme" when a label has no usable characters. */
export function themeSlug(label: string): string {
  return (
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'theme'
  );
}

/**
 * The compiled theme as a downloadable bundle: pretty-printed JSON plus the
 * filename it should save under (label slug, and the version when the theme
 * declares one). A compiled theme is self-contained — art inlined, tokens
 * resolved to literals — so the file is portable with nothing left to fetch.
 */
export function compiledBundle(theme: CompiledTheme): {
  filename: string;
  json: string;
} {
  const version = theme.meta?.version ? `-${theme.meta.version}` : '';
  return {
    filename: `${themeSlug(theme.label)}${version}.compiled.json`,
    json: JSON.stringify(theme, null, 2),
  };
}
