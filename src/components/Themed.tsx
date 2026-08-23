import {
  useCallback,
  type CSSProperties,
  type ComponentPropsWithRef,
  type ElementType,
  type ReactNode,
  type Ref,
} from 'react';
import type { ControlId, PartState } from '@/theme';
import SliceGrid from './SliceGrid';
import { usePartSkin } from './usePartSkin';
import styles from './Themed.module.css';

/**
 * The themed box. One renderer for every surface in the app: it resolves
 * `part` against the active compiled theme and paints it, whether the theme
 * spelled that control as a Path or as a `.9.svg` Asset.
 *
 * The split is "where" vs "how it looks". Themed owns how it looks — fill,
 * stroke, corners, content insets, content colour, opacity, state transitions
 * — all of it from the compiled control, with no defaults of its own: a
 * control that specifies nothing paints nothing. Callers own where: layout,
 * size, typography, and anything positional (a fieldset's legend, a scrollbar
 * thumb's offset) stays in their CSS.
 *
 * `as` picks the element, so the box is the real <button>/<a>/<fieldset>
 * rather than a div wrapped around one.
 */
export type ThemedProps<E extends ElementType> = {
  as?: E;
  /** Control id, e.g. "button" or "switch.thumb". */
  part: ControlId;
  /** Prop-driven state (selected/checked/disabled). Interaction states —
   *  hover, pressed, focused — come from CSS and need no prop. */
  state?: PartState;
  /** Node to seat in the top stroke, for the label-in-the-border look. It
   *  becomes a flex item in the frame's top edge, so the stroke either side
   *  simply flows around it — where it lands is the control's business, not
   *  the caller's. */
  label?: ReactNode;
} & Omit<ComponentPropsWithRef<E>, 'as' | 'part' | 'state' | 'label'>;

/** Paint variables for one scope, falling back to the control's base values. */
function scopeVars(prefix: string, scope: string, name = '') {
  const pick = (prop: string) => `var(${scope}-${prop}, var(${prefix}-${prop}))`;
  return {
    [`--part-${name}fill`]: pick('fill'),
    [`--part-${name}content`]: pick('content'),
    [`--part-${name}bc`]: pick('bc'),
    [`--part-${name}bw`]: pick('bw'),
    [`--part-${name}bw-t`]: pick('bw-t'),
    [`--part-${name}corner-pad`]: pick('corner-pad'),
    [`--part-${name}opacity`]: pick('opacity'),
  };
}

export default function Themed<E extends ElementType = 'div'>({
  as,
  part,
  state,
  label,
  className,
  style,
  children,
  ref,
  ...rest
}: ThemedProps<E>) {
  const Tag = (as ?? 'div') as ElementType;
  const [attachSkin, skin] = usePartSkin(part);

  const setRef = useCallback(
    (el: HTMLElement | null) => {
      const cleanup = attachSkin(el);
      if (typeof ref === 'function') ref(el);
      else if (ref) (ref as { current: unknown }).current = el;
      return cleanup;
    },
    [attachSkin, ref],
  );

  const prefix = `--g-${part.replaceAll('.', '-')}`;
  // A prop state outranks the interaction states: hovering a selected row
  // keeps it looking selected, so the CSS never has to arbitrate.
  const base = state ? `${prefix}-${state}` : prefix;
  const vars: Record<string, string> = {
    ...scopeVars(prefix, base),
    ...scopeVars(prefix, state ? base : `${prefix}-hover`, 'hover-'),
    ...scopeVars(prefix, state ? base : `${prefix}-pressed`, 'pressed-'),
    ...scopeVars(prefix, state ? base : `${prefix}-focused`, 'focused-'),
    '--part-focus-ring-style': `var(${prefix}-focused-ring-style, solid)`,
    '--part-radius': `var(${prefix}-radius)`,
    '--part-corner': `var(${prefix}-corner)`,
    // Where the top edge's label starts. Read from the seated-label control
    // (`<id>.label`), which emits `--g-<id>-label-lead`; absent means no label
    // is seated, hence the 0px fallback — one of the two the doctrine permits.
    '--part-lead': `var(${prefix}-label-lead, 0px)`,
    // The seated label's own colour. A control can decouple it from the stroke
    // it sits in by declaring `<id>.label.contentColor`; left silent, it keeps
    // matching the stroke (which follows state).
    '--part-label-content': `var(${prefix}-label-content, var(--part-bc))`,
  };

  const seat =
    label !== undefined ? <span className={styles.Label}>{label}</span> : undefined;

  return (
    <Tag
      ref={setRef}
      className={className ? `${styles.Themed} ${className}` : styles.Themed}
      // Insets go inline because the theme outranks the host's layout when it
      // has an opinion, and stays silent when it doesn't.
      style={
        {
          ...vars,
          ...(skin.padding ? { padding: skin.padding } : null),
          ...style,
        } as CSSProperties
      }
      data-asset={skin.layers ? '' : undefined}
      data-prop-state={state}
      {...rest}
    >
      {skin.layers ? (
        // Asset: the base art plus one layer per declared state, absolutely
        // stacked in an isolated group so the crossfade composites cleanly.
        <span className={styles.LayerStack}>
          {skin.layers.map((layer, i) => (
            <span
              key={layer.state ?? 'base'}
              className={styles.Layer}
              data-state={layer.state ?? 'base'}
              style={layer.style}
            >
              <SliceGrid
                set={layer.set}
                label={i === 0 ? seat : undefined}
                className={styles.LayerFill}
              />
            </span>
          ))}
        </span>
      ) : (
        <span className={styles.Frame}>
          <span className={styles.TopEdge}>
            <i className={styles.Lead} />
            {seat}
            <i className={styles.Trail} />
          </span>
          <span className={styles.Body} />
        </span>
      )}
      {children}
    </Tag>
  );
}

export type { Ref };
