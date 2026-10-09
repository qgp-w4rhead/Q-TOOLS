/**
 * useApiKeyGenerator — composable + pure logic for generating API keys with
 * configurable prefix, entropy, format, and checksum.
 *
 * No external dependencies.
 */
import { ref, computed, type ComputedRef, type Ref } from 'vue';
import { useToolEmbed } from '@/composables/useToolEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Types                                                                       */
/* -------------------------------------------------------------------------- */

export type KeyFormat = 'hex' | 'base64' | 'base32' | 'base62';

export interface ApiKeyConfig {
  prefix: string;
  length: number;
  format: KeyFormat;
  includeChecksum: boolean;
  count: number;
  separator: string;
}

/* -------------------------------------------------------------------------- */
/* Pure logic                                                                  */
/* -------------------------------------------------------------------------- */

const BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const BASE62_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

function randomBytes(length: number): Uint8Array {
  const arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  return arr;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/=/g, '');
}

function bytesToBase32(bytes: Uint8Array): string {
  let result = '';
  let buffer = 0;
  let bitsLeft = 0;
  for (const b of bytes) {
    buffer = (buffer << 8) | b;
    bitsLeft += 8;
    while (bitsLeft >= 5) {
      result += BASE32_CHARS[(buffer >> (bitsLeft - 5)) & 0x1f];
      bitsLeft -= 5;
    }
  }
  if (bitsLeft > 0) {
    result += BASE32_CHARS[(buffer << (5 - bitsLeft)) & 0x1f];
  }
  return result;
}

function bytesToBase62(bytes: Uint8Array): string {
  let num = 0n;
  for (const b of bytes) num = (num << 8n) | BigInt(b);
  let result = '';
  while (num > 0n) {
    result = BASE62_CHARS[Number(num % 62n)] + result;
    num /= 62n;
  }
  return result || '0';
}

function luhnChecksum(input: string): string {
  let sum = 0;
  let alternate = false;
  for (let i = input.length - 1; i >= 0; i--) {
    let n = input.charCodeAt(i) - 48;
    if (n < 0 || n > 9) n = (input.charCodeAt(i) % 10);
    if (alternate) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alternate = !alternate;
  }
  return String((10 - (sum % 10)) % 10);
}

export function generateApiKey(config: ApiKeyConfig): string {
  const byteLength = Math.ceil(config.length / 2);
  const bytes = randomBytes(byteLength);

  let key: string;
  switch (config.format) {
    case 'hex': key = bytesToHex(bytes); break;
    case 'base64': key = bytesToBase64(bytes); break;
    case 'base32': key = bytesToBase32(bytes); break;
    case 'base62': key = bytesToBase62(bytes); break;
    default: key = bytesToHex(bytes);
  }

  key = key.slice(0, config.length);

  if (config.includeChecksum) {
    key += config.separator + luhnChecksum(key);
  }

  if (config.prefix) {
    key = config.prefix + config.separator + key;
  }

  return key;
}

export function generateMultipleKeys(config: ApiKeyConfig): string[] {
  return Array.from({ length: config.count }, () => generateApiKey(config));
}

/* -------------------------------------------------------------------------- */
/* Composable                                                                  */
/* -------------------------------------------------------------------------- */

export interface UseApiKeyGeneratorReturn {
  config: Ref<ApiKeyConfig>;
  keys: ComputedRef<string[]>;
  reset: () => void;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
}

export function useApiKeyGenerator(): UseApiKeyGeneratorReturn {
  const config = ref<ApiKeyConfig>({
    prefix: 'sk',
    length: 32,
    format: 'hex',
    includeChecksum: true,
    count: 5,
    separator: '_',
  });

  const keys = computed(() => generateMultipleKeys(config.value));

  function reset(): void {
    config.value = {
      prefix: 'sk',
      length: 32,
      format: 'hex',
      includeChecksum: true,
      count: 5,
      separator: '_',
    };
  }

  const { isEmbed, input: embedInput } = useToolEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.prefix === 'string') config.value.prefix = p.prefix;
      if (typeof p.length === 'number') config.value.length = p.length;
    },
    output: keys,
    toOutput: () => ({ keys: keys.value }),
  });

  return { config, keys, reset, isEmbed, embedInput };
}
