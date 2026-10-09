/**
 * useWifiQrCodeGenerator - composable + pure logic for the WiFi QR Code
 * generator tool.
 *
 * Builds a WiFi-network configuration string in the de-facto standard format
 *   `WIFI:T:<encryption>;S:<ssid>;P:<password>;H:<true|false>;;`
 * that mobile OS camera apps recognise and use to auto-join a network when the
 * QR code is scanned. The string is then rendered as a QR code (PNG data URL +
 * SVG string) via the `qrcode` package.
 *
 * Pure helpers (`escapeWifiValue`, `buildWifiString`, `normalizeHexColor`,
 * `clamp`, `generateWifiQrDataUrl`, `generateWifiQrSvg`) have no Vue dependency
 * and can be imported standalone for unit testing or reuse. The
 * `useWifiQrCodeGenerator()` composable wraps them in reactive state and wires
 * up the embed PostMessage protocol.
 *
 * Uses the `qrcode` package (initial bundle, statically imported per
 * tech-stack.md). No other external dependencies.
 */
import { ref, watch, type Ref } from 'vue';
import QRCode from 'qrcode';
import { useEmbed } from '@/composables/useEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Types + constants                                                           */
/* -------------------------------------------------------------------------- */

/** WiFi encryption modes supported by the WiFi QR format. */
export type WifiEncryption = 'WPA' | 'WEP' | 'None';

export interface WifiEncryptionInfo {
  value: WifiEncryption;
  label: string;
  /** Token emitted in the `T:` field of the WiFi string. */
  token: string;
  description: string;
}

export const WIFI_ENCRYPTIONS: WifiEncryptionInfo[] = [
  {
    value: 'WPA',
    label: 'WPA/WPA2/WPA3',
    token: 'WPA',
    description: 'Most common modern WiFi encryption.',
  },
  {
    value: 'WEP',
    label: 'WEP',
    token: 'WEP',
    description: 'Legacy encryption - avoid if possible.',
  },
  {
    value: 'None',
    label: 'No password',
    token: 'nopass',
    description: 'Open network with no authentication.',
  },
];

export const DEFAULT_ENCRYPTION: WifiEncryption = 'WPA';

/** QR error correction levels per the QR Code 2005 spec. */
export type ErrorCorrectionLevel = 'L' | 'M' | 'Q' | 'H';

export interface QrErrorCorrectionInfo {
  value: ErrorCorrectionLevel;
  label: string;
  /** Approximate data capacity recovery ratio. */
  recovery: string;
}

export const ERROR_CORRECTION_LEVELS: QrErrorCorrectionInfo[] = [
  { value: 'L', label: 'Low', recovery: '~7%' },
  { value: 'M', label: 'Medium', recovery: '~15%' },
  { value: 'Q', label: 'Quartile', recovery: '~25%' },
  { value: 'H', label: 'High', recovery: '~30%' },
];

export const DEFAULT_ERROR_CORRECTION: ErrorCorrectionLevel = 'M';

export const DEFAULT_SIZE = 256;
export const MIN_SIZE = 64;
export const MAX_SIZE = 2048;

export const DEFAULT_MARGIN = 4;
export const MIN_MARGIN = 0;
export const MAX_MARGIN = 20;

export const DEFAULT_FOREGROUND = '#000000';
export const DEFAULT_BACKGROUND = '#ffffff';

/** Full set of options accepted by the QR renderer. */
export interface QrRenderOptions {
  size: number;
  errorCorrectionLevel: ErrorCorrectionLevel;
  margin: number;
  foreground: string;
  background: string;
}

export const DEFAULT_QR_OPTIONS: QrRenderOptions = {
  size: DEFAULT_SIZE,
  errorCorrectionLevel: DEFAULT_ERROR_CORRECTION,
  margin: DEFAULT_MARGIN,
  foreground: DEFAULT_FOREGROUND,
  background: DEFAULT_BACKGROUND,
};

/** Inputs that define a WiFi network for the QR string. */
export interface WifiConfig {
  ssid: string;
  password: string;
  encryption: WifiEncryption;
  hidden: boolean;
}

export const DEFAULT_WIFI_CONFIG: WifiConfig = {
  ssid: '',
  password: '',
  encryption: DEFAULT_ENCRYPTION,
  hidden: false,
};

/* -------------------------------------------------------------------------- */
/* Pure logic - no Vue dependency below this point                             */
/* -------------------------------------------------------------------------- */

