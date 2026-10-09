/**
 * SvgOptimizer tool module - exports the lazy-loaded component plus its
 * metadata and composable so the tool can be registered in the registry and
 * routed dynamically.
 */
import { defineAsyncComponent } from 'vue';
import type { ToolMetadata } from '@q-tools/shared';

export const metadata: ToolMetadata = {
  slug: 'svg-optimizer',
  name: 'SVG optimizer',
  description: 'Paste SVG → minified/optimized output (strip metadata, comments, whitespace).',
  category: 'media',
  icon: 'file-code',
  keywords: ['svg', 'optimize', 'minify', 'compress', 'clean', 'markup'],
  dependencies: [],
};

export {
  useSvgOptimizer,
  optimizeSvg,
  looksLikeSvg,
  byteSize,
  savingsPercent,
  DEFAULT_OPTIONS,
} from './useSvgOptimizer';
export type {
  OptimizeOptions,
  UseSvgOptimizerReturn,
} from './useSvgOptimizer';

const SvgOptimizer = defineAsyncComponent(
  () => import('./SvgOptimizer.vue'),
);

export default SvgOptimizer;
