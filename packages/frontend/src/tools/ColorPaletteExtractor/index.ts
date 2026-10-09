/**
 * ColorPaletteExtractor tool module - exports the lazy-loaded component plus
 * its metadata and composable so the tool can be registered in the registry
 * and routed dynamically.
 */
import { defineAsyncComponent } from 'vue';
import type { ToolMetadata } from '@q-tools/shared';

export const metadata: ToolMetadata = {
  slug: 'color-palette-extractor',
  name: 'Color palette extractor',
  description: 'Extract dominant colors from an image (median-cut), export as HEX/RGB/Tailwind.',
  category: 'media',
  icon: 'palette',
  keywords: ['color', 'palette', 'extract', 'dominant', 'hex', 'rgb', 'tailwind', 'swatch'],
  dependencies: [],
};

export {
  useColorPaletteExtractor,
  rgbToHex,
  rgbToCss,
  rgbToHsl,
  luminance,
  textOn,
  medianCut,
  buildExport,
  EXPORT_FORMATS,
  DEFAULT_COLOR_COUNT,
  MAX_COLOR_COUNT,
  MIN_COLOR_COUNT,
} from './useColorPaletteExtractor';
export type {
  Rgb,
  PaletteColor,
  ExportFormat,
  UseColorPaletteExtractorReturn,
} from './useColorPaletteExtractor';

const ColorPaletteExtractor = defineAsyncComponent(
  () => import('./ColorPaletteExtractor.vue'),
);

export default ColorPaletteExtractor;
