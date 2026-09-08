/** The app's Effect runtime: OPFS-backed services, built once at startup. */
import { ManagedRuntime } from 'effect';
import { layerOpfs } from '@/compiler/opfs';

export const runtime = ManagedRuntime.make(layerOpfs);
