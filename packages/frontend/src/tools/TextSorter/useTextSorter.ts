/**
 * useTextSorter - composable + pure logic for the text sorter tool.
 *
 * Sorts lines of text by various criteria:
 *   - **alpha** - alphabetical (case-sensitive or insensitive)
 *   - **numeric** - numeric (parses leading number from each line)
 *   - **length** - by line length
 *
 * Supports ascending/descending order.
 *
 * All computations are pure string manipulation - no external dependencies.
 */
import { ref, watch, type Ref } from 'vue';
import { useEmbed } from '@/composables/useEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Types - pure logic (no Vue dependency)                                      */
/* -------------------------------------------------------------------------- */

export type SortMode = 'alpha' | 'numeric' | 'length';

export interface UseTextSorterReturn {
  input: Ref<string>;
  mode: Ref<SortMode>;
  descending: Ref<boolean>;
  caseSensitive: Ref<boolean>;
  output: Ref<string>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  reset: () => void;
}

/* -------------------------------------------------------------------------- */
/* Pure logic - no Vue dependency below this point                             */
/* -------------------------------------------------------------------------- */

/**
 * Sort lines of text according to the specified mode and options.
 */
export function sortLines(
  input: string,
  mode: SortMode,
  descending: boolean,
  caseSensitive: boolean,
): string {
  if (!input) return '';

  const lines = input.split('\n');

  const sorted = [...lines].sort((a, b) => {
    let cmp = 0;

    if (mode === 'alpha') {
      const aa = caseSensitive ? a : a.toLowerCase();
      const bb = caseSensitive ? b : b.toLowerCase();
      cmp = aa < bb ? -1 : aa > bb ? 1 : 0;
    } else if (mode === 'numeric') {
      const na = parseFloat(a.trim()) || 0;
      const nb = parseFloat(b.trim()) || 0;
      cmp = na - nb;
    } else {
      // length
      cmp = a.length - b.length;
    }

    return descending ? -cmp : cmp;
  });

  return sorted.join('\n');
}

/* -------------------------------------------------------------------------- */
/* Composable - reactive state + embed integration                             */
/* -------------------------------------------------------------------------- */

export function useTextSorter(): UseTextSorterReturn {
  const input = ref<string>('banana\napple\ncherry\ndate\nelderberry');
  const mode = ref<SortMode>('alpha');
  const descending = ref<boolean>(false);
  const caseSensitive = ref<boolean>(false);
  const output = ref<string>('');

  function recompute(): void {
    output.value = sortLines(input.value, mode.value, descending.value, caseSensitive.value);
  }

  function reset(): void {
    input.value = '';
    mode.value = 'alpha';
    descending.value = false;
    caseSensitive.value = false;
    recompute();
  }

  watch([input, mode, descending, caseSensitive], () => {
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
      if (p.mode === 'alpha' || p.mode === 'numeric' || p.mode === 'length') {
        mode.value = p.mode as SortMode;
      }
      if (typeof p.descending === 'boolean') {
        descending.value = p.descending;
      }
      if (typeof p.caseSensitive === 'boolean') {
        caseSensitive.value = p.caseSensitive;
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
    descending,
    caseSensitive,
    output,
    isEmbed,
    embedInput,
    reset,
  };
}
