/**
 * QrCodeReader tool module - exports the lazy-loaded component plus its
 * metadata and composable so the tool can be registered in the registry and
 * routed dynamically.
 */
import { defineAsyncComponent } from 'vue';
import type { ToolMetadata } from '@q-tools/shared';

export const metadata: ToolMetadata = {
  slug: 'qr-code-reader',
  name: 'QR code reader',
  description: 'Decode QR codes and barcodes from an uploaded image.',
  category: 'media',
  icon: 'scan-line',
  keywords: ['qr', 'code', 'read', 'decode', 'scan', 'barcode'],
  dependencies: [],
};

export {
  useQrCodeReader,
  isBarcodeDetectorAvailable,
  listSupportedFormats,
  formatName,
  looksLikeUrl,
} from './useQrCodeReader';
export type {
  DetectedBarcode,
  DecodedCode,
  UseQrCodeReaderReturn,
} from './useQrCodeReader';

const QrCodeReader = defineAsyncComponent(
  () => import('./QrCodeReader.vue'),
);

export default QrCodeReader;
