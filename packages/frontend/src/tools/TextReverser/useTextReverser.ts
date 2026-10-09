/**
 * useTextReverser - composable + pure logic for the text reverser tool.
 *
 * Three modes:
 *   - **chars** - reverse the entire string character by character
 *   - **words** - reverse the order of words (keeping each word intact)
 *   - **lines** - reverse the order of lines
 *
 * All computations are pure string manipulation - no external dependencies.
 */
import { ref, watch, type Ref } from 'vue';
import { useEmbed } from '@/composables/useEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Types - pure logic (no Vue dependency)                                      */
/* -------------------------------------------------------------------------- */

export type ReverseMode = 'chars' | 'words' | 'lines';

export interface UseTextReverserReturn {
  input: Ref<string>;
  mode: Ref<ReverseMode>;
  output: Ref<string>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  reset: () => void;
}

/* -------------------------------------------------------------------------- */
/* Pure logic - no Vue dependency below this point                             */
/* -------------------------------------------------------------------------- */

/**
 * Reverse text according to the specified mode.
 *
 * - **chars**: reverse the entire string character by character
 * - **words**: reverse the order of words, preserving whitespace between them
 * - **lines**: reverse the order of lines
 */
export function reverseText(input: string, mode: ReverseMode): string {
  if (!input) return '';

  if (mode === 'chars') {
    // Use spread to handle multi-byte characters correctly
    return [...input].reverse().join('');
  }

  if (mode === 'words') {
    // Split by whitespace, reverse, rejoin with single spaces
    return input.split(/\s+/).filter((w) => w.length > 0).reverse().join(' ');
  }

  // lines
  const lines = input.split('\n');
  return lines.reverse().join('\n');
}

/* -------------------------------------------------------------------------- */
/* Composable - reactive state + embed integration                             */
/* -------------------------------------------------------------------------- */

export function useTextReverser(): UseTextReverserReturn {
  const input = ref<string>('Hello World\nQ-Tools is awesome');
  const mode = ref<ReverseMode>('chars');
  const output = ref<string>('');

  function recompute(): void {
    output.value = reverseText(input.value, mode.value);
  }

  function reset(): void {
    input.value = '';
    mode.value = 'chars';
    recompute();
  }

  watch([input, mode], () => {
    recompute();
  });

  recompute();

  const { isEmbed, input: embedInput, sendOutput } = useEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.input === 'string') {
        input.value = p.input;
      } else if (typeof p.value === 'string') {
        input.value = p.value;
      }
      if (p.mode === 'chars' || p.mode === 'words' || p.mode === 'lines') {
        mode.value = p.mode as ReverseMode;
      }
    },
  });

  watch(output, () => {
    if (isEmbed.value) {
      sendOutput({ output: output.value, mode: mode.value });
    }
  });

  return {
    input,
    mode,
    output,
    isEmbed,
    embedInput,
    reset,
  };
}
