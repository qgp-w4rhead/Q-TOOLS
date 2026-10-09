/**
 * QrCodeGenerator tool module - exports the lazy-loaded component plus its
 * metadata and composable so the tool can be registered in the registry and
 * routed dynamically.
 */
import { defineAsyncComponent } from 'vue';
import type { ToolMetadata } from '@q-tools/shared';

export const metadata: ToolMetadata = {
  slug: 'qr-code-generator',
  name: 'QR Code generator',
  description: 'Generate QR codes from text or URLs.',
  category: 'media',
  icon: 'qr-code',
  keywords: ['qr', 'code', 'generate'],
  dependencies: ['qrcode'],
};

export {
  useQrCodeGenerator,
  generateQrDataUrl,
  generateQrSvg,
  generateQrCanvas,
  normalizeHexColor,
  clamp,
  ERROR_CORRECTION_LEVELS,
  DEFAULT_ERROR_CORRECTION,
  DEFAULT_SIZE,
  MIN_SIZE,
  MAX_SIZE,
  DEFAULT_MARGIN,
  MIN_MARGIN,
  MAX_MARGIN,
  DEFAULT_FOREGROUND,
  DEFAULT_BACKGROUND,
  DEFAULT_QR_OPTIONS,
} from './useQrCodeGenerator';
export type {
  ErrorCorrectionLevel,
  QrErrorCorrectionInfo,
  QrRenderOptions,
  UseQrCodeGeneratorReturn,
} from './useQrCodeGenerator';

const QrCodeGenerator = defineAsyncComponent(
  () => import('./QrCodeGenerator.vue'),
);

export default QrCodeGenerator;
