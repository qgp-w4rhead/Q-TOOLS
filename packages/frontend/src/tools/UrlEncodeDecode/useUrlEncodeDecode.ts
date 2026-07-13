/**
 * useUrlEncodeDecode — composable + pure logic for the URL encode/decode
 * tool.
 *
 * Bidirectional percent-encoding converter with two scopes:
 *
 * - **component** — `encodeURIComponent` / `decodeURIComponent`. Encodes
 *   every character that is not an unreserved character (`A-Za-z0-9-_.!~*'()`).
 *   Use this for query-parameter *values*, path segments, or any single URI
 *   component.
 * - **uri** — `encodeURI` / `decodeURI`. Preserves the reserved URI
 *   characters `;,/?:@&=+$#` so a full URI string keeps its structure. Use
 *   this when you want to encode a complete URL without breaking its
 *   delimiters.
 *
 * Pure helpers (`encodeUrl`, `decodeUrl`) have no Vue dependency and can be
 * imported standalone for unit testing or reuse. The
 * `useUrlEncodeDecode()` composable wraps them in reactive state and wires
 * up the embed PostMessage protocol.
 *
 * No external dependencies — only the native `encodeURIComponent` /
 * `decodeURIComponent` / `encodeURI` / `decodeURI` functions.
 */
import { ref, watch, type Ref } from 'vue';
import { useEmbed } from '@/composables/useEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Pure logic — no Vue dependency below this point                             */
/* -------------------------------------------------------------------------- */

/** Conversion direction. */
export type UrlDirection = 'encode' | 'decode';

/** Encoding scope. */
export type UrlScope = 'component' | 'uri';

/**
 * Encode a string using percent-encoding.
 *
 * `scope = 'component'` uses `encodeURIComponent` (escapes everything except
 * `A-Za-z0-9-_.!~*'()`); `scope = 'uri'` uses `encodeURI` (preserves the
 * reserved URI delimiters `;,/?:@&=+$#`).
 *
 * Returns the percent-encoded string. `encodeURIComponent` / `encodeURI`
 * throw `URIError` on lone surrogate halves (unpaired UTF-16 surrogates);
 * those are surfaced as a thrown error so the caller can present a message.
 */
export function encodeUrl(text: string, scope: UrlScope = 'component'): string {
  if (text.length === 0) return '';
  return scope === 'component'
    ? encodeURIComponent(text)
    : encodeURI(text);
}

/**
 * Decode a percent-encoded string.
 *
 * `scope = 'component'` uses `decodeURIComponent`; `scope = 'uri'` uses
 * `decodeURI`. Returns `null` when the input is not valid percent-encoding
 * (malformed `%` sequences, lone surrogates, etc.).
 */
export function decodeUrl(
  input: string,
  scope: UrlScope = 'component',
): string | null {
  if (typeof input !== 'string') return null;
  if (input.length === 0) return '';
  try {
    return scope === 'component'
      ? decodeURIComponent(input)
      : decodeURI(input);
  } catch {
    return null;
  }
}

/* -------------------------------------------------------------------------- */
/* Composable — reactive state + embed integration                            */
/* -------------------------------------------------------------------------- */

export interface UrlEncodeDecodeOutputs {
  /** The converted value (encoded text when encoding, decoded text when decoding). */
  output: string;
  /** Number of input bytes (UTF-8 byte length). */
  inputBytes: number;
  /** Number of output bytes (UTF-8 byte length). */
  outputBytes: number;
}

export const DEFAULT_DIRECTION: UrlDirection = 'encode';
export const DEFAULT_SCOPE: UrlScope = 'component';

/** Debounce window (ms) for recomputing on input changes. */
const DEBOUNCE_MS = 120;

export interface UseUrlEncodeDecodeReturn {
  input: Ref<string>;
  direction: Ref<UrlDirection>;
  scope: Ref<UrlScope>;
  outputs: Ref<UrlEncodeDecodeOutputs | null>;
  error: Ref<string>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  recompute: () => void;
  setDirection: (d: UrlDirection) => void;
  setScope: (s: UrlScope) => void;
  swap: () => void;
}

export function useUrlEncodeDecode(): UseUrlEncodeDecodeReturn {
  const input = ref<string>('');
  const direction = ref<UrlDirection>(DEFAULT_DIRECTION);
  const scope = ref<UrlScope>(DEFAULT_SCOPE);
  const outputs = ref<UrlEncodeDecodeOutputs | null>(null);
  const error = ref<string>('');

  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  function run(): void {
    const text = input.value;
    if (text.length === 0) {
      outputs.value = null;
      error.value = '';
      return;
    }
    if (direction.value === 'encode') {
      try {
        const out = encodeUrl(text, scope.value);
        outputs.value = {
          output: out,
          inputBytes: new TextEncoder().encode(text).length,
          outputBytes: new TextEncoder().encode(out).length,
        };
        error.value = '';
      } catch {
        outputs.value = null;
        error.value =
          'Input contains lone surrogates that cannot be percent-encoded.';
      }
    } else {
      const out = decodeUrl(text, scope.value);
      if (out === null) {
        outputs.value = null;
        error.value =
          'Invalid percent-encoding. Check for malformed % sequences (e.g. %GG, %2).';
        return;
      }
      outputs.value = {
        output: out,
        inputBytes: new TextEncoder().encode(text).length,
        outputBytes: new TextEncoder().encode(out).length,
      };
      error.value = '';
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

  function setDirection(d: UrlDirection): void {
    direction.value = d;
  }

  function setScope(s: UrlScope): void {
    scope.value = s;
  }

  /** Swap direction and feed the current output back as the new input. */
  function swap(): void {
    if (outputs.value) {
      input.value = outputs.value.output;
    }
    direction.value = direction.value === 'encode' ? 'decode' : 'encode';
  }

  watch(input, scheduleRun);
  watch(direction, scheduleRun);
  watch(scope, scheduleRun);

  const { isEmbed, input: embedInput, sendOutput } = useEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.input === 'string') input.value = p.input;
      if (
        typeof p.direction === 'string' &&
        (p.direction === 'encode' || p.direction === 'decode')
      ) {
        direction.value = p.direction;
      }
      if (
        typeof p.scope === 'string' &&
        (p.scope === 'component' || p.scope === 'uri')
      ) {
        scope.value = p.scope;
      }
    },
  });

  watch(outputs, (o) => {
    if (isEmbed.value) {
      sendOutput(o ?? {});
    }
  });

  return {
    input,
    direction,
    scope,
    outputs,
    error,
    isEmbed,
    embedInput,
    recompute,
    setDirection,
    setScope,
    swap,
  };
}
