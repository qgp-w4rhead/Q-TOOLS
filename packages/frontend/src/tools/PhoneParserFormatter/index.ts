/**
 * PhoneParserFormatter tool module - exports the lazy-loaded component plus
 * its metadata and composable so the tool can be registered in the registry
 * and routed dynamically.
 *
 * Parses an arbitrary phone number string into a structured result using the
 * lazy-loaded `libphonenumber-js` package, and produces four canonical
 * formatted outputs (national, international, E.164, RFC 3966 `tel:` URI)
 * plus metadata (country, country calling code, national number, type,
 * validity, possibility, non-geographic flag, extension).
 *
 * Dependencies: `libphonenumber-js` (lazy-loaded, listed in tech-stack.md).
 */
import { defineAsyncComponent } from 'vue';
import type { ToolMetadata } from '@q-tools/shared';

export const metadata: ToolMetadata = {
  slug: 'phone-parser-and-formatter',
  name: 'Phone parser and formatter',
  description:
    'Parse and format international phone numbers into national, international, E.164 and RFC 3966 forms. Shows country, country code, type (mobile/fixed/voip) and validity via libphonenumber-js.',
  category: 'data',
  icon: 'phone',
  keywords: [
    'phone', 'parse', 'format', 'libphonenumber', 'e.164', 'rfc3966',
    'tel', 'international', 'national', 'mobile', 'fixed', 'voip',
    'country', 'calling code',
  ],
  dependencies: ['libphonenumber-js'],
};

export {
  usePhoneParserFormatter,
  loadLibphonenumber,
  resetLibphonenumberCache,
  parsePhone,
  buildResult,
  formatTypeLabel,
  coerceCountry,
  COUNTRY_OPTIONS,
  FORMAT_LABELS,
  FORMAT_ORDER,
} from './usePhoneParserFormatter';
export type {
  DefaultCountry,
  PhoneFormat,
  PhoneTypeLabel,
  FormattedPhone,
  PhoneParseResult,
  CountryOption,
  UsePhoneParserFormatterReturn,
} from './usePhoneParserFormatter';

const PhoneParserFormatter = defineAsyncComponent(
  () => import('./PhoneParserFormatter.vue'),
);

export default PhoneParserFormatter;
