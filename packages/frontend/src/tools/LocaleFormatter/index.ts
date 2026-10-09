/**
 * LocaleFormatter tool module.
 */
import { defineTool } from '@/tools/defineTool';

const { metadata, component } = defineTool(
  {
    slug: 'locale-formatter',
    name: 'Locale Formatter',
    description:
      'Preview number, date, currency, list, and relative-time formatting across locales via Intl.',
    category: 'i18n',
    icon: 'calendar',
    keywords: ['locale', 'format', 'number', 'date', 'currency', 'relative', 'intl', 'i18n'],
    dependencies: [],
  },
  () => import('./LocaleFormatter.vue'),
);

export { metadata };

export {
  useLocaleFormatter,
  formatNumber,
  formatCurrency,
  formatDate,
  formatTime,
  formatList,
  formatRelative,
  FORMAT_TYPES,
  COMMON_LOCALES,
  COMMON_CURRENCIES,
} from './useLocaleFormatter';
export type {
  FormatType,
  LocaleFormatResult,
  UseLocaleFormatterReturn,
} from './useLocaleFormatter';

export default component;
