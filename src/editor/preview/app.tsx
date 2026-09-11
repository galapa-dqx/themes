/**
 * 4e: the Galapa app itself — main's Launcher and Settings screens composed
 * from the preview primitives at main's geometry (Home.module.css,
 * SettingsShared.module.css, TitleBar.module.css, ScrollPanel.module.css).
 * Every themed instance is a `useInstance` so the Preview page can hit-test
 * it and force a state on that one instance alone.
 */
import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { RootControlId } from '@/theme/catalog';
import {
  CaptionButton,
  type Glyph,
} from '@/editor/controls/specimens/titlebar';
import { useProjectStore } from '@/editor/projectStore';
import { Frame } from './Frame';
import { ImagePart } from './ImagePart';
import type { ControlView, FocusRingView, TextView } from './resolve';
import { TextPart } from './TextPart';
import { APP_SIZE, useFocusRing, useInstance, type Screen } from './useView';

/** main Window.css:89-91. */
const SHADOW = '0 25px 50px -12px rgb(0 0 0/45%), 0 2px 8px rgb(0 0 0/20%)';
const NO_TEXT: TextView = { opacity: 1 };
const BANNER = '/banners/version-update.svg';

/** main:src/pages/Home/Home.tsx. */
const NEWS = [
  [
    'events',
    'Astoltia Birthday Celebration: Summer Special Campaign 2026',
    'Aug 1',
  ],
  [
    'events',
    "Chatty Drackyma's Astoltia 14th Anniversary Countdown!",
    'Jul 31',
  ],
  ['updates', '[DQX Shop] 14th Anniversary Grand Thanksgiving!', 'Jul 30'],
  [
    'maintenance',
    'Notice Regarding d Payment Service Restoration (7/30)',
    'Jul 29',
  ],
  [
    'news',
    '[DQXTV] Notice Regarding the Postponement of the 14th Anniversary Eve Festival',
    'Jul 28',
  ],
  [
    'updates',
    "[iOS] Dragon Quest X Adventurer's Handy Tool (Ver. 8.0.1)",
    'Jul 27',
  ],
  ['events', 'Super Summer Scoop-Off! Screenshot Contest Now Open', 'Jul 26'],
  ['maintenance', 'Scheduled Maintenance Completion Notice (7/25)', 'Jul 25'],
] as const;
/** main:src/pages/Settings/SettingsLayout.tsx and GraphicsSettings.tsx. */
const SECTIONS = [
  'Game',
  'Players',
  'Graphics',
  'Controls',
  'Sound',
  'Clarity',
  'About',
];
const SETTINGS: { label: string; value?: string; on?: boolean }[] = [
  { label: 'Screen Mode', value: 'Borderless Windowed' },
  { label: 'Screen Resolution', value: '1920x1080' },
  { label: 'Screen Brightness', value: '100%' },
  { label: 'Vsync', on: true },
  { label: 'Ignore power settings while running', on: false },
  { label: 'Text Rendering', value: 'IMM32' },
  { label: 'Framerate Limit', value: '60 fps' },
];
const HELP = {
  title: 'Screen Mode',
  body: [
    'Controls how the game occupies your screen — whether it takes exclusive control of the display or runs as a window managed by your desktop.',
    'Borderless Windowed (Recommended) — A window with no borders filling the screen, locked to your desktop’s resolution and refresh rate. Instant alt-tabbing and reliable overlays.',
    'Windowed — A standard resizable window on your desktop. Easiest for multitasking, but you lose screen space to the title bar.',
  ],
};

const text = (view: ControlView, name: string) => {
  const p = view.parts[name];
  return p?.kind === 'text' ? p.text : undefined;
};
const ringStyle = (ring: FocusRingView | undefined) =>
  ring
    ? {
        outline: `${ring.width}px solid ${ring.color}`,
        outlineOffset: ring.offset,
      }
    : undefined;

