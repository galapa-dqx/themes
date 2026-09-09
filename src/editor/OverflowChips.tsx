import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';

/**
 * Shows as many chips as fit on one line, then whatever `overflow` renders
 * for the rest (given how many chips are visible, so it can count by kind).
 * Every chip is rendered once in a hidden row for measurement; the visible
 * row is recomputed whenever the container resizes.
 */
export function OverflowChips({
  chips,
  overflow,
  gap = 4,
}: {
  chips: ReactNode[];
  overflow: (visible: number) => ReactNode;
  gap?: number;
}) {
  const container = useRef<HTMLDivElement>(null);
  const measure = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(chips.length);

  useLayoutEffect(() => {
    const el = container.current;
    const row = measure.current;
    if (!el || !row) return;
    const fit = () => {
      const widths = [...row.children].map(
        (c) => (c as HTMLElement).offsetWidth,
      );
      const more = widths.pop() ?? 0; // the widest "+N" chip
      const available = el.clientWidth;
      let used = 0;
      let count = 0;
      for (const w of widths) {
        if (used + (count ? gap : 0) + w > available) break;
        used += (count ? gap : 0) + w;
        count++;
      }
      if (count < widths.length) {
        while (count > 0 && used + gap + more > available) {
          count--;
          used -= widths[count] + (count ? gap : 0);
        }
      }
      setVisible((v) => (v === count ? v : count));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [chips.length, gap]);

  const hidden = chips.length - visible;
  return (
    <div ref={container} style={{ position: 'relative', minWidth: 0 }}>
      <div
        ref={measure}
        aria-hidden
        style={{
          position: 'absolute',
          visibility: 'hidden',
          display: 'flex',
          gap,
          width: 'max-content',
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
        }}
      >
        {chips.map((c, i) => (
          <span key={i} style={{ flex: 'none' }}>
            {c}
          </span>
        ))}
        <span style={{ flex: 'none' }}>{overflow(0)}</span>
      </div>
      <div
        style={{
          display: 'flex',
          gap,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
        }}
      >
        {chips.slice(0, visible).map((c, i) => (
          <span key={i} style={{ flex: 'none' }}>
            {c}
          </span>
        ))}
        {hidden > 0 && (
          <span style={{ flex: 'none' }}>{overflow(visible)}</span>
        )}
      </div>
    </div>
  );
}
