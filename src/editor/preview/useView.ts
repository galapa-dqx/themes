import { createContext, useMemo } from 'react';
import type { RootControlId } from '@/theme/catalog';
import { useProjectStore } from '@/editor/projectStore';
import {
  focusRingOf,
  resolveView,
  type ControlView,
  type FocusRingView,
  type StateName,
} from './resolve';

/** One control resolved for a forced state, recomputed on any document change. */
export function useView(id: RootControlId, state: StateName): ControlView {
  const doc = useProjectStore((s) => s.doc);
  return useMemo(() => resolveView(doc, id, state), [doc, id, state]);
}

export function useFocusRing(): FocusRingView {
  const doc = useProjectStore((s) => s.doc);
  return useMemo(() => focusRingOf(doc), [doc]);
}

/** True while the preview's "Show boxes" switch is on: frames draw their layout and content boxes. */
export const BoxesContext = createContext(false);
