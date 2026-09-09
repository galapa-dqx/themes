/**
 * Session-wide state that outlives any one project: the recent project list.
 * Persisted to localStorage. (Color scheme is Mantine's own persisted
 * setting.) Per-project document state lives in `projectStore`.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface RecentProject {
  readonly id: string;
  readonly name: string;
  readonly lastOpened: number;
}

export interface AppState {
  readonly recent: readonly RecentProject[];
  /** Last picked hex colors, newest first. */
  readonly recentColors: readonly string[];
  pushRecentColor(hex: string): void;
  touchRecent(project: Pick<RecentProject, 'id' | 'name'>): void;
  forgetRecent(id: string): void;
}

const RECENT_LIMIT = 10;

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      recent: [],
      recentColors: [],
      pushRecentColor: (hex) =>
        set((s) => ({
          recentColors: [hex, ...s.recentColors.filter((c) => c !== hex)].slice(
            0,
            8,
          ),
        })),
      touchRecent: ({ id, name }) =>
        set((s) => ({
          recent: [
            { id, name, lastOpened: Date.now() },
            ...s.recent.filter((r) => r.id !== id),
          ].slice(0, RECENT_LIMIT),
        })),
      forgetRecent: (id) =>
        set((s) => ({ recent: s.recent.filter((r) => r.id !== id) })),
    }),
    { name: 'galapa-themes' },
  ),
);
