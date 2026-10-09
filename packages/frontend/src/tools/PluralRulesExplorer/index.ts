/**
 * PluralRulesExplorer tool module.
 */
import { defineTool } from '@/tools/defineTool';

const { metadata, component } = defineTool(
  {
    slug: 'plural-rules-explorer',
    name: 'Plural Rules Explorer',
    description:
      'Show pluralization categories (one/few/many/other) per locale via Intl.PluralRules.',
    category: 'i18n',
    icon: 'layers',
    keywords: ['plural', 'rules', 'cardinal', 'ordinal', 'locale', 'intl', 'i18n'],
    dependencies: [],
  },
  () => import('./PluralRulesExplorer.vue'),
);

export { metadata };

export {
  usePluralRulesExplorer,
  getPluralCategories,
  selectPlural,
  getSupportedLocales,
  COMMON_LOCALES,
} from './usePluralRulesExplorer';
export type {
  PluralType,
  PluralCategoryResult,
  LocalePluralInfo,
  UsePluralRulesExplorerReturn,
} from './usePluralRulesExplorer';

export default component;
