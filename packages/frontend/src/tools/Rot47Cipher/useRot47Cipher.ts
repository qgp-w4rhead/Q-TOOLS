/**
 * useRot47Cipher - composable + pure logic for the ROT47 cipher tool.
 *
 * A variant of ROT13 that operates on the full printable ASCII range
 * (33–126, 94 characters). Each character is shifted by 47 positions
 * within this range, wrapping around. The cipher is self-inverse.
 *
 *   E(x) = ((x - 33 + 47) mod 94) + 33
 *
 * This covers all ASCII letters (both cases), digits, and common
 * punctuation - making it more versatile than ROT13 which only affects
 * letters.
 *
 * Pure helper (`rot47`) has no Vue dependency. The `useRot47Cipher()`
 * composable wraps it in reactive state and wires up the embed
 * PostMessage protocol.
 *
 * No external dependencies.
 */
import { ref, watch, type Ref } from 'vue';
import { useToolEmbed } from '@/composables/useToolEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Pure logic - no Vue dependency below this point                            */
/* -------------------------------------------------------------------------- */

const ASCII_START = 33; // '!'
const ASCII_END = 126; // '~'
const ASCII_RANGE = ASCII_END - ASCII_START + 1; // 94
const SHIFT = 47;

/**
 * Apply ROT47 to `text`. Each printable ASCII character (33–126) is
 * shifted by 47 positions within the range, wrapping around. Characters
 * outside this range (whitespace, control chars, Unicode) are preserved.
 * The transform is self-inverse.
 */
export function rot47(text: string): string {
  if (!text) return '';
  let out = '';
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code >= ASCII_START && code <= ASCII_END) {
      out += String.fromCharCode(
        ((code - ASCII_START + SHIFT) % ASCII_RANGE) + ASCII_START,
      );
    } else {
      out += text[i]!;
    }
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/* Composable - reactive state + embed integration                            */
/* -------------------------------------------------------------------------- */

/** Debounce window (ms) for recomputing on input changes. */
const DEBOUNCE_MS = 120;

export interface UseRot47CipherReturn {
  input: Ref<string>;
  output: Ref<string>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  recompute: () => void;
  swap: () => void;
}

export function useRot47Cipher(): UseRot47CipherReturn {
  const input = ref<string>('');
  const output = ref<string>('');

  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  function run(): void {
    const text = input.value;
    if (text.length === 0) {
      output.value = '';
      return;
    }
    output.value = rot47(text);
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

  /** Swap direction (feed output back as input - ROT47 is self-inverse). */
  function swap(): void {
    if (output.value) {
      input.value = output.value;
    }
  }

  watch(input, scheduleRun);

  const { isEmbed, input: embedInput } = useToolEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.input === 'string') input.value = p.input;
    },
    output,
    toOutput: () => ({ output: output.value }),
  });

  return {
    input,
    output,
    isEmbed,
    embedInput,
    recompute,
    swap,
  };
}
