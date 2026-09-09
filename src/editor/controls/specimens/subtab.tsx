/**
 * The subtab specimen: main's PartSpecimen:150-164 — `<TabBar
 * items=[Graphics, Sound, Controls] size="sm">` in a 34px row — one tab per
 * forced state with the sm override's `min-width: 0`, on the Settings header
 * strip (`.SubTabs`, painted by the `subtabs` control) instead of main's bare
 * island, where the selected underline had nothing to read against.
 */
import type { ControlView, FocusRingView } from '@/editor/preview/resolve';
import { TabStrip } from './tabStrip';

export function SubtabSpecimen({
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
      host="subtabs"
      stroke="border"
      minWidth={0}
      label="Graphics"
    />
  );
}
