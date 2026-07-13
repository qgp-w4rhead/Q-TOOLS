/**
 * Chronometer tool module — exports the lazy-loaded component plus its
 * metadata and composable so the tool can be registered in the registry and
 * routed dynamically.
 *
 * Precision stopwatch with lap timing. Uses `performance.now()` for
 * sub-millisecond accuracy and `requestAnimationFrame` for smooth 60fps
 * display updates. No external dependencies.
 */
import { defineAsyncComponent } from 'vue';
import type { ToolMetadata } from '@q-tools/shared';

export const metadata: ToolMetadata = {
  slug: 'chronometer',
  name: 'Chronometer',
  description: 'Precision stopwatch with lap timing.',
  category: 'measurement',
  icon: 'timer',
  keywords: ['chronometer', 'stopwatch', 'timer', 'lap'],
  dependencies: [],
};

export {
  useChronometer,
  formatStopwatch,
  formatLapDelta,
} from './useChronometer';
export type {
  Lap,
  UseChronometerReturn,
} from './useChronometer';

const Chronometer = defineAsyncComponent(
  () => import('./Chronometer.vue'),
);

export default Chronometer;
