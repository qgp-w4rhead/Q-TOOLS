/**
 * VinDecoder tool module - exports the lazy-loaded component plus its
 * metadata and composable so the tool can be registered in the registry
 * and routed dynamically.
 *
 * Decode Vehicle Identification Numbers (17-char) into WMI, VDS, VIS,
 * check digit, model year, and serial number.
 *
 * No external dependencies - pure arithmetic only.
 */
import { defineAsyncComponent } from 'vue';
import type { ToolMetadata } from '@q-tools/shared';

export const metadata: ToolMetadata = {
  slug: 'vin-decoder',
  name: 'VIN decoder',
  description: 'Decode Vehicle Identification Numbers into WMI, VDS, VIS, check digit, model year, and serial number.',
  category: 'data',
  icon: 'car',
  keywords: ['vin', 'vehicle', 'identification', 'number', 'decoder', 'wmi', 'vds', 'vis', 'check', 'digit', 'model', 'year'],
  dependencies: [],
};

export {
  useVinDecoder,
  decodeVin,
  computeCheckDigit,
  resolveModelYear,
  sanitizeVin,
} from './useVinDecoder';
export type {
  VinDecodeResult,
  UseVinDecoderReturn,
} from './useVinDecoder';

const VinDecoder = defineAsyncComponent(
  () => import('./VinDecoder.vue'),
);

export default VinDecoder;
