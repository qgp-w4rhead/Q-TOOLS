/**
 * ScreenReaderTextGenerator tool module.
 */
import { defineTool } from '@/tools/defineTool';

const { metadata, component } = defineTool(
  {
    slug: 'screen-reader-text-generator',
    name: 'Screen Reader Text Generator',
    description: 'Generate visually-hidden / sr-only text and aria-live region markup.',
    category: 'a11y',
    icon: 'volume-2',
    keywords: ['screen', 'reader', 'sr-only', 'visually-hidden', 'aria-live', 'accessibility', 'announce'],
    dependencies: [],
  },
  () => import('./ScreenReaderTextGenerator.vue'),
);

export { metadata };

export {
  useScreenReaderTextGenerator,
  buildSrOnlyCss,
  buildSrOnlyHtml,
  buildAriaLiveHtml,
} from './useScreenReaderTextGenerator';
export type {
  OutputType,
  AriaLivePoliteness,
  SrConfig,
  UseScreenReaderTextGeneratorReturn,
} from './useScreenReaderTextGenerator';

export default component;
