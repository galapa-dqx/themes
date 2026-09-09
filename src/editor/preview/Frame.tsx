/**
 * The frame renderer: a path box (fill, per-edge stroke, radius, corner
 * shape, padding, opacity) or a nine-slice asset box, drawn for one resolved
 * state. Mirrors main's <Themed> pixel for pixel; see Frame.module.css.
 */
import {
  useContext,
  type ComponentProps,
  type CSSProperties,
  type ElementType,
  type ReactNode,
} from 'react';
import type { Four } from './resolve';
import type { AssetView, FocusRingView, PathView } from './resolve';
import { SliceGrid } from './SliceGrid';
import { useAsset } from './useAsset';
import { BoxesContext } from './useView';
import styles from './Frame.module.css';

const px = ([t, r, b, l]: Four) => `${t}px ${r}px ${b}px ${l}px`;
const CONCAVE = ['scoop', 'notch'];

export type FrameProps<E extends ElementType> = {
  as?: E;
  view: PathView | AssetView;
  /** Pass only when the state shows the ring (`view.showRing`). */
  ring?: FocusRingView;
  /** Seated in the top stroke (the input's floating label). */
  label?: ReactNode;
  /** Minimum run of stroke before the seated label, in px. */
  leftInset?: number;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
} & Omit<ComponentProps<E>, 'as' | 'style' | 'className' | 'children'>;

export function Frame<E extends ElementType = 'div'>({
  as,
  view,
  ring,
  label,
  leftInset,
  className,
  style,
  children,
  ...rest
}: FrameProps<E>) {
  const Tag = (as ?? 'div') as ElementType;
  const boxes = useContext(BoxesContext);
  const { asset, error } = useAsset(
    view.shape === 'asset' ? view.asset : undefined,
  );
  // Still reading the file: nothing rather than a flash of the placeholder.
  if (view.shape === 'asset' && view.asset && !asset && !error) return null;
  const seat =
    label !== undefined ? (
      <span className={styles.Label}>{label}</span>
    ) : undefined;

  let vars: Record<string, string> = {};
  let padding: Four = [0, 0, 0, 0];
  let surface: ReactNode;
  if (view.shape === 'path') {
    const t = view.border.thickness;
    padding = view.padding;
    vars = {
      '--part-fill': view.fill === 'none' ? 'transparent' : view.fill,
      '--part-bc':
        view.border.color === 'none' ? 'transparent' : view.border.color,
      '--part-bw': px(t),
      '--part-bw-t': `${t[0]}px`,
      '--part-corner-pad': `${CONCAVE.includes(view.corner) ? t[0] : 0}px`,
      '--part-radius': view.radius === 'pill' ? '999px' : `${view.radius}px`,
      '--part-corner': view.corner,
      '--part-lead': `${leftInset ?? 0}px`,
    };
    surface = (
      <span className={styles.Surface}>
        <span className={styles.TopEdge}>
          <i className={styles.Lead} />
          {seat}
          <i className={styles.Trail} />
        </span>
        <span className={styles.Body} />
      </span>
    );
  } else if (asset) {
    const s = asset.slicing;
    const o = s?.overdraw ?? { top: 0, right: 0, bottom: 0, left: 0 };
    const c = s?.content;
    // ponytail: no undersized-host padding shrink (main's ResizeObserver factor).
    padding = c ? [c.top, c.right, c.bottom, c.left] : [0, 0, 0, 0];
    // No --part-bw-t: the seat's translate is invalid and the label stays
    // centred in the top slice band by SliceGrid's flex row, as on main.
    surface = (
      <span
        className={styles.LayerStack}
        style={{
          inset: `${-o.top}px ${-o.right}px ${-o.bottom}px ${-o.left}px`,
        }}
      >
        <SliceGrid asset={asset} label={seat} className={styles.LayerFill} />
      </span>
    );
  } else {
    // Missing or unparseable art: an honest placeholder, label still seated.
    surface = (
      <span className={styles.Placeholder} title={error ?? 'No asset'}>
        {seat}
      </span>
    );
  }

  return (
    <Tag
      className={className ? `${styles.Host} ${className}` : styles.Host}
      style={
        {
          ...vars,
          padding: px(padding),
          opacity: view.opacity,
          width: view.size?.width,
          height: view.size?.height,
          outline: ring ? `${ring.width}px solid ${ring.color}` : undefined,
          outlineOffset: ring ? `${ring.offset}px` : undefined,
          ...style,
        } as CSSProperties
      }
      {...rest}
    >
      {surface}
      {children}
      {boxes && (
        <>
          <span className={styles.LayoutBox} />
          <span className={styles.ContentBox} style={{ inset: px(padding) }} />
        </>
      )}
    </Tag>
  );
}
