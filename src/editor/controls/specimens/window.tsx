/**
 * The window specimen: the app's whole surface — fill plus the 1px border the
 * OS frame draws (AppShell.module.css:5-11, Window.css:85-88 on main). Sits on
 * a desktop backdrop so a dark fill on a dark island still shows its edge; the
 * chrome inside is a wireframe, because V2 has no ambient text colour to draw
 * theme text with.
 */
import type { ControlView } from '@/editor/preview/resolve';
import { useProjectStore } from '@/editor/projectStore';

/** main Window.css:89-91 — the OS drop shadow that makes it read as a window. */
const SHADOW = '0 25px 50px -12px rgb(0 0 0/45%), 0 2px 8px rgb(0 0 0/20%)';
const WIRE = 'rgb(128 128 128 / 55%)';

export function WindowSpecimen({ view }: { view: ControlView }) {
  const chrome = useProjectStore((s) => s.doc.metadata.chromeStyle);
  if (view.kind !== 'window') return null;
  const { fill, borderColor } = view.window;
  const border = borderColor === 'none' ? undefined : borderColor;
  return (
    <div style={{ width: '100%', minWidth: 0 }}>
      <div
        style={{
          padding: 18,
          borderRadius: 6,
          // A plain desktop the window sits on; not themed (OS chrome).
          background:
            chrome === 'dark'
              ? 'linear-gradient(#3b4150, #23262e)'
              : 'linear-gradient(#dfe3ea, #c3c9d4)',
        }}
      >
        <div
          style={{
            height: 168,
            display: 'flex',
            flexDirection: 'column',
            borderRadius: 8,
            overflow: 'hidden',
            background: fill ?? 'transparent',
            border: `1px solid ${border ?? 'transparent'}`,
            boxShadow: SHADOW,
          }}
        >
          <div style={{ height: 32, borderBottom: `1px dashed ${WIRE}` }} />
          <div style={{ flex: 1, padding: 12 }}>
            <div
              style={{
                height: '100%',
                border: `1px dashed ${WIRE}`,
                borderRadius: 4,
              }}
            />
          </div>
        </div>
      </div>
      <div
        style={{
          display: 'flex',
          gap: 12,
          marginTop: 8,
          fontFamily: 'monospace',
          fontSize: 11,
          color: 'var(--mantine-color-dimmed)',
        }}
      >
        <span>Fill {fill ?? '—'}</span>
        <span>Border {border ?? 'none'}</span>
      </div>
    </div>
  );
}
