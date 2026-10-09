/**
 * TimezoneDatabase tool module.
 */
import { defineTool } from '@/tools/defineTool';

const { metadata, component } = defineTool(
  {
    slug: 'timezone-database',
    name: 'Timezone Database',
    description:
      'IANA timezone list with offsets, DST info, and search via Intl.supportedValuesOf.',
    category: 'i18n',
    icon: 'clock',
    keywords: ['timezone', 'iana', 'tz', 'offset', 'dst', 'intl', 'i18n'],
    dependencies: [],
  },
  () => import('./TimezoneDatabase.vue'),
);

export { metadata };

export {
  useTimezoneDatabase,
  getSupportedTimezones,
  getTimezoneOffset,
  parseTimezoneId,
  buildTimezoneList,
  filterTimezones,
} from './useTimezoneDatabase';
export type {
  TimezoneInfo,
  UseTimezoneDatabaseReturn,
} from './useTimezoneDatabase';

export default component;
