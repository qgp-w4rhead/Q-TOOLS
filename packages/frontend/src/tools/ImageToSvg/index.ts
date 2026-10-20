/**
 * ImageToSvg tool module - exports the lazy-loaded component plus its
 * metadata and composable so the tool can be registered in the registry and
 * routed dynamically.
 */
import { defineAsyncComponent } from 'vue';
import type { ToolMetadata } from '@q-tools/shared';

export const metadata: ToolMetadata = {
  slug: 'image-to-svg',
  name: 'Image to SVG vectorizer',
  description: 'Trace a raster image into vector SVG paths that scale to any size.',
  category: 'media',
  icon: 'pen-tool',
  keywords: ['image', 'svg', 'vector', 'vectorize', 'trace', 'tracing', 'upscale', 'paths', 'logo'],
  dependencies: ['imagetracerjs'],
};

export {
  useImageToSvg,
  buildTraceOptions,
  countTracedPaths,
  detailToError,
  fitWithin,
  injectViewBox,
  traceImage,
  TRACE_PRESETS,
  TRACE_SIZES,
  OUTPUT_SCALES,
  PNG_SCALES,
  DEFAULT_PRESET,
  DEFAULT_COLORS,
  DEFAULT_DETAIL,
  DEFAULT_NOISE,
  DEFAULT_SMOOTHING,
  DEFAULT_TRACE_SIZE,
  DEFAULT_OUTPUT_SCALE,
  DEFAULT_PNG_SCALE,
} from './useImageToSvg';
export type {
  TracePreset,
  TraceControls,
  VectorizedInfo,
  UseImageToSvgReturn,
} from './useImageToSvg';

const ImageToSvg = defineAsyncComponent(
  () => import('./ImageToSvg.vue'),
);

export default ImageToSvg;
