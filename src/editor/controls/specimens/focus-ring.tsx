/**
 * The focus-ring specimen. The ring is a CSS outline on the host's border box
 * (main's Themed.module.css:216-225), and the host carries the frame's radius
 * and corner shape, so the ring follows the control's own shape. This shows
 * the real hosts in their focused state with the ring on. A neutral geometry box goes
 * first, because a ring the same colour as the control it lands on (anlucia's
 * accent button) is invisible there, and width/offset still need to be legible.
 * A host whose focused state sets `showRing: false` shows no ring, as on main.
 */
import type { CSSProperties, ReactNode } from 'react';
import type { RootControlId } from '@/theme/catalog';
import { GenericSpecimen } from '@/editor/preview/GenericSpecimen';
import type { FocusRingView } from '@/editor/preview/resolve';
import { useView } from '@/editor/preview/useView';
import { controlLabel } from '@/editor/tokensUtil';

/** Ring owners main showed on the launcher's first screen. */
const HOSTS: RootControlId[] = ['button', 'input', 'setting-row'];
const WIRE = 'rgb(128 128 128 / 55%)';
const caption: CSSProperties = {
  fontSize: 11,
  textTransform: 'uppercase',
  letterSpacing: 0.4,
  color: '#888',
};

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 6,
        minWidth: 0,
      }}
    >
      {children}
      <span style={caption}>{label}</span>
    </div>
  );
}

// ponytail: hosts render through the generic specimen; each host's own port
// gives it a faithful one — swap `GenericSpecimen` for `CONTROLS[id].Specimen`
// once that no longer means importing the registry from inside it.
function Host({ id, ring }: { id: RootControlId; ring: FocusRingView }) {
  const view = useView(id, 'focused');
  return (
    <Row
      label={`${controlLabel(id)}${view.showRing === false ? ' · ring off' : ''}`}
    >
      <GenericSpecimen view={view} ring={ring} />
    </Row>
  );
}

export function FocusRingSpecimen({ ring }: { ring: FocusRingView }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        minWidth: 0,
      }}
    >
      <Row label="Geometry">
        <div
          style={{
            width: 120,
            height: 36,
            borderRadius: 4,
            border: `1px dashed ${WIRE}`,
            outline: `${ring.width}px solid ${ring.color}`,
            outlineOffset: ring.offset,
          }}
        />
      </Row>
      {HOSTS.map((id) => (
        <Host key={id} id={id} ring={ring} />
      ))}
      <span
        style={{ ...caption, fontFamily: 'monospace', textTransform: 'none' }}
      >
        {ring.color} · {ring.width}px · offset {ring.offset}px
      </span>
    </div>
  );
}
