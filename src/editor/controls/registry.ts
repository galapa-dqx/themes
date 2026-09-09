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
import { FocusRingSpecimen } from './specimens/focus-ring';
import { InputSpecimen } from './specimens/input';
import { PanelSpecimen } from './specimens/panel';
import { WindowSpecimen } from './specimens/window';

export type { SpecimenComponent };

export interface ControlModule {
  Specimen: SpecimenComponent;
  /** Rendered after the kind cards, in the same state scope. */
  Fields?: ComponentType<{ id: RootControlId; state: StateName }>;
}

export const CONTROLS: Partial<Record<RootControlId, ControlModule>> = {
  window: { Specimen: WindowSpecimen },
  panel: { Specimen: PanelSpecimen },
  button: { Specimen: ButtonSpecimen },
  input: { Specimen: InputSpecimen },
  'focus-ring': { Specimen: FocusRingSpecimen },
};
