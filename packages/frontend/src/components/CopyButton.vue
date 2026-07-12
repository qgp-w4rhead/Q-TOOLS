<script setup lang="ts">
/**
 * CopyButton — reusable copy-to-clipboard button with visual feedback.
 *
 * Copies the `text` prop to the clipboard on click and shows a brief
 * "Copied!" confirmation (checkmark icon + label swap) for `duration` ms.
 * Falls back gracefully when the clipboard API is unavailable — the button
 * shows "Failed" briefly in that case.
 */
import { ref } from 'vue';
import { Check, Copy, X } from 'lucide-vue-next';
import { copyToClipboard } from '@/utils/clipboard';

const props = withDefaults(
  defineProps<{
    /** The text to copy to the clipboard. */
    text: string;
    /** Accessible label for the button. Defaults to "Copy". */
    label?: string;
    /** How long (ms) the "Copied!" feedback stays visible. Default 1500. */
    duration?: number;
    /** Disable the button (e.g. when there is nothing to copy). */
    disabled?: boolean;
    /** Render as a compact icon-only button (no text label). */
    iconOnly?: boolean;
  }>(),
  {
    label: 'Copy',
    duration: 1500,
    disabled: false,
    iconOnly: false,
  },
);

type FeedbackState = 'idle' | 'copied' | 'failed';
const feedback = ref<FeedbackState>('idle');
let timer: ReturnType<typeof setTimeout> | undefined;

async function onClick(): Promise<void> {
  if (props.disabled) return;
  const ok = await copyToClipboard(props.text);
  feedback.value = ok ? 'copied' : 'failed';
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    feedback.value = 'idle';
  }, props.duration);
}
</script>

<template>
  <button
    class="copy-btn"
    :class="[`copy-btn--${feedback}`, { 'copy-btn--icon-only': iconOnly }]"
    type="button"
    :disabled="disabled || !text"
    :aria-label="label"
    @click="onClick"
  >
    <span class="copy-btn__icon" aria-hidden="true">
      <Check v-if="feedback === 'copied'" :size="14" />
      <X v-else-if="feedback === 'failed'" :size="14" />
      <Copy v-else :size="14" />
    </span>
    <span v-if="!iconOnly" class="copy-btn__label">
      <template v-if="feedback === 'copied'">Copied!</template>
      <template v-else-if="feedback === 'failed'">Failed</template>
      <template v-else>{{ label }}</template>
    </span>
  </button>
</template>

<style scoped>
.copy-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  color: var(--qt-text);
  font: inherit;
  font-size: 13px;
  padding: 6px 10px;
  cursor: pointer;
  transition:
    border-color 0.15s ease,
    color 0.15s ease,
    background 0.15s ease;
  will-change: border-color, color;
}
.copy-btn:hover:not(:disabled) {
  border-color: var(--qt-accent-soft);
  color: var(--qt-accent);
}
.copy-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.copy-btn--icon-only {
  padding: 6px;
}
.copy-btn__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.copy-btn--copied {
  border-color: var(--qt-success);
  color: var(--qt-success);
}
.copy-btn--failed {
  border-color: var(--qt-danger);
  color: var(--qt-danger);
}
</style>
