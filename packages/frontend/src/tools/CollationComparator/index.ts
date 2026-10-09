/**
 * CollationComparator tool module.
 */
import { defineTool } from '@/tools/defineTool';

const { metadata, component } = defineTool(
  {
    slug: 'collation-comparator',
    name: 'Collation Comparator',
    description:
      'Compare string sort order across locales via Intl.Collator.',
    category: 'i18n',
    icon: 'arrow-down-up-narrow-wide',
    keywords: ['collation', 'sort', 'compare', 'locale', 'intl', 'collator', 'i18n'],
    dependencies: [],
  },
  () => import('./CollationComparator.vue'),
);

export { metadata };

export {
  useCollationComparator,
  createCollator,
  sortWithCollator,
  compareStrings,
  COMMON_LOCALES,
} from './useCollationComparator';
export type {
  Sensitivity,
  CollatorUsage,
  CollationResult,
  UseCollationComparatorReturn,
} from './useCollationComparator';

export default component;
