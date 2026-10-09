/**
 * LanguageCodeLookup tool module.
 */
import { defineTool } from '@/tools/defineTool';

const { metadata, component } = defineTool(
  {
    slug: 'language-code-lookup',
    name: 'Language Code Lookup',
    description:
      'ISO 639-1 / 639-2 / 639-3 code ↔ language name, bidirectional search.',
    category: 'i18n',
    icon: 'book-open',
    keywords: ['language', 'iso-639', 'code', 'locale', 'lookup', 'i18n'],
    dependencies: [],
  },
  () => import('./LanguageCodeLookup.vue'),
);

export { metadata };

export {
  useLanguageCodeLookup,
  searchLanguages,
  LANGUAGES,
} from './useLanguageCodeLookup';
export type {
  LanguageEntry,
  UseLanguageCodeLookupReturn,
} from './useLanguageCodeLookup';

export default component;
