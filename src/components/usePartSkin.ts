import { useCallback, useMemo, useState, type CSSProperties } from 'react';
import { useOSSettings } from '@/context/os-settings';
import { getSliceSet, type SliceSet } from '@/theme/nineSlice';
import type { ControlId, PartState } from '@/theme';

/** One painted layer of an Asset control: the base art, or a state's art
 *  stacked over it for the crossfade. */
export type SkinLayer = {
  /** undefined = base; otherwise the state this art belongs to. */
  state?: PartState;
  set: SliceSet;
  style: CSSProperties;
};

/** What the active theme imposes on a control's host box. */
export type PartSkin = {
  /** Content insets the theme dictates, or undefined when it declares none —
   *  in which case the host keeps whatever padding its own layout wants. */
  padding?: string;
  /** Present only for Asset controls: the base layer first, then one layer per
   *  declared state, all absolutely stacked for <Themed> to crossfade. */
  layers?: SkinLayer[];
};

const layerStyle = (set: SliceSet): CSSProperties => {
  const [ot, or_, ob, ol] = set.outset;
  return {
    position: 'absolute',
    // The frame rect can declare overdraw painted outside the host's layout
    // box; negative offsets spill the slices past it.
    inset: `${-ot}px ${-or_}px ${-ob}px ${-ol}px`,
    pointerEvents: 'none',
  };
};

/**
 * Resolves `part` against the compiled theme. Art now arrives inlined and
 * token-substituted on the compiled theme, so this parses rather than fetches:
 * an Asset control's base art plus every state's art become stacked layers,
 * and the content insets come from the base slice set. It still owns the one
 * inset the cascade can't express — the padding that has to shrink with an
 * undersized host's caps — via a ResizeObserver.
 *
 * Used by <Themed>; components should go through that rather than call this.
 */
export function usePartSkin(
  part: ControlId,
): [ref: (el: HTMLElement | null) => void, skin: PartSkin] {
  const { compiled } = useOSSettings();
  const control = compiled?.controls[part];
  const asset = control && control.shape === 'Asset' ? control : null;

  const layers = useMemo<SkinLayer[] | null>(() => {
    if (!asset) return null;
    const baseSet = getSliceSet(asset.art);
    const out: SkinLayer[] = [{ set: baseSet, style: layerStyle(baseSet) }];
    for (const [state, val] of Object.entries(asset.states ?? {})) {
      const set = getSliceSet(val.art);
      out.push({ state: state as PartState, set, style: layerStyle(set) });
    }
    return out;
  }, [asset]);

  const baseSet = layers?.[0]?.set ?? null;

  // Undersized hosts: SliceGrid shrinks every fixed track by border-image's
  // single reduction factor f = min(1, w/(L+R), h/(T+B)), so the content
  // padding must follow the same factor or children overflow the drawn frame.
  // The factor is a function of the host's own size, which CSS padding can't
  // express — hence the ResizeObserver. It stays 1 until caps actually
  // overflow, so normal-size controls never re-render from this.
  const [shrink, setShrink] = useState(1);

  // A callback ref rather than useRef + effect: the observer has to restart
  // whenever the element OR the slice set changes, and a ref whose identity
  // tracks `baseSet` gets both (React runs the returned cleanup on detach)
  // without costing Path hosts a render just to record their element.
  const attach = useCallback(
    (el: HTMLElement | null) => {
      if (!el || !baseSet) return;
      const sum = (sizes: (number | null)[]) =>
        sizes.reduce((total: number, s) => total + (s ?? 0), 0);
      const capX = sum(baseSet.colSizes);
      const capY = sum(baseSet.rowSizes);
      const [ot, or_, ob, ol] = baseSet.outset;
      const update = () => {
        const w = el.offsetWidth;
        const h = el.offsetHeight;
        // display:none measures 0×0; keep the last real factor instead of
        // treating it as an infinitely squeezed host.
        if (w === 0 && h === 0) return;
        // Caps are sized against the painted box: host plus fixed outsets.
        const fx = capX > 0 ? (w + ol + or_) / capX : 1;
        const fy = capY > 0 ? (h + ot + ob) / capY : 1;
        const f = Math.min(1, fx, fy);
        setShrink((prev) => (Math.abs(prev - f) < 0.002 ? prev : f));
      };
      update();
      const ro = new ResizeObserver(update);
      // border-box: our own padding feeds back into an auto-sized host, and
      // the loop must keep firing until the factor converges (content-box
      // wouldn't see padding-only changes and freezes mid-adjustment).
      ro.observe(el, { box: 'border-box' });
      return () => ro.disconnect();
    },
    [baseSet],
  );

  if (!baseSet) {
    // Path controls read their insets straight off the compiled variable; the
    // variable is absent when the control declares no padding, which is why
    // this is undefined rather than "0" — silence has to stay silent.
    if (control?.shape !== 'Path' || control.padding === undefined) {
      return [attach, {}];
    }
    return [attach, { padding: `var(--g-${part.replaceAll('.', '-')}-pad)` }];
  }

  const [top, right, bottom, left] = baseSet.content;
  const [ot, or_, ob, ol] = baseSet.outset;
  // The safe-area edge sits outset+inset into the painted box, so when the
  // caps draw at factor f it lands (outset+inset)·f − outset inside the host
  // (never negative). With f = 1 this is just the plain inset.
  const pad = (inset: number, out: number) =>
    Math.max(0, Math.round(((out + inset) * shrink - out) * 100) / 100);

  return [
    attach,
    {
      padding: `${pad(top, ot)}px ${pad(right, or_)}px ${pad(bottom, ob)}px ${pad(left, ol)}px`,
      layers: layers ?? undefined,
    },
  ];
}
