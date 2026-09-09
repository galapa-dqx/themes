/**
 * The main body beside a resizable right-hand panel. The split is one
 * app-wide preference, so every page shares it; drag the panel's left edge.
 */
import { useRef, useState, type ReactNode } from 'react';
import { useAppStore } from './appStore';

const MIN = 0.2;
const MAX = 0.6;

export function SplitPane({
  children,
  side,
}: {
  children: ReactNode;
  side: ReactNode;
}) {
  const fraction = useAppStore((s) => s.sideFraction);
  const setSideFraction = useAppStore((s) => s.setSideFraction);
  const ref = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  return (
    <div
      ref={ref}
      style={{
        display: 'grid',
        gridTemplateColumns: `minmax(360px, ${1 - fraction}fr) minmax(240px, ${fraction}fr)`,
        minHeight: 0,
        userSelect: dragging ? 'none' : undefined,
      }}
    >
      {children}
      <div style={{ position: 'relative', minHeight: 0, display: 'grid' }}>
        {side}
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize panel"
          onPointerDown={(e) => {
            e.preventDefault();
            e.currentTarget.setPointerCapture(e.pointerId);
            setDragging(true);
          }}
          onPointerMove={(e) => {
            if (!dragging) return;
            const r = ref.current!.getBoundingClientRect();
            setSideFraction(
              Math.min(MAX, Math.max(MIN, (r.right - e.clientX) / r.width)),
            );
          }}
          onPointerUp={() => setDragging(false)}
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: -3,
            width: 7,
            cursor: 'col-resize',
            zIndex: 1,
            touchAction: 'none',
            background: dragging
              ? 'linear-gradient(to right, transparent 2px, var(--mantine-color-blue-6) 2px, var(--mantine-color-blue-6) 4px, transparent 4px)'
              : undefined,
          }}
        />
      </div>
    </div>
  );
}