export function GalapaApp({ screen }: { screen: Screen }) {
  const win = useInstance('window', 'window');
  const chrome = useProjectStore((s) => s.doc.metadata.chromeStyle);
  const w = win.view.kind === 'window' ? win.view.window : undefined;
  const border =
    w?.borderColor && w.borderColor !== 'none' ? w.borderColor : 'transparent';
  return (
    <div
      {...win.hit}
      style={{
        ...APP_SIZE,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        borderRadius: 8,
        background: w?.fill ?? 'transparent',
        border: `1px solid ${border}`,
        boxShadow: SHADOW,
        colorScheme: chrome,
      }}
    >
      <TitleBar screen={screen} />
      <main
        style={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          minHeight: 0,
        }}
      >
        {screen === 'launcher' ? <Launcher /> : <Settings />}
      </main>
    </div>
  );
}

/* ---------- chrome ---------- */

function TitleBar({ screen }: { screen: Screen }) {
  const bar = useInstance('titlebar', 'bar');
  if (bar.view.kind !== 'frame') return null;
  const f = bar.view.frame;
  const under =
    f.shape === 'path' && f.border.color !== 'none' ? f.border.thickness[2] : 0;
  const wordmark = text(bar.view, 'wordmark');
  return (
    <Frame
      as="header"
      view={f}
      {...bar.hit}
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto 1fr',
        alignItems: 'center',
        flex: 'none',
        width: '100%',
        height: f.size?.height ?? 34,
        userSelect: 'none',
      }}
    >
      {wordmark && (
        <TextPart
          view={wordmark}
          style={{ whiteSpace: 'nowrap', lineHeight: 1 }}
        >
          Galapa
        </TextPart>
      )}
      <div style={{ justifySelf: 'center', height: '100%' }}>
        <TabRow hints="bumper">
          <Tab
            control="tab"
            k="launcher"
            label="Launcher"
            selected={screen === 'launcher'}
            minWidth={87}
          />
          <Tab
            control="tab"
            k="settings"
            label="Settings"
            selected={screen === 'settings'}
            minWidth={87}
          />
        </TabRow>
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifySelf: 'end',
          height: '100%',
        }}
      >
        <Caption k="minimize" part="caption" under={under} />
        <Caption k="maximize" part="caption" under={under} />
        <Caption k="close" part="close" under={under} />
      </div>
    </Frame>
  );
}

function Caption({
  k,
  part,
  under,
}: {
  k: Glyph;
  part: 'caption' | 'close';
  under: number;
}) {
  const { view, hit } = useInstance('titlebar', k);
  const ring = useFocusRing();
  const p = view.parts[part];
  const icon = view.parts[`${part}-icon`];
  if (p?.kind !== 'frame') return null;
  return (
    <CaptionButton
      part={p}
      paint={icon?.kind === 'paint' ? icon.paint : { opacity: 1 }}
      glyph={k}
      height={(p.frame.size?.height ?? 34) - under}
      ring={ring}
      {...hit}
    />
  );
}

/** main's `.TabBar`: the hints flanking `.Tabs`, inside 10px gutters. */
function TabRow({
  hints,
  children,
}: {
  hints: 'bumper' | 'trigger';
  children: ReactNode;
}) {
  const { view, hit } = useInstance('tab-bar', hints);
  const hint =
    view.parts.hint?.kind === 'variant-image'
      ? view.parts.hint.variant
      : undefined;
  const side = (s: 'left' | 'right') =>
    hint && (
      <span {...hit} style={{ display: 'inline-flex', flex: 'none' }}>
        <ImagePart view={hint} variant={`${s}-${hints}`} />
      </span>
    );
  return (
    <nav
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        height: '100%',
        padding: '0 10px',
      }}
    >
      {side('left')}
      <div
        style={{
          display: 'flex',
          alignItems: 'stretch',
          gap: 5,
          height: '100%',
        }}
      >
        {children}
      </div>
      {side('right')}
    </nav>
  );
}

