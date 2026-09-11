/**
 * 4e: the whole app on one stage, scaled to fit; with Inspect on, the hovered
 * instance gets the forced state and an outline, a click pins it, and the
 * inspector beside the stage shows that control isolated with its resolved
 * values and a way into its editor.
 */
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import {
  Button,
  Group,
  NativeSelect,
  SegmentedControl,
  Stack,
  Switch,
  Text,
} from '@mantine/core';
import {
  Link,
  Navigate,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router';
import type { ControlState, RootControlId } from '@/theme/catalog';
import { CONTROLS } from './controls/registry';
import { GalapaApp } from './preview/app';
import { GenericSpecimen } from './preview/GenericSpecimen';
import { Island } from './preview/Island';
import {
  DISPLAY_ORDER,
  type AssetView,
  type ControlView,
  type PathView,
  type StateName,
} from './preview/resolve';
import { textSummary } from './preview/textStyle';
import {
  APP_SIZE,
  ForceContext,
  SCREENS,
  useFocusRing,
  useView,
  type Screen,
  type Target,
} from './preview/useView';
import { SplitPane } from './SplitPane';
import { controlLabel } from './tokensUtil';

type Hit = Target & { el: Element };
type Box = { left: number; top: number; width: number; height: number };

const BLUE = 'var(--mantine-color-blue-6)';
const hitOf = (el: Element): Hit => {
  const d = (el as HTMLElement).dataset;
  return { id: d.control as RootControlId, key: d.key!, el };
};
const shapeOf = (view: ControlView) =>
  view.kind === 'frame'
    ? view.frame.shape === 'asset'
      ? '9-slice'
      : 'path'
    : view.kind;
const file = (path: string | undefined) =>
  path?.replace(/^.*\//, '') ?? 'no asset';
const frameSummary = (f: PathView | AssetView) =>
  f.shape === 'asset'
    ? file(f.asset)
    : [
        f.fill === 'none' ? 'no fill' : f.fill,
        f.border.color !== 'none' && f.border.thickness.some(Boolean)
          ? `${f.border.thickness.join('/')}px ${f.border.color}`
          : undefined,
        f.radius !== 0 ? `radius ${f.radius}` : undefined,
        f.opacity !== 1 ? `α ${f.opacity}` : undefined,
      ]
        .filter(Boolean)
        .join(' · ');

/** The resolved values, one row per node, parts after their owner. */
const rows = (view: ControlView, name = 'Frame'): [string, string][] => {
  const own = (): [string, string][] => {
    switch (view.kind) {
      case 'frame':
        return [[name, frameSummary(view.frame)]];
      case 'text':
        return [[name, textSummary(view.text)]];
      case 'paint':
        return [[name, view.paint.color ?? 'no colour']];
      case 'image':
        return [
          [
            name,
            [file(view.image.asset), view.image.currentColor]
              .filter(Boolean)
              .join(' · '),
          ],
        ];
      case 'variant-image':
        return [[name, view.variant.currentColor ?? 'no tint']];
      case 'window':
        return [
          [
            name,
            `${view.window.fill ?? 'no fill'} · border ${view.window.borderColor}`,
          ],
        ];
      case 'focus-ring':
        return [
          [
            name,
            `${view.ring.color} · ${view.ring.width}px · offset ${view.ring.offset}`,
          ],
        ];
      case 'composite':
        return [];
    }
  };
  return [
    ...own(),
    ...Object.entries(view.parts).flatMap(([n, p]) => rows(p, controlLabel(n))),
  ];
};

export function PreviewPage() {
  const { id: themeId = '', item } = useParams();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const wanted = params.get('state');
  const force: StateName = DISPLAY_ORDER.includes(wanted as ControlState)
    ? (wanted as StateName)
    : 'default';
  const [inspect, setInspect] = useState(true);
  const [hover, setHover] = useState<Hit>();
  const [selected, setSelected] = useState<Hit>();
  const [scale, setScale] = useState(1);
  const [box, setBox] = useState<Box>();
  const fit = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const target = selected ?? (inspect ? hover : undefined);
  const view = useView(target?.id ?? 'window', force);

  useLayoutEffect(() => {
    const el = fit.current;
    if (!el) return;
    const ro = new ResizeObserver(() =>
      setScale(Math.min(1, el.clientWidth / APP_SIZE.width)),
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, [item]);
  // Re-measured when the forced state or the zoom can move the instance's box.
  useLayoutEffect(() => {
    const s = stage.current;
    if (!target || !s || !target.el.isConnected) {
      setBox(undefined);
      return;
    }
    const r = target.el.getBoundingClientRect();
    const o = s.getBoundingClientRect();
    const next = {
      left: r.left - o.left,
      top: r.top - o.top,
      width: r.width,
      height: r.height,
    };
    setBox((p) =>
      p &&
      p.left === next.left &&
      p.top === next.top &&
      p.width === next.width &&
      p.height === next.height
        ? p
        : next,
    );
  }, [target, force, scale, item]);

  if (!item || !SCREENS.includes(item as Screen))
    return <Navigate to={`/editor/${themeId}/preview/launcher`} replace />;
  const screen = item as Screen;
  const hit = (e: React.PointerEvent | React.MouseEvent) => {
    const el = (e.target as Element).closest('[data-control]');
    return el ? hitOf(el) : undefined;
  };
  const label =
    target &&
    `${controlLabel(target.id)} · ${controlLabel(force)} · ${shapeOf(view)}`;
  const states = ['default', ...DISPLAY_ORDER].map((s) => ({
    value: s,
    label: controlLabel(s),
  }));

  return (
    <div style={{ height: 'calc(100vh - 52px)', display: 'grid' }}>
      <SplitPane
        side={
          <Inspector
            target={target}
            state={force}
            view={view}
            themeId={themeId}
          />
        }
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            minWidth: 0,
            minHeight: 0,
          }}
        >
          <Group
            gap={10}
            p="10px 16px"
            wrap="nowrap"
            style={{
              borderBottom: '1px solid var(--mantine-color-default-border)',
              background: 'var(--mantine-color-body)',
            }}
          >
            <SegmentedControl
              size="xs"
              style={{ flex: 'none' }}
              value={screen}
              onChange={(v) =>
                navigate(
                  `/editor/${themeId}/preview/${v}${params.size ? `?${params}` : ''}`,
                )
              }
              data={SCREENS.map((s) => ({ value: s, label: controlLabel(s) }))}
            />
            <Text fz={12} c="dimmed" ml={8} style={{ whiteSpace: 'nowrap' }}>
              Force
            </Text>
            <NativeSelect
              size="xs"
              w={130}
              value={force}
              onChange={(e) =>
                setParams(
                  e.currentTarget.value === 'default'
                    ? {}
                    : { state: e.currentTarget.value },
                  { replace: true },
                )
              }
              data={states}
            />
            <div style={{ flex: 1 }} />
            <Switch
              label="Inspect"
              size="xs"
              checked={inspect}
              onChange={(e) => setInspect(e.currentTarget.checked)}
            />
            <Text fz={12} c="dimmed">
              {Math.round(scale * 100)}%
            </Text>
          </Group>
          <div
            style={{
              flex: 1,
              minHeight: 0,
              overflow: 'auto',
              padding: 24,
              display: 'flex',
              justifyContent: 'center',
            }}
          >
            <div
              ref={fit}
              style={{
                width: '100%',
                maxWidth: APP_SIZE.width,
                alignSelf: 'flex-start',
              }}
            >
              <div
                key={screen}
                ref={stage}
                onPointerMove={(e) =>
                  inspect &&
                  setHover((p) => (p?.el === hit(e)?.el ? p : hit(e)))
                }
                onPointerLeave={() => setHover(undefined)}
                onClick={(e) => inspect && setSelected(hit(e))}
                style={{
                  position: 'relative',
                  width: APP_SIZE.width * scale,
                  height: APP_SIZE.height * scale,
                  margin: '0 auto',
                  cursor: inspect ? 'crosshair' : undefined,
                }}
              >
                <div
                  style={{
                    transform: `scale(${scale})`,
                    transformOrigin: 'top left',
                  }}
                >
                  <ForceContext.Provider value={{ target, state: force }}>
                    <GalapaApp screen={screen} />
                  </ForceContext.Provider>
                </div>
                {inspect && box && (
                  <>
                    <div
                      style={{
                        position: 'absolute',
                        ...box,
                        border: `2px solid ${BLUE}`,
                        background: 'rgba(34,139,230,.12)',
                        pointerEvents: 'none',
                      }}
                    />
                    <div
                      style={{
                        position: 'absolute',
                        left: box.left,
                        top: Math.max(0, box.top - 18),
                        padding: '2px 8px',
                        background: BLUE,
                        color: '#fff',
                        fontSize: 11,
                        fontWeight: 600,
                        borderRadius: '4px 4px 0 0',
                        whiteSpace: 'nowrap',
                        pointerEvents: 'none',
                      }}
                    >
                      {label}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </SplitPane>
    </div>
  );
}

function Caption({ children }: { children: ReactNode }) {
  return (
    <Text fz={11} fw={600} c="dimmed" tt="uppercase" lts={0.4}>
      {children}
    </Text>
  );
}

function Inspector({
  target,
  state,
  view,
  themeId,
}: {
  target: Target | undefined;
  state: StateName;
  view: ControlView;
  themeId: string;
}) {
  const ring = useFocusRing();
  const panel = {
    borderLeft: '1px solid var(--mantine-color-default-border)',
    background:
      'light-dark(var(--mantine-color-gray-0), var(--mantine-color-dark-7))',
    minHeight: 0,
    overflow: 'auto',
  } as const;
  if (!target)
    return (
      <div style={panel}>
        <Text p="12px 16px" fw={600}>
          Nothing selected
        </Text>
        <Text px={16} fz={12} c="dimmed">
          Hover the window with Inspect on to see a control; click to pin it.
        </Text>
      </div>
    );
  const Specimen = CONTROLS[target.id]?.Specimen ?? GenericSpecimen;
  return (
    <div style={panel}>
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid var(--mantine-color-default-border)',
        }}
      >
        <Text fw={600}>{controlLabel(target.id)}</Text>
        <Text fz={12} c="dimmed">
          {controlLabel(state)} · {shapeOf(view)}
        </Text>
      </div>
      <Stack gap={12} p={16}>
        <Caption>Isolated</Caption>
        <Island>
          <Specimen view={view} state={state} ring={ring} />
        </Island>
        <Caption>Resolved values</Caption>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'auto 1fr',
            gap: '6px 12px',
            fontSize: 12,
          }}
        >
          {rows(view).map(([k, v], i) => (
            <div key={i} style={{ display: 'contents' }}>
              <span
                style={{
                  color: 'var(--mantine-color-dimmed)',
                  whiteSpace: 'nowrap',
                }}
              >
                {k}
              </span>
              <span
                style={{
                  fontFamily: 'var(--mantine-font-family-monospace)',
                  fontSize: 11,
                  wordBreak: 'break-all',
                }}
              >
                {v}
              </span>
            </div>
          ))}
        </div>
        <Group gap={8} mt={8}>
          <Button
            size="xs"
            component={Link}
            to={`/editor/${themeId}/controls/${target.id}${state === 'default' ? '' : `?state=${state}`}`}
          >
            Edit control
          </Button>
          <Button
            size="xs"
            variant="default"
            component={Link}
            to={`/editor/${themeId}/tokens`}
          >
            Edit tokens
          </Button>
        </Group>
      </Stack>
    </div>
  );
}
