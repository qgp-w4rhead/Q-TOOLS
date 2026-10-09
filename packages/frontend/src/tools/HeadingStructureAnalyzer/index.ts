/**
 * HeadingStructureAnalyzer tool module.
 */
import { defineTool } from '@/tools/defineTool';

const { metadata, component } = defineTool(
  {
    slug: 'heading-structure-analyzer',
    name: 'Heading Structure Analyzer',
    description: 'Paste HTML to see heading hierarchy tree with skipped-level warnings.',
    category: 'a11y',
    icon: 'heading',
    keywords: ['heading', 'structure', 'hierarchy', 'h1', 'h2', 'h3', 'accessibility', 'outline'],
    dependencies: [],
  },
  () => import('./HeadingStructureAnalyzer.vue'),
);

export { metadata };

export {
  useHeadingStructureAnalyzer,
  parseHeadings,
  buildHeadingTree,
  analyzeHeadings,
} from './useHeadingStructureAnalyzer';
export type {
  HeadingNode,
  HeadingAnalysis,
  UseHeadingStructureAnalyzerReturn,
} from './useHeadingStructureAnalyzer';

export default component;