function Tab({
  control,
  k,
  label,
  selected,
  minWidth,
}: {
  control: RootControlId;
  k: string;
  label: string;
  selected: boolean;
  minWidth: number;
}) {
  const { view, hit } = useInstance(
    control,
    k,
    selected ? 'selected' : 'default',
  );
  const ring = useFocusRing();
  if (view.kind !== 'frame') return null;
  const t = text(view, 'text');
  return (
    <Frame
      view={view.frame}
      ring={view.showRing ? ring : undefined}
      {...hit}
      style={{ minWidth, justifyContent: 'center' }}
    >
      {t && <TextPart view={t}>{label}</TextPart>}
    </Frame>
  );
}

/** main's ScrollPanel: a hidden native scrollbar, the themed one 8px off the content, synced on scroll. */
function ScrollPanel({
  k,
  fade,
  bleedLeft = 0,
  children,
}: {
  k: string;
  fade?: boolean;
  bleedLeft?: number;
  children: ReactNode;
}) {
  const { view, hit } = useInstance('scrollbar', k);
  const vp = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, height: 100 });
  const sync = useCallback(() => {
    const el = vp.current;
    if (!el) return;
    const height = Math.max(12, (el.clientHeight / el.scrollHeight) * 100);
    const max = el.scrollHeight - el.clientHeight;
    const top = max > 0 ? (el.scrollTop / max) * (100 - height) : 0;
    setPos((p) => (p.top === top && p.height === height ? p : { top, height }));
  }, []);
  useLayoutEffect(() => {
    // Fonts arrive after mount and change the content height.
    const ro = new ResizeObserver(sync);
    ro.observe(vp.current!.firstElementChild!);
    return () => ro.disconnect();
  }, [sync]);
  const track = view.parts.track;
  const thumb = view.parts.thumb;
  const tw = track?.kind === 'frame' ? (track.frame.size?.width ?? 8) : 8;
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `minmax(0, 1fr) ${tw}px`,
        columnGap: 8,
        minHeight: 0,
        height: '100%',
      }}
    >
      <div
        ref={vp}
        onScroll={sync}
        style={{
          minHeight: 0,
          overflowY: 'auto',
          scrollbarWidth: 'none',
          marginLeft: -bleedLeft,
          paddingLeft: bleedLeft,
          maskImage: fade
            ? 'linear-gradient(to bottom, #000 95%, transparent 100%)'
            : undefined,
        }}
      >
        {children}
      </div>
      {track?.kind === 'frame' && thumb?.kind === 'frame' && (
        <Frame view={track.frame} {...hit} style={{ width: 'auto' }}>
          <Frame
            view={thumb.frame}
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              width: 'auto',
              top: `${pos.top}%`,
              height: `${pos.height}%`,
            }}
          />
        </Frame>
      )}
    </div>
  );
}

/* ---------- launcher ---------- */

function Launcher() {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateRows: 'auto minmax(0, 1fr)',
        gridTemplateColumns: 'minmax(0, 1fr) 281px',
        gap: '10px 20px',
        height: '100%',
        padding: '26px 34px 34px',
      }}
    >
      <div style={{ gridColumn: '1 / -1' }}>
        <Carousel />
      </div>
      <ScrollPanel k="news" fade bleedLeft={8}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {NEWS.map(([category, title, date], i) => (
            <NewsRow
              key={i}
              k={`news-${i}`}
              category={category}
              title={title}
              date={date}
            />
          ))}
        </div>
      </ScrollPanel>
      <LoginPanel />
    </div>
  );
}

