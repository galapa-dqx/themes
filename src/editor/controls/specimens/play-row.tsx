/**
 * The play-row specimen: main's `Home.tsx` 106-110 — `<PlayOrnament/>
 * <Button>Play</Button><PlayOrnament flip/>` in `.PlayRow` (flex, centred,
 * `gap: 15px`) inside the login `<Themed part="panel" .LoginPanel>`
 * (`Home.module.css` 19-32). The row itself is app-owned geometry; the theme
 * supplies only the art, so the host here is the `panel` control the row
 * actually sits on, at the launcher column's 281px. main's own specimen was
 * PartSpecimen's `default:` branch — an empty 120px box that drew neither.
 *
 * Two knowing deviations from main, both V2 semantics rather than bugs: an
 * ornament with no asset draws *nothing* (V1 fell back to the app's Flourish
 * glyph, which V2 dropped — eleven of the thirteen first-party themes are in
 * this case), and the art is drawn into the part's own 35 x 20 box (letterboxed,
 * never stretched) instead of at the SVG's intrinsic size.
 */
import { useContext } from 'react';
import { Frame } from '@/editor/preview/Frame';
import { ImagePart } from '@/editor/preview/ImagePart';
import type { ControlView, ImageView } from '@/editor/preview/resolve';
import { BoxesContext, useView } from '@/editor/preview/useView';
import { useProjectStore } from '@/editor/projectStore';
import { ThemedButton } from './button';

/** App-owned geometry (Home.module.css). */
const GAP = 15;
/** `.LoginPanel`'s own padding, which a panel declaring one outranks (inline). */
const OWN_PADDING = '0 27px';
/** The launcher's right column (`.Launcher` grid-template-columns). */
const WIDTH = 281;

const mono = {
  fontFamily: 'monospace',
  fontSize: 10,
  color: 'var(--mantine-color-dimmed)',
  wordBreak: 'break-all',
} as const;

function Ornament({ view, flip }: { view: ImageView; flip?: boolean }) {
  const boxes = useContext(BoxesContext);
  if (!view.asset)
    return boxes ? (
      <span
        style={{
          width: view.size?.width,
          height: view.size?.height,
          border: '1px dashed var(--mantine-color-dimmed)',
        }}
      />
    ) : null;
  return (
    <ImagePart
      view={view}
      style={flip ? { transform: 'scaleX(-1)' } : undefined}
    />
  );
}

export function PlayRowSpecimen({ view }: { view: ControlView }) {
  const panel = useView('panel', 'default');
  const button = useView('button', 'default');
  const hasPanel = useProjectStore((s) => s.doc.controls.panel !== undefined);
  const orn =
    view.parts.ornament?.kind === 'image'
      ? view.parts.ornament.image
      : undefined;
  const frame = panel.kind === 'frame' ? panel.frame : undefined;
  const padding =
    frame?.shape === 'path' && frame.padding.every((v) => v === 0)
      ? OWN_PADDING
      : undefined;

  const row = (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: GAP,
      }}
    >
      {orn && <Ornament view={orn} />}
      <ThemedButton view={button}>Play</ThemedButton>
      {orn && <Ornament view={orn} flip />}
    </div>
  );
  // main's panel fills the launcher column and centres its content; the
  // specimen shows the row alone, so the height is the only thing invented.
  const box = {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    width: WIDTH,
    maxWidth: '100%',
    minHeight: 96,
  } as const;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        width: '100%',
        minWidth: 0,
      }}
    >
      {hasPanel && frame ? (
        <Frame view={frame} style={{ ...box, ...(padding && { padding }) }}>
          {row}
        </Frame>
      ) : (
        <div
          style={{
            ...box,
            padding: OWN_PADDING,
            border: '1px dashed var(--mantine-color-orange-5)',
          }}
        >
          {row}
        </div>
      )}
      <span style={mono}>
        {!hasPanel && 'Panel not defined · '}
        {orn?.asset
          ? [
              orn.asset.replace(/^.*\//, ''),
              orn.currentColor ?? 'no tint',
              `${orn.size?.width} x ${orn.size?.height}`,
              orn.opacity !== 1 ? `α ${orn.opacity}` : undefined,
            ]
              .filter(Boolean)
              .join(' · ')
          : 'No asset — the launcher draws no ornament'}
      </span>
    </div>
  );
}
