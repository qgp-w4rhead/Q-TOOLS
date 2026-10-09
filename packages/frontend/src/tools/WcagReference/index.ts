/**
 * WcagReference tool module.
 */
import { defineTool } from '@/tools/defineTool';

const { metadata, component } = defineTool(
  {
    slug: 'wcag-reference',
    name: 'WCAG Reference',
    description: 'Searchable WCAG 2.2 criteria database (A/AA/AAA levels, principles, guidelines).',
    category: 'a11y',
    icon: 'book-open',
    keywords: ['wcag', 'reference', 'criteria', 'guidelines', 'accessibility', 'level', 'conformance'],
    dependencies: [],
  },
  () => import('./WcagReference.vue'),
);

export { metadata };

export {
  useWcagReference,
  searchCriteria,
  filterByLevel,
  queryCriteria,
} from './useWcagReference';
export type {
  LevelFilter,
  SearchResult,
  UseWcagReferenceReturn,
} from './useWcagReference';

export default component;