function Carousel() {
  const { view, hit } = useInstance('carousel', 'frame');
  if (view.kind !== 'frame') return null;
  const f = view.frame;
  const radius =
    f.shape === 'path' ? (f.radius === 'pill' ? 999 : f.radius) : 0;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <Frame
        as="figure"
        view={f}
        {...hit}
        style={{ display: 'block', margin: 0, width: '100%' }}
      >
        <img
          src={BANNER}
          alt="Version 7.4 — The Sable Depths"
          style={{
            display: 'block',
            width: '100%',
            aspectRatio: '728 / 185',
            objectFit: 'cover',
            borderRadius: radius,
          }}
        />
        <Nav side="left" />
        <Nav side="right" />
      </Frame>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          padding: '2px 0',
        }}
      >
        {[0, 1, 2].map((i) => (
          <Pip key={i} index={i} />
        ))}
      </div>
    </div>
  );
}

const ART_BUTTON = {
  display: 'grid',
  placeItems: 'center',
  padding: 0,
  background: 'none',
  border: 0,
  cursor: 'pointer',
} as const;

function Nav({ side }: { side: 'left' | 'right' }) {
  const { view, hit } = useInstance('carousel', `nav-${side}`);
  const ring = useFocusRing();
  const nav = view.parts.nav;
  if (nav?.kind !== 'image') return null;
  return (
    <button
      type="button"
      tabIndex={-1}
      aria-label={side === 'left' ? 'Previous banner' : 'Next banner'}
      {...hit}
      style={{
        ...ART_BUTTON,
        position: 'absolute',
        top: '50%',
        [side]: -15,
        transform: 'translateY(-50%)',
        width: nav.image.size?.width,
        height: nav.image.size?.height,
        ...ringStyle(nav.showRing ? ring : undefined),
      }}
    >
      <ImagePart
        view={nav.image}
        style={side === 'left' ? { transform: 'scaleX(-1)' } : undefined}
      />
    </button>
  );
}

function Pip({ index }: { index: number }) {
  const { view, hit } = useInstance(
    'carousel',
    `pip-${index}`,
    index === 0 ? 'selected' : 'default',
  );
  const ring = useFocusRing();
  const pip = view.parts.pip;
  if (pip?.kind !== 'image') return null;
  return (
    <button
      type="button"
      tabIndex={-1}
      aria-label={`Go to banner ${index + 1} of 3`}
      {...hit}
      style={{
        ...ART_BUTTON,
        width: pip.image.size?.width,
        height: pip.image.size?.height,
        ...ringStyle(pip.showRing ? ring : undefined),
      }}
    >
      <ImagePart view={pip.image} />
    </button>
  );
}

function NewsRow({
  k,
  category,
  title,
  date,
}: {
  k: string;
  category: string;
  title: string;
  date: string;
}) {
  const { view, hit } = useInstance('news-item', k);
  const ring = useFocusRing();
  if (view.kind !== 'frame') return null;
  const gem =
    view.parts.gem?.kind === 'variant-image'
      ? view.parts.gem.variant
      : undefined;
  return (
    <Frame
      view={view.frame}
      ring={view.showRing ? ring : undefined}
      {...hit}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        width: '100%',
        minWidth: 0,
        flex: 'none',
      }}
    >
      {gem && (
        <ImagePart
          view={gem}
          variant={category}
          style={{
            position: 'absolute',
            top: '50%',
            left: 0,
            transform: 'translate(-50%, -50%)',
          }}
        />
      )}
      <TextPart
        view={text(view, 'title') ?? NO_TEXT}
        style={{
          flex: 1,
          minWidth: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {title}
      </TextPart>
      <TextPart
        as="time"
        view={text(view, 'date') ?? NO_TEXT}
        style={{ flex: 'none' }}
      >
        {date}
      </TextPart>
    </Frame>
  );
}

function LoginPanel() {
  const { view, hit } = useInstance('panel', 'login');
  if (view.kind !== 'frame') return null;
  const f = view.frame;
  // `.LoginPanel`'s own padding, which a panel declaring one outranks.
  const own = f.shape === 'path' && f.padding.every((v) => v === 0);
  return (
    <Frame
      view={f}
      {...hit}
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: 19,
        minWidth: 0,
        ...(own && { padding: '0 27px' }),
      }}
    >
      <Input k="username" label="Username" value="anlucialuvr69" />
      <Input k="password" label="Password" placeholder="Enter password" />
      <PlayRow />
    </Frame>
  );
}

