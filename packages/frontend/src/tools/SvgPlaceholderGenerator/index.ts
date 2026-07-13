/**
 * SvgPlaceholderGenerator tool module — exports the lazy-loaded component plus
 * its metadata and composable so the tool can be registered in the registry
 * and routed dynamically.
 */
import { defineAsyncComponent } from 'vue';
import type { ToolMetadata } from '@q-tools/shared';

export const metadata: ToolMetadata = {
  slug: 'svg-placeholder-generator',
  name: 'SVG placeholder generator',
  description: 'Generate SVG placeholder images with custom dimensions, colors and text.',
  category: 'media',
  icon: 'image',
  keywords: ['svg', 'placeholder', 'image', 'generator'],
  dependencies: [],
};

export {
  useSvgPlaceholderGenerator,
  buildSvgPlaceholder,
  svgToPngDataUrl,
  escapeXml,
  normalizeHexColor,
  clamp,
  defaultPlaceholderText,
  DEFAULT_WIDTH,
  DEFAULT_HEIGHT,
  DEFAULT_BACKGROUND,
  DEFAULT_TEXT_COLOR,
  DEFAULT_FONT_SIZE,
  DEFAULT_TEXT,
  MIN_DIM,
  MAX_DIM,
  MIN_FONT,
  MAX_FONT,
  DEFAULT_PLACEHOLDER_OPTIONS,
} from './useSvgPlaceholderGenerator';
export type {
  SvgPlaceholderOptions,
  UseSvgPlaceholderGeneratorReturn,
} from './useSvgPlaceholderGenerator';

const SvgPlaceholderGenerator = defineAsyncComponent(
  () => import('./SvgPlaceholderGenerator.vue'),
);

export default SvgPlaceholderGenerator;
