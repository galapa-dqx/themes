/**
 * The setting-help specimen: main's `SettingHelp.tsx` + `SettingHelp.module.css`
 * — an `<h2 .Title>` (margin `0 0 19px`) over a `.Body` of `<p>`s 10px apart,
 * inside a `<Themed part="panel">` box. The control owns no box of its own, so
 * the host here is the `panel` control, and the padding is SettingHelp's own
 * `14px 27px 24px 15px` unless the panel declares one (a path `padding`, or an
 * asset panel's nine-slice content rect — both inline on main, and both what
 * `Frame` already applies). Width 281px: the Settings `.Section` column
 * (`SettingsShared.module.css` `minmax(0,1fr) 281px`). main's own specimen was
 * PartSpecimen's `default:` branch — an empty box that drew neither text nor
 * panel.
 *
 * One knowing deviation from main, V2 semantics rather than a bug: the colour
 * is painted, never inherited from the panel (V2 has no ambient content
 * colour). `line-height` is likewise the theme's, not the app's — main hard-set
 * `.Body` to 1.45 and left the title at the UA `normal`, so the first-party
 * themes now declare 1.45 / 1.2 to keep the rendering identical.
 */
import { Frame } from '@/editor/preview/Frame';
import type { ControlView } from '@/editor/preview/resolve';
import { TextPart } from '@/editor/preview/TextPart';
import { textSummary } from '@/editor/preview/textStyle';
import { useView } from '@/editor/preview/useView';
import { useProjectStore } from '@/editor/projectStore';

/** main's Framerate Limit help (GraphicsSettings.tsx 155-171). */
const TITLE = 'Framerate Limit';
const BODY = [
  'Caps how many frames the game renders per second.',
  "Matching your monitor's refresh rate keeps frame pacing smooth and reduces heat and fan noise. Unlimited is best left for benchmarking.",
];

/** The app's own padding, used whenever the panel declares none. */
const OWN_PADDING = '14px 27px 24px 15px';

const mono = {
  fontFamily: 'monospace',
  fontSize: 10,
  color: 'var(--mantine-color-dimmed)',
  wordBreak: 'break-all',
} as const;

export function SettingHelpSpecimen({ view }: { view: ControlView }) {
  const panel = useView('panel', 'default');
  const hasPanel = useProjectStore((s) => s.doc.controls.panel !== undefined);
  const title =
    view.parts.title?.kind === 'text' ? view.parts.title.text : undefined;
  const body =
    view.parts.body?.kind === 'text' ? view.parts.body.text : undefined;
  const frame = panel.kind === 'frame' ? panel.frame : undefined;
  // ponytail: a path panel that declares `padding: 0` is indistinguishable
  // here from one that declares none, so it falls back to SettingHelp's own
  // padding where main honoured the declared 0 (`emitPath` wrote
  // `--g-panel-pad: 0px` whenever padding was set). Telling them apart needs
  // `PathView.padding` to stay undefined rather than four(0); no first-party
  // theme declares 0, so: not worth it until one does.
  const padding =
    frame?.shape === 'path' && frame.padding.every((v) => v === 0)
      ? OWN_PADDING
      : undefined;

  const content = (
    <>
      {title && (
        <TextPart as="h2" view={title} style={{ margin: '0 0 19px' }}>
          {TITLE}
        </TextPart>
      )}
      {body && (
        <TextPart as="div" view={body}>
          {BODY.map((p, i) => (
            <p
              key={i}
              style={{ margin: i === BODY.length - 1 ? 0 : '0 0 10px' }}
            >
              {p}
            </p>
          ))}
        </TextPart>
      )}
    </>
  );

  return (
    <div
      style={{
        width: '100%',
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      {/* Block, like main's .Themed: the title sits at the top padding edge. */}
      {hasPanel && frame ? (
        <Frame
          view={frame}
          style={{
            display: 'block',
            width: 281,
            maxWidth: '100%',
            overflow: 'hidden',
            // Only when it applies: an undefined value would erase Frame's own.
            ...(padding && { padding }),
          }}
        >
          {content}
        </Frame>
      ) : (
        <div
          style={{
            display: 'block',
            width: 281,
            maxWidth: '100%',
            padding: OWN_PADDING,
            border: '1px dashed var(--mantine-color-orange-5)',
          }}
        >
          {content}
        </div>
      )}
      <span style={mono}>
        {!hasPanel && 'Panel not defined · '}Title {textSummary(title)}
        <br />
        Body {textSummary(body)}
      </span>
    </div>
  );
}
