/**
 * CalendarConverter tool module - exports the lazy-loaded component plus
 * its metadata and composable so the tool can be registered in the registry
 * and routed dynamically.
 *
 * Calendar date conversions: Julian Day Number, day of week, day of year,
 * ISO 8601 week number, Julian ↔ Gregorian dates, leap-year check, and
 * JDN → date reverse lookup.
 *
 * No external dependencies - pure integer calendar math.
 */
import { defineTool } from '@/tools/defineTool';

const { metadata, component } = defineTool(
  {
    slug: 'calendar-converter',
    name: 'Calendar converter',
    description: 'Julian Day Number, day of week, day of year, ISO week number, and Julian ↔ Gregorian dates.',
    category: 'measurement',
    icon: 'calendar',
    keywords: ['calendar', 'julian day', 'jdn', 'day of week', 'day of year', 'iso week', 'gregorian', 'julian', 'leap year'],
    dependencies: [],
  },
  () => import('./CalendarConverter.vue'),
);

export { metadata };

export {
  useCalendarConverter,
  isGregorianLeap,
  gregorianToJdn,
  julianToJdn,
  jdnToGregorian,
  jdnToJulian,
  isoWeekNumber,
  dayOfYear,
  parseDateInput,
  computeCalendar,
} from './useCalendarConverter';
export type { CalendarResult, UseCalendarConverterReturn } from './useCalendarConverter';

export default component;
