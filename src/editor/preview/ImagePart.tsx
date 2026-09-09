/**
 * Image and variant-image rendering: the SVG inlined in a sized inline-flex
 * span, tinted through `currentColor` (main's ThemedArt). Omitted variants
 * fall back to the compiler's built-in artwork.
 */
import type { CSSProperties } from 'react';
import type { FocusRingView, ImageView, VariantView } from './resolve';
import { useSvgText } from './useAsset';
import styles from './Frame.module.css';

export function ImagePart({
  view,
  variant,
  ring,
  className,
  style,
}: {
  view: ImageView | VariantView;
  /** Required for a variant image. */
  variant?: string;
  /** Pass only when the state shows the ring (`view.showRing`). */
  ring?: FocusRingView;
  className?: string;
  style?: CSSProperties;
}) {
  const path =
    'assets' in view
      ? variant
        ? view.assets[variant]
        : undefined
      : view.asset;
  const builtin =
    'assets' in view && variant ? view.builtin[variant] : undefined;
  const svg = useSvgText(path);
  const html = path ? svg.text : builtin;
  return (
    <span
      className={className ? `${styles.Image} ${className}` : styles.Image}
      style={{
        width: view.size?.width,
        height: view.size?.height,
        color: view.currentColor,
        opacity: view.opacity,
        outline: ring ? `${ring.width}px solid ${ring.color}` : undefined,
        outlineOffset: ring ? `${ring.offset}px` : undefined,
        ...style,
      }}
      title={svg.error}
      dangerouslySetInnerHTML={{ __html: html ?? '' }}
    />
  );
}
