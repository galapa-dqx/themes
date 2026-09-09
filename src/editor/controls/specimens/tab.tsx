/**
 * The tab specimen: main's PartSpecimen:137-149 — `<TabBar items=[Launcher,
 * Settings]>` in a 34px row — one tab per forced state with main's
 * `min-width: 87px`, in the strip it sits in (TitleBar's centre column).
 */
import type { ControlView, FocusRingView } from '@/editor/preview/resolve';
import { TabStrip } from './tabStrip';

export function TabSpecimen({
  view,
  ring,
}: {
  view: ControlView;
  ring: FocusRingView;
}) {
  return (
    <TabStrip
      view={view}
      ring={ring}
      host="titlebar"
      stroke="inset"
      minWidth={87}
      label="Launcher"
    />
  );
}
