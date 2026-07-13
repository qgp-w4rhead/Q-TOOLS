/**
 * useBasicAuthGenerator — composable + pure logic for the HTTP Basic auth
 * header generator tool.
 *
 * Builds an `Authorization: Basic <base64>` header from a username + password
 * pair. The base64 encoding is UTF-8 safe: the credentials string is encoded
 * with `TextEncoder` to its UTF-8 byte sequence, then converted to a binary
 * string and run through `btoa`. This avoids the Latin-1 limitation of the
 * naive `btoa(username + ':' + password)` call which throws on any character
 * outside the U+0000–U+00FF range (e.g. emojis, CJK, accented letters above
 * U+00FF).
 *
 * Pure helpers (`encodeBasicAuth`, `buildAuthHeader`, `bytesToBase64`) have no
 * Vue dependency and can be imported standalone for unit testing or reuse. The
 * `useBasicAuthGenerator()` composable wraps them in reactive state and wires
 * up the embed PostMessage protocol.
 *
 * No external dependencies — only the native `btoa` / `TextEncoder` APIs.
 */
import { ref, watch, type Ref } from 'vue';
import { useEmbed } from '@/composables/useEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Pure logic — no Vue dependency below this point                             */
/* -------------------------------------------------------------------------- */

/**
 * Encode a `Uint8Array` to a standard-alphabet base64 string.
 *
 * Converts each byte to a Latin-1 character code and feeds the resulting
 * binary string to `btoa`. Works for arbitrary byte lengths (including
 * multi-byte UTF-8 sequences) because every byte is in the 0–255 range.
 */
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.length;
  // Chunk to avoid call-stack limits on very large inputs.
  const CHUNK = 0x8000;
  for (let i = 0; i < len; i += CHUNK) {
    binary += String.fromCharCode.apply(
      null,
      bytes.subarray(i, i + CHUNK) as unknown as number[],
    );
  }
  return btoa(binary);
}

/**
 * Base64-encode a `username:password` credentials pair using UTF-8.
 *
 * Returns the base64 token (without the `Basic ` prefix). An empty pair
 * (`username === '' && password === ''`) returns an empty string so the UI can
 * show a "enter credentials" placeholder rather than a meaningless `Og==`
 * (which is what `btoa(':')` produces).
 *
 * @example
 *   encodeBasicAuth('admin', 's3cr3t') // → 'YWRtaW46czNjcjN0'
 *   encodeBasicAuth('user', 'päss')    // → 'dXNlcjpw5MOkcw==' (UTF-8 safe)
 */
export function encodeBasicAuth(username: string, password: string): string {
  if (username.length === 0 && password.length === 0) return '';
  const credentials = `${username}:${password}`;
  const bytes = new TextEncoder().encode(credentials);
  return bytesToBase64(bytes);
}

/** Result of `buildAuthHeader`. */
export interface BasicAuthHeader {
  /** The full header line, e.g. `Authorization: Basic YWRtaW46czNjcjN0`. */
  header: string;
  /** The base64 token only, e.g. `YWRtaW46czNjcjN0`. */
  token: string;
  /** The raw credentials string, e.g. `admin:s3cr3t`. */
  credentials: string;
}

/**
 * Build the full `Authorization: Basic <base64>` header line from a username
 * and password. Returns `null` when both inputs are empty (nothing to encode).
 */
export function buildAuthHeader(
  username: string,
  password: string,
): BasicAuthHeader | null {
  const token = encodeBasicAuth(username, password);
  if (token.length === 0) return null;
  const credentials = `${username}:${password}`;
  return {
    header: `Authorization: Basic ${token}`,
    token,
    credentials,
  };
}

/* -------------------------------------------------------------------------- */
/* Composable — reactive state + embed integration                            */
/* -------------------------------------------------------------------------- */

export interface UseBasicAuthGeneratorReturn {
  username: Ref<string>;
  password: Ref<string>;
  showPassword: Ref<boolean>;
  result: Ref<BasicAuthHeader | null>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  toggleShowPassword: () => void;
}

export function useBasicAuthGenerator(): UseBasicAuthGeneratorReturn {
  const username = ref<string>('');
  const password = ref<string>('');
  const showPassword = ref<boolean>(false);
  const result = ref<BasicAuthHeader | null>(null);

  function recompute(): void {
    result.value = buildAuthHeader(username.value, password.value);
  }

  function toggleShowPassword(): void {
    showPassword.value = !showPassword.value;
  }

  watch([username, password], recompute, { immediate: true });

  const { isEmbed, input: embedInput, sendOutput } = useEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.username === 'string') username.value = p.username;
      if (typeof p.password === 'string') password.value = p.password;
      if (typeof p.showPassword === 'boolean') showPassword.value = p.showPassword;
    },
  });

  watch(result, (r) => {
    if (isEmbed.value) {
      sendOutput(r ?? {});
    }
  });

  return {
    username,
    password,
    showPassword,
    result,
    isEmbed,
    embedInput,
    toggleShowPassword,
  };
}
