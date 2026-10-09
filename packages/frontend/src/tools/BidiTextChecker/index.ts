/**
 * BidiTextChecker tool module.
 */
import { defineTool } from '@/tools/defineTool';

const { metadata, component } = defineTool(
  {
    slug: 'bidi-text-checker',
    name: 'Bidirectional Text Checker',
    description:
      'Detect and visualize RTL/LTR directionality and BiDi control characters in text.',
    category: 'i18n',
    icon: 'arrow-left-right',
    keywords: ['bidi', 'rtl', 'ltr', 'directionality', 'arabic', 'hebrew', 'i18n'],
    dependencies: [],
  },
  () => import('./BidiTextChecker.vue'),
);

export { metadata };

export {
  useBidiTextChecker,
  analyzeBidi,
  getCharDirection,
  isBidiControl,
  isMirroredChar,
} from './useBidiTextChecker';
export type {
  Direction,
  CharDirectionInfo,
  BidiAnalysisResult,
  UseBidiTextCheckerReturn,
} from './useBidiTextChecker';

export default component;
