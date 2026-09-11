/**
 * Text-part styling: a resolved typography + colour as inline CSS, the font
 * loaded through `useFontFamily`. Defaults match the compiler (fontStyle
 * normal, lineHeight 1, letterSpacing 0, textCase none).
 */
import type { CSSProperties } from 'react';
import type { Typography } from '@/compiler/tokens';
import { fontLabel } from '@/editor/tokenView';
import { useFontFamily } from '@/editor/useProjectFile';
import type { TextView } from './resolve';

/** Sample text per full text-part identity; anything else shows its part name. */
export const SAMPLE: Record<string, string> = {
  'button.text': 'Play',
  'input.label': 'Username',
  'input.value': 'anlucialuvr69',
  'input.placeholder': 'Enter password',
  'tab.text': 'Launcher',
  'subtab.text': 'General',
  'news-item.title': 'Patch notes 1.2',
  'news-item.date': '2026-09-09',
  'setting-row.label': 'Resolution',
  'setting-row.value': '1920 × 1080',
  'titlebar.wordmark': 'Galapa',
  'settings.heading': 'Settings',
  'setting-help.title': 'About this setting',
  'setting-help.body': 'A short explanation of the setting.',
};

const DECORATION: Record<string, string> = {
  underline: 'underline',
  strikethrough: 'line-through',
  overline: 'overline',
};
const settings = (o: Record<string, number | boolean> | undefined) =>
  o && Object.keys(o).length
    ? Object.entries(o)
        .map(([k, v]) => `"${k}" ${typeof v === 'boolean' ? +v : v}`)
        .join(', ')
    : undefined;

export const typographyStyle = (
  t: Typography | undefined,
  family: string | undefined,
): CSSProperties => ({
  // Quoted: a name with a digit ("Source Sans 3") is invalid unquoted.
  fontFamily: family ? `"${family}", sans-serif` : undefined,
  fontSize: t?.fontSize,
  fontWeight: t?.fontWeight,
  fontStyle: t?.fontStyle ?? 'normal',
  lineHeight: t?.lineHeight ?? 1,
  letterSpacing: t?.letterSpacing ?? 0,
  textTransform: t?.textCase ?? 'none',
  textDecoration:
    t?.textDecoration
      ?.map((d) => DECORATION[d])
      .filter(Boolean)
      .join(' ') || 'none',
  fontVariationSettings: settings(t?.fontAxes),
  fontFeatureSettings: settings(t?.fontFeatures),
});

/** The full inline style of a text part, for hosts that style text themselves (an `<input>`). */
export function useTextStyle(view: TextView): CSSProperties {
  const family = useFontFamily(view.typography?.font);
  return {
    ...typographyStyle(view.typography, family),
    color: view.color,
    opacity: view.opacity,
  };
}

/** A one-line mono read-back of what a text part resolves to (specimen captions). */
export const textSummary = (t: TextView | undefined) =>
  [
    t?.color ?? 'no colour',
    t?.typography?.font ? fontLabel(t.typography.font) : 'no font',
    t?.typography?.fontWeight,
    t?.typography?.fontSize !== undefined
      ? `${t.typography.fontSize}px`
      : undefined,
    t?.typography?.lineHeight !== undefined
      ? `/${t.typography.lineHeight}`
      : undefined,
    t?.typography?.textCase !== 'none' ? t?.typography?.textCase : undefined,
    t?.opacity !== 1 ? `α ${t?.opacity}` : undefined,
  ]
    .filter(Boolean)
    .join(' · ');