function Input({
  k,
  label,
  value,
  placeholder,
}: {
  k: string;
  label: string;
  value?: string;
  placeholder?: string;
}) {
  const { view, state, hit } = useInstance('input', k);
  const ring = useFocusRing();
  if (view.kind !== 'frame') return null;
  const lbl = text(view, 'label');
  const line =
    (value ? text(view, 'value') : text(view, 'placeholder')) ?? NO_TEXT;
  const caret =
    view.parts.caret?.kind === 'paint' ? view.parts.caret.paint : undefined;
  return (
    <Frame
      view={view.frame}
      ring={view.showRing ? ring : undefined}
      {...hit}
      label={
        lbl && (
          <TextPart view={lbl} style={{ paddingInline: 5, display: 'block' }}>
            {label}
          </TextPart>
        )
      }
      leftInset={lbl?.leftInset}
      style={{ width: '100%' }}
    >
      {/* main's `.Input` line height is app CSS, not the theme's. */}
      <TextPart
        view={line}
        style={{
          flex: '0 1 auto',
          minWidth: 0,
          overflow: 'hidden',
          whiteSpace: 'nowrap',
          lineHeight: 1.5,
        }}
      >
        {value ?? placeholder}
      </TextPart>
      {state === 'focused' && caret && (
        <span
          style={{
            flex: 'none',
            width: 1,
            height: (line.typography?.fontSize ?? 16) * 1.5,
            background: caret.color,
            opacity: caret.opacity,
          }}
        />
      )}
      <span style={{ flex: 1 }} />
    </Frame>
  );
}

function PlayRow() {
  const orn = useInstance('play-row', 'ornament');
  const btn = useInstance('button', 'play');
  const ring = useFocusRing();
  const image =
    orn.view.parts.ornament?.kind === 'image'
      ? orn.view.parts.ornament.image
      : undefined;
  const ornament = (flip?: boolean) =>
    image?.asset && (
      <span {...orn.hit} style={{ display: 'inline-flex' }}>
        <ImagePart
          view={image}
          style={flip ? { transform: 'scaleX(-1)' } : undefined}
        />
      </span>
    );
  const label = btn.view.kind === 'frame' ? text(btn.view, 'text') : undefined;
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 15,
      }}
    >
      {ornament()}
      {btn.view.kind === 'frame' && (
        <Frame
          as="button"
          type="button"
          tabIndex={-1}
          view={btn.view.frame}
          ring={btn.view.showRing ? ring : undefined}
          {...btn.hit}
          style={{ justifyContent: 'center', cursor: 'pointer' }}
        >
          {label && <TextPart view={label}>Play</TextPart>}
        </Frame>
      )}
      {ornament(true)}
    </div>
  );
}

/* ---------- settings ---------- */

function Settings() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        height: '100%',
      }}
    >
      <SubTabs />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) 281px',
          gap: 20,
          flex: 1,
          minHeight: 0,
          padding: '26px 34px 34px',
        }}
      >
        <ScrollPanel k="settings">
          <Column />
        </ScrollPanel>
        <Help />
      </div>
    </div>
  );
}

function SubTabs() {
  const { view, hit } = useInstance('subtabs', 'strip');
  if (view.kind !== 'frame') return null;
  const f = view.frame;
  return (
    <Frame
      as="header"
      view={f}
      {...hit}
      style={{
        flex: 'none',
        width: '100%',
        justifyContent: 'center',
        // Border-box, as main's `.SubTabs`: the stroke eats a row of the height.
        padding:
          f.shape === 'path'
            ? f.padding
                .map((p, i) => `${p + f.border.thickness[i]}px`)
                .join(' ')
            : undefined,
      }}
    >
      <TabRow hints="trigger">
        {SECTIONS.map((s) => (
          <Tab
            key={s}
            control="subtab"
            k={s.toLowerCase()}
            label={s}
            selected={s === 'Graphics'}
            minWidth={0}
          />
        ))}
      </TabRow>
    </Frame>
  );
}

