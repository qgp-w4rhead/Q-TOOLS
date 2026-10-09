/**
 * useDuplicateLineRemover - composable + pure logic for the duplicate line
 * remover tool.
 *
 * Removes duplicate lines from text with options for case sensitivity and
 * trimming whitespace before comparison. Reports the number of removed lines.
 *
 * All computations are pure string manipulation - no external dependencies.
 */
import { ref, watch, type Ref } from 'vue';
import { useEmbed } from '@/composables/useEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Types - pure logic (no Vue dependency)                                      */
/* -------------------------------------------------------------------------- */

export interface UseDuplicateLineRemoverReturn {
  input: Ref<string>;
  caseSensitive: Ref<boolean>;
  trimWhitespace: Ref<boolean>;
  output: Ref<string>;
  removedCount: Ref<number>;
  originalCount: Ref<number>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  reset: () => void;
}

/* -------------------------------------------------------------------------- */
/* Pure logic - no Vue dependency below this point                             */
/* -------------------------------------------------------------------------- */

/**
 * Remove duplicate lines from text.
 *
 * Options:
 *   - `caseSensitive` - if false, comparison is case-insensitive
 *   - `trimWhitespace` - if true, lines are trimmed before comparison
 *
 * Returns the deduplicated text and the count of removed lines.
 */
export function removeDuplicateLines(
  input: string,
  caseSensitive: boolean,
  trimWhitespace: boolean,
): { output: string; removed: number; original: number } {
  if (!input) return { output: '', removed: 0, original: 0 };

  const lines = input.split('\n');
  const original = lines.length;
  const seen = new Set<string>();
  const result: string[] = [];

  for (const line of lines) {
    const key = trimWhitespace ? line.trim() : line;
    const compareKey = caseSensitive ? key : key.toLowerCase();

    if (!seen.has(compareKey)) {
      seen.add(compareKey);
      result.push(line);
    }
  }

  return {
    output: result.join('\n'),
    removed: original - result.length,
    original,
  };
}

/* -------------------------------------------------------------------------- */
/* Composable - reactive state + embed integration                             */
/* -------------------------------------------------------------------------- */

export function useDuplicateLineRemover(): UseDuplicateLineRemoverReturn {
  const input = ref<string>('');
  const caseSensitive = ref<boolean>(true);
  const trimWhitespace = ref<boolean>(false);
  const output = ref<string>('');
  const removedCount = ref<number>(0);
  const originalCount = ref<number>(0);

  function recompute(): void {
    const result = removeDuplicateLines(input.value, caseSensitive.value, trimWhitespace.value);
    output.value = result.output;
    removedCount.value = result.removed;
    originalCount.value = result.original;
  }

  function reset(): void {
    input.value = '';
    caseSensitive.value = true;
    trimWhitespace.value = false;
    recompute();
  }

  watch([input, caseSensitive, trimWhitespace], () => {
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
      if (typeof p.caseSensitive === 'boolean') {
        caseSensitive.value = p.caseSensitive;
      }
      if (typeof p.trimWhitespace === 'boolean') {
        trimWhitespace.value = p.trimWhitespace;
      }
    },
  });

  watch(output, () => {
    if (isEmbed.value) {
      sendOutput({
        output: output.value,
        removed: removedCount.value,
        original: originalCount.value,
      });
    }
  });

  return {
    input,
    caseSensitive,
    trimWhitespace,
    output,
    removedCount,
    originalCount,
    isEmbed,
    embedInput,
    reset,
  };
}
