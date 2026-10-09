/**
 * TimezoneFromCoordinates tool module.
 *
 * No external dependencies - pure arithmetic only.
 */
import { defineTool } from '@/tools/defineTool';

const { metadata, component } = defineTool(
  {
    slug: 'timezone-from-coordinates',
    name: 'Timezone from Coordinates',
    description: 'Estimate timezone and UTC offset from latitude and longitude coordinates.',
    category: 'geo',
    icon: 'clock',
    keywords: ['timezone', 'coordinates', 'lat', 'lon', 'utc', 'offset', 'estimate', 'longitude'],
    dependencies: [],
  },
  () => import('./TimezoneFromCoordinates.vue'),
);

export { metadata };

export {
  useTimezoneFromCoordinates,
  estimateTimezone,
} from './useTimezoneFromCoordinates';
export type {
  TimezoneResult,
  UseTimezoneFromCoordinatesReturn,
} from './useTimezoneFromCoordinates';

export default component;