function Column() {
  const { view, hit } = useInstance('settings', 'heading');
  const heading = text(view, 'heading');
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        minHeight: 0,
      }}
    >
      {heading && (
        <TextPart as="h2" view={heading} style={{ margin: 0 }} {...hit}>
          Application
        </TextPart>
      )}
      {SETTINGS.map((s, i) => (
        <SettingRow
          key={s.label}
          k={`row-${i}`}
          label={s.label}
          selected={i === 0}
        >
          {s.value ?? <Switch k={`switch-${i}`} checked={s.on!} />}
        </SettingRow>
      ))}
    </div>
  );
}

function SettingRow({
  k,
  label,
  selected,
  children,
}: {
  k: string;
  label: string;
  selected: boolean;
  children: ReactNode;
}) {
  const { view, hit } = useInstance(
    'setting-row',
    k,
    selected ? 'selected' : 'default',
  );
  const ring = useFocusRing();
  if (view.kind !== 'frame') return null;
  return (
    <Frame
      view={view.frame}
      ring={view.showRing ? ring : undefined}
      {...hit}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 19,
        width: '100%',
        minWidth: 0,
        flex: 'none',
      }}
    >
      <TextPart
        view={text(view, 'label') ?? NO_TEXT}
        style={{
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </TextPart>
      <TextPart
        view={text(view, 'value') ?? NO_TEXT}
        style={{ display: 'inline-flex', alignItems: 'center', flex: 'none' }}
      >
        {children}
      </TextPart>
    </Frame>
  );
}

function Switch({ k, checked }: { k: string; checked: boolean }) {
  const { view, state, hit } = useInstance(
    'switch',
    k,
    checked ? 'checked' : 'default',
  );
  const ring = useFocusRing();
  const track = view.parts.track;
  const thumb = view.parts.thumb;
  if (track?.kind !== 'frame' || thumb?.kind !== 'frame') return null;
  const t = track.frame;
  const on = state === 'checked';
  const [padT, , , padL] = t.shape === 'path' ? t.padding : [0, 0, 0, 0];
  return (
    <Frame
      as="button"
      type="button"
      tabIndex={-1}
      role="switch"
      aria-checked={on}
      view={t}
      ring={track.showRing ? ring : undefined}
      {...hit}
      style={{ flex: 'none', cursor: 'pointer' }}
    >
      <Frame
        view={thumb.frame}
        style={{
          position: 'absolute',
          top: padT,
          left: on
            ? `calc(100% - ${thumb.frame.size?.width ?? 0}px - ${padL}px)`
            : padL,
        }}
      />
    </Frame>
  );
}

function Help() {
  const panel = useInstance('panel', 'help');
  const help = useInstance('setting-help', 'help');
  if (panel.view.kind !== 'frame') return null;
  const f = panel.view.frame;
  const own = f.shape === 'path' && f.padding.every((v) => v === 0);
  const title = text(help.view, 'title');
  const body = text(help.view, 'body');
  return (
    <Frame
      view={f}
      {...panel.hit}
      style={{
        display: 'block',
        minHeight: 0,
        overflow: 'hidden',
        ...(own && { padding: '14px 27px 24px 15px' }),
      }}
    >
      <div {...help.hit}>
        {title && (
          <TextPart as="h2" view={title} style={{ margin: '0 0 19px' }}>
            {HELP.title}
          </TextPart>
        )}
        {body && (
          <TextPart as="div" view={body}>
            {HELP.body.map((p, i) => (
              <p
                key={i}
                style={{ margin: i === HELP.body.length - 1 ? 0 : '0 0 10px' }}
              >
                {p}
              </p>
            ))}
          </TextPart>
        )}
      </div>
    </Frame>
  );
}
