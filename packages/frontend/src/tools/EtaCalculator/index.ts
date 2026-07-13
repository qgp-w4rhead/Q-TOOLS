/**
 * EtaCalculator tool module — exports the lazy-loaded component plus its
 * metadata and composable so the tool can be registered in the registry and
 * routed dynamically.
 *
 * The tool estimates remaining time and completion time for a task given its
 * progress and start time. No external dependencies — pure arithmetic +
 * `Date` only.
 */
import { defineAsyncComponent } from 'vue';
import type { ToolMetadata } from '@q-tools/shared';

export const metadata: ToolMetadata = {
  slug: 'eta-calculator',
  name: 'ETA calculator',
  description: 'Estimate arrival time from speed and distance.',
  category: 'math',
  icon: 'clock',
  keywords: ['eta', 'time', 'speed', 'distance'],
  dependencies: [],
};

export {
  useEtaCalculator,
  computeEta,
  parseNumericInput,
  clampNumber,
  formatDuration,
  formatDateTime,
  formatSpeed,
  _datetimeLocal,
} from './useEtaCalculator';
export type {
  EtaMode,
  EtaInput,
  EtaResult,
  UseEtaCalculatorReturn,
} from './useEtaCalculator';

const EtaCalculator = defineAsyncComponent(
  () => import('./EtaCalculator.vue'),
);

export default EtaCalculator;
