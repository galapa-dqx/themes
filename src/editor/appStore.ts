/**
 * Session-wide state that outlives any one project: settings and the recent
 * project list. Persisted to localStorage. Per-project document state lives
 * in `projectStore`.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface RecentProject {
  readonly id: string;
  readonly name: string;
  readonly lastOpened: number;
}

export interface AppState {
  readonly settings: { readonly colorScheme: 'light' | 'dark' };
  readonly recent: readonly RecentProject[];
  setSettings(patch: Partial<AppState['settings']>): void;
  touchRecent(project: Pick<RecentProject, 'id' | 'name'>): void;
  forgetRecent(id: string): void;
}

const RECENT_LIMIT = 10;

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      settings: { colorScheme: 'light' },
      recent: [],
      setSettings: (patch) =>
        set((s) => ({ settings: { ...s.settings, ...patch } })),
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
