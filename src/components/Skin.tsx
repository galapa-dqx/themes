import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type HTMLAttributes,
  type ReactNode,
} from 'react';
import { useOSSettings } from '@/context/os-settings';
import { resolveGeometry } from '@/theme';
import { loadSliceSet, type SliceSet } from '@/theme/nineSlice';
import SliceGrid from './SliceGrid';
import styles from './Skin.module.css';

/**
 * Themed surface host. Looks up `part` in the active theme's geometry:
 * Path parts render as a plain panel driven by the compiled `--g-*` vars;
 * Asset parts render their `.9.svg` slices in a grid behind the children,
 * with the asset's content rect applied as padding.
 */
export default function Skin({
  part,
  className,
  children,
  ...rest
}: {
  part: string;
  className?: string;
  children?: ReactNode;
} & HTMLAttributes<HTMLDivElement>) {
  const { theme } = useOSSettings();
  const entry = resolveGeometry(theme.geometry)[part];
  const assetUrl =
    entry?.shape === 'Asset' ? theme.assets?.[entry.asset] : undefined;
  const [loaded, setLoaded] = useState<{ url: string; set: SliceSet } | null>(
    null,
  );

  useEffect(() => {
    if (!assetUrl) return;
    let alive = true;
    loadSliceSet(assetUrl, theme.colors).then(
      (set) => {
        if (alive) setLoaded({ url: assetUrl, set });
      },
      (err: unknown) => {
        console.warn(`[theme] asset for part "${part}" failed; using default`, err);
      },
    );
    return () => {
      alive = false;
    };
  }, [assetUrl, theme.colors, part]);

  // A stale entry from a previous theme simply stops matching the url.
  const slices = loaded && loaded.url === assetUrl ? loaded.set : null;

  // Undersized hosts: SliceGrid shrinks every fixed track by border-image's
  // single reduction factor f = min(1, w/(L+R), h/(T+B)), so the content
  // padding must follow the same factor or children overflow the drawn
  // frame. The factor is a function of our own size, which CSS padding
  // can't express — hence the ResizeObserver. It stays 1 until caps
  // actually overflow, so normal-size controls never re-render from this.
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [shrink, setShrink] = useState(1);
  useEffect(() => {
    const el = hostRef.current;
    if (!slices || !el) return;
    const sum = (sizes: (number | null)[]) =>
      sizes.reduce((total: number, s) => total + (s ?? 0), 0);
    const capX = sum(slices.colSizes);
    const capY = sum(slices.rowSizes);
    const [ot, or_, ob, ol] = slices.outset;
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
  }, [slices]);

  if (assetUrl && slices) {
    const [top, right, bottom, left] = slices.content;
    const [ot, or_, ob, ol] = slices.outset;
    // The safe-area edge sits outset+inset into the painted box, so when the
    // caps draw at factor f it lands (outset+inset)·f − outset inside the
    // host (never negative). With f = 1 this is just the plain inset.
    const pad = (inset: number, out: number, f: number) =>
      Math.max(0, Math.round(((out + inset) * f - out) * 100) / 100);
    return (
      <div
        ref={hostRef}
        className={`${styles.Skin} ${className ?? ''}`}
        style={{
          padding: `${pad(top, ot, shrink)}px ${pad(right, or_, shrink)}px ${pad(bottom, ob, shrink)}px ${pad(left, ol, shrink)}px`,
        }}
        {...rest}
      >
        <SliceGrid
          set={slices}
          className={styles.Slices}
          // The asset's frame rect can declare overdraw painted outside the
          // host's layout box; negative offsets spill the slices past it.
          style={
            ot || or_ || ob || ol
              ? { inset: `${-ot}px ${-or_}px ${-ob}px ${-ol}px` }
              : undefined
          }
        />
        {children}
      </div>
    );
  }

  // Path part (or asset still loading / failed): the compiled variables do
  // the styling; missing entries fall back to the app default panel look.
  const id = part.replaceAll('.', '-');
  const pathStyle: CSSProperties = {
    background: `var(--g-${id}-fill, var(--app-surface))`,
    border: `var(--g-${id}-bw-t, 1px) solid var(--g-${id}-bc, var(--app-border))`,
    borderRadius: `var(--g-${id}-radius, var(--radius))`,
  };
  return (
    <div className={`${styles.Skin} ${className ?? ''}`} style={pathStyle} {...rest}>
      {children}
    </div>
  );
}