/**
 * Escape a WiFi field value per the WiFi QR spec. The characters `\`, `;`,
 * `,`, `:`, and `"` have special meaning in the WiFi string and must be
 * backslash-escaped so they don't prematurely terminate a field.
 */
export function escapeWifiValue(value: string): string {
  return value.replace(/([\\;,":])/g, '\\$1');
}

/**
 * Build the WiFi QR configuration string.
 *
 * Format: `WIFI:T:<encryption>;S:<ssid>;P:<password>;H:<true|false>;;`
 *
 * - For the `None` (open) encryption, the `T:` field is `nopass` and the `P:`
 *   field is omitted (per common implementations; iOS/Android camera apps
 *   accept either form, but the canonical open-network form omits `P:`).
 * - The `H:` field is only emitted when the network is hidden. When false it
 *   is omitted to keep the string compact (scanners default to false).
 * - SSID and password are escaped via `escapeWifiValue`.
 *
 * Returns the empty string when the SSID is empty (a WiFi QR without an SSID
 * is meaningless and most scanners will reject it).
 */
export function buildWifiString(config: WifiConfig): string {
  const ssid = config.ssid ?? '';
  if (ssid.trim().length === 0) return '';

  const enc = WIFI_ENCRYPTIONS.find((e) => e.value === config.encryption);
  const token = enc ? enc.token : 'WPA';
  const isOpen = config.encryption === 'None';

  const parts: string[] = ['WIFI:'];
  parts.push(`T:${token};`);
  parts.push(`S:${escapeWifiValue(ssid)};`);
  if (!isOpen) {
    parts.push(`P:${escapeWifiValue(config.password ?? '')};`);
  }
  if (config.hidden) {
    parts.push('H:true;');
  }
  parts.push(';');
  return parts.join('');
}

/** Normalise a CSS hex color string to `#RRGGBB` (lowercase). */
export function normalizeHexColor(input: string, fallback: string): string {
  const trimmed = input.trim();
  if (!trimmed) return fallback;
  const stripped = trimmed.startsWith('#') ? trimmed.slice(1) : trimmed;
  if (/^[0-9a-fA-F]{6}$/.test(stripped)) return `#${stripped.toLowerCase()}`;
  if (/^[0-9a-fA-F]{3}$/.test(stripped)) {
    const expanded = stripped
      .split('')
      .map((c) => c + c)
      .join('')
      .toLowerCase();
    return `#${expanded}`;
  }
  return fallback;
}

/** Clamp a number to the `[min, max]` range. */
export function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function buildQrOptions(opts: QrRenderOptions): QRCode.QRCodeRenderersOptions {
  return {
    width: opts.size,
    margin: opts.margin,
    errorCorrectionLevel: opts.errorCorrectionLevel,
    color: {
      dark: normalizeHexColor(opts.foreground, DEFAULT_FOREGROUND),
      light: normalizeHexColor(opts.background, DEFAULT_BACKGROUND),
    },
  };
}

/** Render `text` as a PNG data URL via the `qrcode` package. */
export async function generateWifiQrDataUrl(
  text: string,
  opts: QrRenderOptions,
): Promise<string> {
  const data = text ?? '';
  if (data.length === 0) {
    throw new Error('WiFi string is empty - provide an SSID.');
  }
  return QRCode.toDataURL(data, buildQrOptions(opts));
}

/** Render `text` as an SVG string via the `qrcode` package. */
export async function generateWifiQrSvg(
  text: string,
  opts: QrRenderOptions,
): Promise<string> {
  const data = text ?? '';
  if (data.length === 0) {
    throw new Error('WiFi string is empty - provide an SSID.');
  }
  return QRCode.toString(data, {
    ...buildQrOptions(opts),
    type: 'svg',
  });
}

/* -------------------------------------------------------------------------- */
/* Composable - reactive state + embed integration                            */
/* -------------------------------------------------------------------------- */

export interface UseWifiQrCodeGeneratorReturn {
  ssid: Ref<string>;
  password: Ref<string>;
  encryption: Ref<WifiEncryption>;
  hidden: Ref<boolean>;
  size: Ref<number>;
  errorCorrectionLevel: Ref<ErrorCorrectionLevel>;
  margin: Ref<number>;
  foreground: Ref<string>;
  background: Ref<string>;
  wifiString: Ref<string>;
  pngDataUrl: Ref<string>;
  svgString: Ref<string>;
  error: Ref<string | null>;
  computing: Ref<boolean>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
}

export function useWifiQrCodeGenerator(): UseWifiQrCodeGeneratorReturn {
  const ssid = ref<string>('');
  const password = ref<string>('');
  const encryption = ref<WifiEncryption>(DEFAULT_ENCRYPTION);
  const hidden = ref<boolean>(false);

  const size = ref<number>(DEFAULT_SIZE);
  const errorCorrectionLevel = ref<ErrorCorrectionLevel>(DEFAULT_ERROR_CORRECTION);
  const margin = ref<number>(DEFAULT_MARGIN);
  const foreground = ref<string>(DEFAULT_FOREGROUND);
  const background = ref<string>(DEFAULT_BACKGROUND);

  const wifiString = ref<string>('');
  const pngDataUrl = ref<string>('');
  const svgString = ref<string>('');
  const error = ref<string | null>(null);
  const computing = ref<boolean>(false);

  let renderToken = 0;

  async function recompute(): Promise<void> {
    const cfg: WifiConfig = {
      ssid: ssid.value,
      password: password.value,
      encryption: encryption.value,
      hidden: hidden.value,
    };
    const built = buildWifiString(cfg);
    wifiString.value = built;

    if (built.length === 0) {
      pngDataUrl.value = '';
      svgString.value = '';
      error.value = null;
      computing.value = false;
      return;
    }
    const token = ++renderToken;
    computing.value = true;
    const opts: QrRenderOptions = {
      size: clamp(Math.round(size.value), MIN_SIZE, MAX_SIZE),
      errorCorrectionLevel: errorCorrectionLevel.value,
      margin: clamp(Math.round(margin.value), MIN_MARGIN, MAX_MARGIN),
      foreground: foreground.value,
      background: background.value,
    };
    try {
      const [png, svg] = await Promise.all([
        generateWifiQrDataUrl(built, opts),
        generateWifiQrSvg(built, opts),
      ]);
      if (token !== renderToken) return;
      pngDataUrl.value = png;
      svgString.value = svg;
      error.value = null;
    } catch (err) {
      if (token !== renderToken) return;
      pngDataUrl.value = '';
      svgString.value = '';
      error.value = (err as Error).message || 'Failed to generate WiFi QR code.';
    } finally {
      if (token === renderToken) computing.value = false;
    }
  }

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  function scheduleRecompute(): void {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      void recompute();
    }, 150);
  }

  watch(
    [ssid, password, encryption, hidden, size, errorCorrectionLevel, margin, foreground, background],
    scheduleRecompute,
    { immediate: true },
  );

  const { isEmbed, input: embedInput, sendOutput } = useEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.ssid === 'string') ssid.value = p.ssid;
      if (typeof p.password === 'string') password.value = p.password;
      if (
        typeof p.encryption === 'string' &&
        (p.encryption === 'WPA' || p.encryption === 'WEP' || p.encryption === 'None')
      ) {
        encryption.value = p.encryption;
      }
      if (typeof p.hidden === 'boolean') hidden.value = p.hidden;
      if (typeof p.size === 'number') size.value = p.size;
      if (typeof p.margin === 'number') margin.value = p.margin;
      if (
        typeof p.errorCorrectionLevel === 'string' &&
        (p.errorCorrectionLevel === 'L' ||
          p.errorCorrectionLevel === 'M' ||
          p.errorCorrectionLevel === 'Q' ||
          p.errorCorrectionLevel === 'H')
      ) {
        errorCorrectionLevel.value = p.errorCorrectionLevel;
      }
      if (typeof p.foreground === 'string') foreground.value = p.foreground;
      if (typeof p.background === 'string') background.value = p.background;
    },
  });

  watch([wifiString, pngDataUrl, svgString, error], () => {
    if (!isEmbed.value) return;
    sendOutput({
      wifiString: wifiString.value || undefined,
      pngDataUrl: pngDataUrl.value || undefined,
      svgString: svgString.value || undefined,
      ssid: ssid.value,
      encryption: encryption.value,
      hidden: hidden.value,
      size: size.value,
      errorCorrectionLevel: errorCorrectionLevel.value,
      margin: margin.value,
      foreground: foreground.value,
      background: background.value,
      error: error.value ?? undefined,
    });
  });

  return {
    ssid,
    password,
    encryption,
    hidden,
    size,
    errorCorrectionLevel,
    margin,
    foreground,
    background,
    wifiString,
    pngDataUrl,
    svgString,
    error,
    computing,
    isEmbed,
    embedInput,
  };
}
