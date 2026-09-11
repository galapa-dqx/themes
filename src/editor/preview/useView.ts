import { createContext, useContext, useMemo } from 'react';
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

/** The mock app's native size (main's console-mode stage) and its screens. */
export const APP_SIZE = { width: 960, height: 600 } as const;
export const SCREENS = ['launcher', 'settings'] as const;
export type Screen = (typeof SCREENS)[number];

/** One instance of a control on the Preview stage, by control and instance key. */
export type Target = { id: RootControlId; key: string };
/** Attributes an instance's root element carries so the stage can hit-test it. */
export type Hit = { 'data-control': RootControlId; 'data-key': string };
/** The Preview page's inspected instance and the state forced on it. */
export const ForceContext = createContext<{
  target?: Target;
  state: StateName;
}>({ state: 'default' });

/**
 * An instance's view: the forced state when it is the inspected target, its
 * own `base` state otherwise (a selected tab, a checked switch).
 */
export function useInstance(
  id: RootControlId,
  key: string,
  base: StateName = 'default',
) {
  const { target, state: forced } = useContext(ForceContext);
  const state = target?.id === id && target.key === key ? forced : base;
  const hit: Hit = { 'data-control': id, 'data-key': key };
  return { view: useView(id, state), state, hit };
}
