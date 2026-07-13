/**
 * WifiQrCodeGenerator tool module — exports the lazy-loaded component plus its
 * metadata and composable so the tool can be registered in the registry and
 * routed dynamically.
 */
import { defineAsyncComponent } from 'vue';
import type { ToolMetadata } from '@q-tools/shared';

export const metadata: ToolMetadata = {
  slug: 'wifi-qr-code-generator',
  name: 'WiFi QR Code generator',
  description: 'Generate QR codes for WiFi network credentials.',
  category: 'media',
  icon: 'wifi',
  keywords: ['wifi', 'qr', 'code', 'network'],
  dependencies: ['qrcode'],
};

export {
  useWifiQrCodeGenerator,
  escapeWifiValue,
  buildWifiString,
  normalizeHexColor,
  clamp,
  generateWifiQrDataUrl,
  generateWifiQrSvg,
  WIFI_ENCRYPTIONS,
  ERROR_CORRECTION_LEVELS,
  DEFAULT_ENCRYPTION,
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
  DEFAULT_WIFI_CONFIG,
} from './useWifiQrCodeGenerator';
export type {
  WifiEncryption,
  WifiEncryptionInfo,
  ErrorCorrectionLevel,
  QrErrorCorrectionInfo,
  QrRenderOptions,
  WifiConfig,
  UseWifiQrCodeGeneratorReturn,
} from './useWifiQrCodeGenerator';

const WifiQrCodeGenerator = defineAsyncComponent(
  () => import('./WifiQrCodeGenerator.vue'),
);

export default WifiQrCodeGenerator;
