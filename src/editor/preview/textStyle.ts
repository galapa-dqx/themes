/**
 * Text-part styling: a resolved typography + colour as inline CSS, the font
 * loaded through `useFontFamily`. Defaults match the compiler (fontStyle
 * normal, lineHeight 1, letterSpacing 0, textCase none).
 */
import type { CSSProperties } from 'react';
import type { Typography } from '@/compiler/tokens';
import { useFontFamily } from '@/editor/useProjectFile';
import type { TextView } from './resolve';

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
