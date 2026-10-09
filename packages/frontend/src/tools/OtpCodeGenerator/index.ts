/**
 * OtpCodeGenerator tool module - exports the lazy-loaded component plus its
 * metadata and composable so the tool can be registered in the registry and
 * routed dynamically.
 */
import { defineAsyncComponent } from 'vue';
import type { ToolMetadata } from '@q-tools/shared';

export const metadata: ToolMetadata = {
  slug: 'otp-code-generator',
  name: 'OTP code generator',
  description: 'Generate TOTP one-time passwords and QR codes for 2FA apps.',
  category: 'web',
  icon: 'smartphone',
  keywords: ['otp', 'totp', 'hotp', '2fa', 'mfa', 'authenticator', 'rfc6238'],
  dependencies: ['qrcode'],
};

export {
  useOtpCodeGenerator,
  base32Decode,
  base32Encode,
  computeHotp,
  computeTotp,
  hmacBytes,
  dynamicTruncate,
  buildOtpAuthUri,
  generateQrDataUrl,
  totpCounter,
  secondsRemaining,
  ALGORITHMS,
  ALGORITHM_MAP,
  DEFAULT_ALGORITHM,
  DIGIT_OPTIONS,
  DEFAULT_DIGITS,
  PERIOD_OPTIONS,
  DEFAULT_PERIOD,
  DEFAULT_CONFIG,
} from './useOtpCodeGenerator';
export type {
  OtpAlgorithm,
  OtpAlgorithmInfo,
  OtpDigits,
  OtpPeriod,
  OtpAuthUriInput,
  OtpConfig,
  OtpSnapshot,
  UseOtpCodeGeneratorReturn,
} from './useOtpCodeGenerator';

const OtpCodeGenerator = defineAsyncComponent(
  () => import('./OtpCodeGenerator.vue'),
);

export default OtpCodeGenerator;
