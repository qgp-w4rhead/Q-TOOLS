/**
 * useXorCipher - composable + pure logic for the XOR cipher tool.
 *
 * Simple XOR encryption/decryption with a key string. Each byte of the
 * input is XORed with the corresponding byte of the key (repeated cyclically).
 * XOR is symmetric - the same operation encrypts and decrypts.
 *
 * The output is rendered as hex by default for display, with a UTF-8 decode
 * option for when the result is printable text. Input can be either text
 * (UTF-8 encoded) or hex (0x-prefixed or bare).
 *
 * Pure helpers (`xorBytes`, `xorEncrypt`, `xorDecrypt`) have no Vue
 * dependency. The `useXorCipher()` composable wraps them in reactive state
 * and wires up the embed PostMessage protocol.
 *
 * No external dependencies.
 */
import { ref, watch, type Ref } from 'vue';
import { useToolEmbed } from '@/composables/useToolEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Pure logic - no Vue dependency below this point                            */
/* -------------------------------------------------------------------------- */

/**
 * XOR a `Uint8Array` of data with a key byte array (repeated cyclically).
 * Returns a new `Uint8Array` - does not mutate the input.
 */
export function xorBytes(data: Uint8Array, key: Uint8Array): Uint8Array {
  if (key.length === 0) return data;
  const out = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) {
    out[i] = data[i]! ^ key[i % key.length]!;
  }
  return out;
}

/** Encode a byte array as a hex string (lowercase, no prefix). */
export function bytesToHex(bytes: Uint8Array): string {
  if (bytes.length === 0) return '';
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    out += (bytes[i]! >>> 0).toString(16).padStart(2, '0');
  }
  return out;
}

/** Decode a hex string to a byte array. Returns `null` on invalid hex. */
export function hexToBytes(hex: string): Uint8Array | null {
  const cleaned = hex.replace(/^0x/i, '').replace(/\s+/g, '');
  if (cleaned.length === 0) return new Uint8Array(0);
  if (cleaned.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(cleaned)) return null;
  const out = new Uint8Array(cleaned.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(cleaned.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

/**
 * XOR-encrypt text with a text key. Both are UTF-8 encoded to bytes,
 * XORed, and the result is returned as hex.
 */
export function xorEncrypt(text: string, key: string): string {
  if (!text || !key) return '';
  const data = new TextEncoder().encode(text);
  const keyBytes = new TextEncoder().encode(key);
  const result = xorBytes(data, keyBytes);
  return bytesToHex(result);
}

/**
 * XOR-decrypt hex ciphertext with a text key. The hex is decoded to bytes,
 * XORed with the key, and the result is decoded as UTF-8. Returns `null`
 * on invalid hex or invalid UTF-8.
 */
export function xorDecrypt(hex: string, key: string): string | null {
  if (!hex || !key) return '';
  const cipherBytes = hexToBytes(hex);
  if (cipherBytes === null) return null;
  const keyBytes = new TextEncoder().encode(key);
  const plainBytes = xorBytes(cipherBytes, keyBytes);
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(plainBytes);
  } catch {
    return null;
  }
}

/* -------------------------------------------------------------------------- */
/* Composable - reactive state + embed integration                            */
/* -------------------------------------------------------------------------- */

/** Input format. */
export type XorInputFormat = 'text' | 'hex';

/** Debounce window (ms) for recomputing on input changes. */
const DEBOUNCE_MS = 120;

export interface UseXorCipherReturn {
  input: Ref<string>;
  key: Ref<string>;
  inputFormat: Ref<XorInputFormat>;
  output: Ref<string>;
  error: Ref<string>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  recompute: () => void;
  setInputFormat: (f: XorInputFormat) => void;
  setKey: (k: string) => void;
  swap: () => void;
}

export function useXorCipher(): UseXorCipherReturn {
  const input = ref<string>('');
  const key = ref<string>('');
  const inputFormat = ref<XorInputFormat>('text');
  const output = ref<string>('');
  const error = ref<string>('');

  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  function run(): void {
    const text = input.value;
    const k = key.value;
    if (text.length === 0) {
      output.value = '';
      error.value = '';
      return;
    }
    if (k.length === 0) {
      output.value = '';
      error.value = 'Key must not be empty.';
      return;
    }
    error.value = '';
    if (inputFormat.value === 'text') {
      // Encrypt: text → hex
      output.value = xorEncrypt(text, k);
    } else {
      // Decrypt: hex → text
      const result = xorDecrypt(text, k);
      if (result === null) {
        output.value = '';
        error.value = 'Invalid hex input or non-UTF-8 result. Check the input format and key.';
      } else {
        output.value = result;
      }
    }
  }

  function scheduleRun(): void {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = undefined;
      run();
    }, DEBOUNCE_MS);
  }

  function recompute(): void {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = undefined;
    }
    run();
  }

  function setInputFormat(f: XorInputFormat): void {
    inputFormat.value = f;
  }

  function setKey(k: string): void {
    key.value = k;
  }

  /** Swap direction and feed the output back as input. */
  function swap(): void {
    if (output.value) {
      input.value = output.value;
    }
    inputFormat.value = inputFormat.value === 'text' ? 'hex' : 'text';
  }

  watch(input, scheduleRun);
  watch(key, scheduleRun);
  watch(inputFormat, scheduleRun);

  const { isEmbed, input: embedInput } = useToolEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.input === 'string') input.value = p.input;
      if (typeof p.key === 'string') key.value = p.key;
      if (typeof p.inputFormat === 'string' && (p.inputFormat === 'text' || p.inputFormat === 'hex')) {
        inputFormat.value = p.inputFormat;
      }
    },
    output,
    toOutput: () => ({ output: output.value, inputFormat: inputFormat.value }),
  });

  return {
    input,
    key,
    inputFormat,
    output,
    error,
    isEmbed,
    embedInput,
    recompute,
    setInputFormat,
    setKey,
    swap,
  };
}
