/**
 * The preview host: a card painted with the window control (main's
 * `.Island`), and the 4a state grid of one specimen per forced state.
 */
import type { ComponentType, CSSProperties, ReactNode } from 'react';
import { CONTROL_CATALOG, type RootControlId } from '@/theme/catalog';
import { controlLabel } from '@/editor/tokensUtil';
import {
  statesOf,
  type ControlView,
  type FocusRingView,
  type StateName,
} from './resolve';
import { useFocusRing, useView } from './useView';

export type SpecimenComponent = ComponentType<{
  view: ControlView;
  state: StateName;
  ring: FocusRingView;
}>;

export function Island({
  children,
  style,
}: {
  children: ReactNode;
  style?: CSSProperties;
}) {
  const w = useView('window', 'default');
  const win = w.kind === 'window' ? w.window : undefined;
  return (
    <div
      style={{
        background: win?.fill ?? 'transparent',
        border: `1px solid ${win?.borderColor && win.borderColor !== 'none' ? win.borderColor : 'transparent'}`,
        borderRadius: 8,
        padding: 16,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/** One cell per `default` + state, each captioned (main's IslandLabel look). */
export function StateGrid({
  id,
  Specimen,
  current,
  cellWidth = 150,
}: {
  id: RootControlId;
  Specimen: SpecimenComponent;
  /** The editor's active state tab, highlighted. */
  current: StateName;
  /** Minimum cell width; a wide specimen (the carousel) asks for more. */
  cellWidth?: number;
}) {
  const states: StateName[] = ['default', ...statesOf(CONTROL_CATALOG[id])];
  const ring = useFocusRing();
  return (
    <div
      style={{
        display: 'grid',
        // A stateless control gets the whole panel instead of one narrow cell.
        gridTemplateColumns:
          states.length > 1
            ? `repeat(auto-fill, minmax(${cellWidth}px, 1fr))`
            : '1fr',
        gap: 14,
      }}
    >
      {states.map((s) => (
        <Cell
          key={s}
          id={id}
          state={s}
          ring={ring}
          Specimen={Specimen}
          active={s === current}
        />
      ))}
    </div>
  );
}

function Cell({
  id,
  state,
  ring,
  Specimen,
  active,
}: {
  id: RootControlId;
  state: StateName;
  ring: FocusRingView;
  Specimen: SpecimenComponent;
  active: boolean;
}) {
  const view = useView(id, state);
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        padding: 10,
        borderRadius: 6,
        outline: active ? '1px solid var(--mantine-color-blue-5)' : undefined,
        minWidth: 0,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          minHeight: 48,
          minWidth: 0,
        }}
      >
        <Specimen view={view} state={state} ring={ring} />
      </div>
      <span
        style={{
          fontSize: 11,
          textTransform: 'uppercase',
          letterSpacing: 0.4,
          color: '#888',
        }}
      >
        {controlLabel(state)}
      </span>
    </div>
  );
}
