/**
 * Chronometer tool module - exports the lazy-loaded component plus its
 * metadata and composable so the tool can be registered in the registry and
 * routed dynamically.
 *
 * Precision stopwatch with lap timing. Uses `performance.now()` for
 * sub-millisecond accuracy and `requestAnimationFrame` for smooth 60fps
 * display updates. No external dependencies.
 */
import { defineTool } from '@/tools/defineTool';

const { metadata, component } = defineTool(
  {
    slug: 'chronometer',
    name: 'Chronometer',
    description: 'Precision stopwatch with lap timing.',
    category: 'measurement',
    icon: 'timer',
    keywords: ['chronometer', 'stopwatch', 'timer', 'lap'],
    dependencies: [],
  },
  () => import('./Chronometer.vue'),
);

export { metadata };

export {
  useChronometer,
  formatStopwatch,
  formatLapDelta,
} from './useChronometer';
export type {
  Lap,
  UseChronometerReturn,
} from './useChronometer';

export default component;
