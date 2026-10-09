/**
 * ColorContrastChecker tool module - exports the lazy-loaded component plus
 * its metadata and composable so the tool can be registered in the registry
 * and routed dynamically.
 */
import { defineTool } from '@/tools/defineTool';

const { metadata, component } = defineTool(
  {
    slug: 'color-contrast-checker',
    name: 'Color Contrast Checker',
    description: 'Check WCAG AA/AAA contrast ratio between two colors with pass/fail badges.',
    category: 'a11y',
    icon: 'contrast',
    keywords: ['color', 'contrast', 'wcag', 'aa', 'aaa', 'accessibility', 'ratio', 'luminance'],
    dependencies: [],
  },
  () => import('./ColorContrastChecker.vue'),
);

export { metadata };

export {
  useColorContrastChecker,
  parseColor,
  relativeLuminance,
  contrastRatio,
  evaluateContrast,
  rgbToCss,
} from './useColorContrastChecker';
export type {
  RgbColor,
  ContrastResult,
  UseColorContrastCheckerReturn,
} from './useColorContrastChecker';

export default component;
