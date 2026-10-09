/**
 * useToolEmbed - shared embed wiring for tool composables.
 *
 * Nearly every `useX.ts` ends with the same tail:
 *
 *   const { isEmbed, input: embedInput, sendOutput } = useEmbed({
 *     onInput: (payload) => { ... },
 *   });
 *   watch(result, () => {
 *     if (isEmbed.value) sendOutput({ ... });
 *   });
 *
 * This helper collapses that into one call:
 *
 *   const { isEmbed, input: embedInput } = useToolEmbed({
 *     onInput: (p) => { ... },
 *     output: [gcdResult, lcmResult],
 *     toOutput: () => ({ gcd: gcdResult.value, lcm: lcmResult.value }),
 *   });
 *
 * `sendOutput` is already a no-op outside embed mode, but the watch callback
 * still checks `isEmbed` first to avoid building the payload needlessly.
 */
import { watch, type WatchSource } from 'vue';
import { useEmbed, type UseEmbedOptions, type UseEmbedReturn } from './useEmbed';
import type { EmbedInputPayload, EmbedOutputPayload } from '@q-tools/shared';

export interface UseToolEmbedOptions extends UseEmbedOptions {
  /**
   * Reactive source(s) to watch. Whenever they change, `toOutput()` is
   * evaluated and sent to the parent (embed mode only).
   */
  output: WatchSource | WatchSource[];
  /** Build the `output` PostMessage payload from current state. */
  toOutput: () => EmbedOutputPayload;
}

export function useToolEmbed(options: UseToolEmbedOptions): UseEmbedReturn {
  const { output, toOutput, ...embedOptions } = options;

  const embed = useEmbed({
    ...embedOptions,
    onInput: (payload: EmbedInputPayload) => options.onInput?.(payload),
  });

  watch(output, () => {
    if (embed.isEmbed.value) {
      embed.sendOutput(toOutput());
    }
  });

  return embed;
}
