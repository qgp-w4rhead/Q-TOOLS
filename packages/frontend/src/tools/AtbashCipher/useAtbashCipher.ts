/**
 * useAtbashCipher - composable + pure logic for the Atbash cipher tool.
 *
 * A monoalphabetic substitution cipher where each letter is mapped to its
 * reverse in the alphabet: A↔Z, B↔Y, C↔X, …, M↔N. The cipher is its own
 * inverse - applying it twice returns the original text. Only ASCII letters
 * are substituted; case is preserved. All other characters pass through.
 *
 * Pure helper (`atbash`) has no Vue dependency. The `useAtbashCipher()`
 * composable wraps it in reactive state and wires up the embed PostMessage
 * protocol.
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
 * Apply the Atbash cipher to `text`. Each letter is replaced by its
 * alphabet-mirror counterpart (A↔Z, B↔Y, …). Non-letter characters are
 * preserved. Case is preserved. The transform is self-inverse.
 */
export function atbash(text: string): string {
  if (!text) return '';
  let out = '';
  for (const ch of text) {
    const code = ch.charCodeAt(0);
    if (code >= 65 && code <= 90) {
      out += String.fromCharCode(90 - (code - 65));
    } else if (code >= 97 && code <= 122) {
      out += String.fromCharCode(122 - (code - 97));
    } else {
      out += ch;
    }
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/* Composable - reactive state + embed integration                            */
/* -------------------------------------------------------------------------- */

/** Debounce window (ms) for recomputing on input changes. */
const DEBOUNCE_MS = 120;

export interface UseAtbashCipherReturn {
  input: Ref<string>;
  output: Ref<string>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  recompute: () => void;
  swap: () => void;
}

export function useAtbashCipher(): UseAtbashCipherReturn {
  const input = ref<string>('');
  const output = ref<string>('');

  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  function run(): void {
    const text = input.value;
    if (text.length === 0) {
      output.value = '';
      return;
    }
    output.value = atbash(text);
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

  /** Swap direction (feed output back as input - Atbash is self-inverse). */
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
