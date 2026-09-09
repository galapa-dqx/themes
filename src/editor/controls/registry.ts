/**
 * Per-control modules: a faithful specimen for the preview panel and, when a
 * control needs rows the kind cards don't cover, extra fields. Filled in one
 * port at a time; a control without an entry gets the generic specimen.
 */
import type { ComponentType } from 'react';
import type { RootControlId } from '@/theme/catalog';
import type { SpecimenComponent } from '@/editor/preview/Island';
import type { StateName } from '@/editor/preview/resolve';
import { ButtonSpecimen } from './specimens/button';
import { CarouselSpecimen } from './specimens/carousel';
import { FocusRingSpecimen } from './specimens/focus-ring';
import { InputSpecimen } from './specimens/input';
import { NewsItemSpecimen } from './specimens/news-item';
import { PanelSpecimen } from './specimens/panel';
import { PlayRowSpecimen } from './specimens/play-row';
import { ProgressSpecimen, ProgressFields } from './specimens/progress';
import { ScrollbarSpecimen, ScrollbarFields } from './specimens/scrollbar';
import { SettingHelpSpecimen } from './specimens/setting-help';
import { SettingRowSpecimen, SettingRowFields } from './specimens/setting-row';
import { SettingsSpecimen } from './specimens/settings';
import { SubtabSpecimen } from './specimens/subtab';
import { SubtabsSpecimen } from './specimens/subtabs';
import { SwitchSpecimen, SwitchFields } from './specimens/switch';
import { TabSpecimen } from './specimens/tab';
import { TabBarSpecimen, TabBarFields } from './specimens/tab-bar';
import { TitlebarSpecimen, TitlebarFields } from './specimens/titlebar';
import { WindowSpecimen } from './specimens/window';

export type { SpecimenComponent };

export interface ControlModule {
  Specimen: SpecimenComponent;
  /** Rendered after the kind cards, in the same state scope. */
  Fields?: ComponentType<{ id: RootControlId; state: StateName }>;
  /** Minimum width of a state cell in the preview grid (default 150). */
  cellWidth?: number;
}

export const CONTROLS: Partial<Record<RootControlId, ControlModule>> = {
  window: { Specimen: WindowSpecimen },
  panel: { Specimen: PanelSpecimen },
  button: { Specimen: ButtonSpecimen },
  carousel: { Specimen: CarouselSpecimen, cellWidth: 260 },
  input: { Specimen: InputSpecimen },
  'news-item': { Specimen: NewsItemSpecimen, cellWidth: 320 },
  tab: { Specimen: TabSpecimen },
  subtab: { Specimen: SubtabSpecimen },
  'tab-bar': { Specimen: TabBarSpecimen, Fields: TabBarFields },
  subtabs: { Specimen: SubtabsSpecimen },
  switch: { Specimen: SwitchSpecimen, Fields: SwitchFields },
  progress: { Specimen: ProgressSpecimen, Fields: ProgressFields },
  scrollbar: {
    Specimen: ScrollbarSpecimen,
    Fields: ScrollbarFields,
    cellWidth: 220,
  },
  'setting-row': {
    Specimen: SettingRowSpecimen,
    Fields: SettingRowFields,
    cellWidth: 300,
  },
  'setting-help': { Specimen: SettingHelpSpecimen },
  settings: { Specimen: SettingsSpecimen },
  titlebar: {
    Specimen: TitlebarSpecimen,
    Fields: TitlebarFields,
    cellWidth: 320,
  },
  'focus-ring': { Specimen: FocusRingSpecimen },
  'play-row': { Specimen: PlayRowSpecimen },
};
