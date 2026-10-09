/**
 * BaseConverter tool module - exports the lazy-loaded component plus its
 * metadata and composable so the tool can be registered in the registry and
 * routed dynamically.
 */
import { defineAsyncComponent } from 'vue';
import type { ToolMetadata } from '@q-tools/shared';

export const metadata: ToolMetadata = {
  slug: 'integer-base-converter',
  name: 'Integer base converter',
  description: 'Convert integers between bases (2-36).',
  category: 'converter',
  icon: 'binary',
  keywords: ['base', 'binary', 'octal', 'decimal', 'hex'],
  dependencies: [],
};

export {
  useBaseConverter,
  parseBigInt,
  formatBigInt,
  maskToWidth,
  interpretValue,
  validateRange,
  isValidBase,
  computeOutputs,
  MIN_BASE,
  MAX_BASE,
  DIGIT_CHARS,
  STANDARD_BASES,
  BIT_WIDTHS,
  DEFAULT_INPUT_BASE,
  DEFAULT_OUTPUT_BASE,
  DEFAULT_CONFIG,
} from './useBaseConverter';
export type {
  BaseConverterOutputs,
  BaseConverterConfig,
  UseBaseConverterReturn,
} from './useBaseConverter';

const BaseConverter = defineAsyncComponent(
  () => import('./BaseConverter.vue'),
);

export default BaseConverter;
