/**
 * UnicodePropertyExplorer tool module.
 */
import { defineTool } from '@/tools/defineTool';

const { metadata, component } = defineTool(
  {
    slug: 'unicode-property-explorer',
    name: 'Unicode Property Explorer',
    description:
      'Inspect code points, categories, scripts, blocks, and normalization forms.',
    category: 'i18n',
    icon: 'binary',
    keywords: ['unicode', 'codepoint', 'script', 'block', 'normalization', 'nfc', 'nfd', 'i18n'],
    dependencies: [],
  },
  () => import('./UnicodePropertyExplorer.vue'),
);

export { metadata };

export {
  useUnicodePropertyExplorer,
  analyzeCodePoint,
  analyzeString,
  getCategory,
  getBlockName,
  getScriptName,
  getCodePointName,
} from './useUnicodePropertyExplorer';
export type {
  CodePointInfo,
  UseUnicodePropertyExplorerReturn,
} from './useUnicodePropertyExplorer';

export default component;
