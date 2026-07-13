/**
 * DateTimeConverter tool module — exports the lazy-loaded component plus its
 * metadata and composable so the tool can be registered in the registry and
 * routed dynamically.
 */
import { defineAsyncComponent } from 'vue';
import type { ToolMetadata } from '@q-tools/shared';

export const metadata: ToolMetadata = {
  slug: 'date-time-converter',
  name: 'Date-time converter',
  description: 'Convert between date-time formats and timezones.',
  category: 'converter',
  icon: 'calendar',
  keywords: ['date', 'time', 'unix', 'iso', 'rfc2822', 'timezone'],
  dependencies: [],
};

export {
  useDateTimeConverter,
  parseInput,
  parseIso,
  parseUnixSeconds,
  parseUnixMs,
  parseRfc2822,
  parseCustomFormat,
  tryAutoParse,
  formatIso,
  formatUnixSeconds,
  formatUnixMs,
  formatRfc2822,
  formatCustom,
  formatRelative,
  getZonedParts,
  normaliseOffsetString,
  parseOffsetString,
  tokeniseFormat,
  listTimezones,
  isValidDate,
  computeOutputs,
  INPUT_FORMATS,
  TOKEN_DEFS,
  DEFAULT_INPUT_CUSTOM_FORMAT,
  DEFAULT_OUTPUT_CUSTOM_FORMAT,
  DEFAULT_TIMEZONE,
  DEFAULT_CONFIG,
} from './useDateTimeConverter';
export type {
  InputFormat,
  FormatPart,
  DateTimeOutputs,
  DateTimeConverterConfig,
  UseDateTimeConverterReturn,
} from './useDateTimeConverter';

const DateTimeConverter = defineAsyncComponent(
  () => import('./DateTimeConverter.vue'),
);

export default DateTimeConverter;
