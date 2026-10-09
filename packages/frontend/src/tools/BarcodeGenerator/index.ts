/**
 * BarcodeGenerator tool module - exports the lazy-loaded component plus its
 * metadata and composable so the tool can be registered in the registry
 * and routed dynamically.
 *
 * Generate CODE128, EAN-13, EAN-8, and UPC-A barcodes with SVG preview.
 *
 * No external dependencies - pure logic only.
 */
import { defineAsyncComponent } from 'vue';
import type { ToolMetadata } from '@q-tools/shared';

export const metadata: ToolMetadata = {
  slug: 'barcode-generator',
  name: 'Barcode generator',
  description: 'Generate CODE128, EAN-13, EAN-8, and UPC-A barcodes with SVG preview.',
  category: 'data',
  icon: 'barcode',
  keywords: ['barcode', 'code128', 'ean13', 'ean8', 'upca', 'upc', 'generate', 'scan', 'product'],
  dependencies: [],
};

export {
  useBarcodeGenerator,
  encodeBarcode,
} from './useBarcodeGenerator';
export type {
  BarcodeType,
  BarcodeEncodeResult,
  UseBarcodeGeneratorReturn,
} from './useBarcodeGenerator';

const BarcodeGenerator = defineAsyncComponent(
  () => import('./BarcodeGenerator.vue'),
);

export default BarcodeGenerator;
