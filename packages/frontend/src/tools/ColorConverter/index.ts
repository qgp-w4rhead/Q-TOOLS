/**
 * ColorConverter tool module - exports the lazy-loaded component plus its
 * metadata and composable so the tool can be registered in the registry
 * and routed dynamically.
 */
import { defineAsyncComponent } from 'vue';
import type { ToolMetadata } from '@q-tools/shared';

export const metadata: ToolMetadata = {
  slug: 'color-converter',
  name: 'Color converter',
  description: 'Convert between HEX, RGB, HSL, HSV, and CMYK color spaces.',
  category: 'converter',
  icon: 'palette',
  keywords: ['color', 'hex', 'rgb', 'hsl', 'hsv', 'cmyk', 'oklch'],
  dependencies: [],
};

export {
  useColorConverter,
  parseColor,
  rgbToHex,
  hexToRgb,
  rgbToHsl,
  hslToRgb,
  rgbToHsv,
  hsvToRgb,
  rgbToCmyk,
  cmykToRgb,
  formatRgb,
  formatHsl,
  formatHsv,
  formatCmyk,
  computeAllFormats,
} from './useColorConverter';
export type {
  Rgb,
  Hsl,
  Hsv,
  Cmyk,
  ColorFormat,
  ParseMode,
  ColorOutputs,
  UseColorConverterReturn,
} from './useColorConverter';

const ColorConverter = defineAsyncComponent(
  () => import('./ColorConverter.vue'),
);

export default ColorConverter;
