/**
 * TimeUnitConverter tool module - exports the lazy-loaded component plus its
 * metadata and composable so the tool can be registered in the registry
 * and routed dynamically.
 *
 * Convert between time units: milliseconds, seconds, minutes, hours, days,
 * weeks, months, years.
 *
 * No external dependencies - pure arithmetic only.
 */
import { defineTool } from '@/tools/defineTool';

const { metadata, component } = defineTool(
  {
    slug: 'time-unit-converter',
    name: 'Time unit converter',
    description: 'Convert between milliseconds, seconds, minutes, hours, days, weeks, months, and years.',
    category: 'measurement',
    icon: 'clock',
    keywords: ['time', 'convert', 'milliseconds', 'seconds', 'minutes', 'hours', 'days', 'weeks', 'months', 'years'],
    dependencies: [],
  },
  () => import('./TimeUnitConverter.vue'),
);

export { metadata };

export {
  useTimeUnitConverter,
  convertTimeUnit,
  TIME_UNITS,
  formatTime,
} from './useTimeUnitConverter';
export type { UseTimeUnitConverterReturn } from './useTimeUnitConverter';

export default component;
