import type { CSSProperties, ReactNode } from 'react';
import { useOSSettings } from '@/context/os-settings';
import type { ControlId, PartState } from '@/theme';

/**
 * The inlined SVG a control asks for, at a given state or variant, or undefined
 * when the theme is silent. `variant` picks from a per-variant map (the news
 * gem's category art); `state` swaps to a prop-state's mark (a pip's selected
 * art); otherwise the base image. Everything is already token-substituted on
 * the compiled theme, so this is a plain lookup.
 */
function useControlArt(
  part: ControlId,
  opts?: { state?: PartState; variant?: string },
): string | undefined {
  const { compiled } = useOSSettings();
  const control = compiled?.controls[part] as
    | {
        image?: string;
        images?: Record<string, string>;
        states?: Partial<Record<PartState, { image?: string }>>;
      }
    | undefined;
  if (!control) return undefined;
  if (opts?.variant !== undefined) return control.images?.[opts.variant];
  const stateImage = opts?.state ? control.states?.[opts.state]?.image : undefined;
  return stateImage ?? control.image;
}

/**
 * A themeable foreground mark — an icon, ornament, pip or gem. Renders the
 * theme's inlined, token-substituted SVG for `part` (tinted by `currentColor`,
 * so it follows the surrounding content colour and its states); where the
 * theme declares none, it renders `fallback`, the app's own default glyph.
 *
 * This is the icon floor, the mark parallel of the type floor: silence falls
 * to the app's default, never to nothing — a nav button with no chevron would
 * be unusable. A theme *overrides* the glyph rather than supplying it from
 * scratch.
 */
export default function ThemedArt({
  part,
  state,
  variant,
  fallback = null,
  className,
  style,
}: {
  part: ControlId;
  state?: PartState;
  variant?: string;
  fallback?: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  const svg = useControlArt(part, { state, variant });
  if (!svg) return <>{fallback}</>;
  return (
    <span
      aria-hidden="true"
      className={className}
      style={{ display: 'inline-flex', ...style }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
