<script setup lang="ts">
/**
 * CopyButton - reusable copy-to-clipboard button with visual feedback.
 *
 * Emits the global `.qt-btn qt-btn--outline` utility classes (see
 * styles/utilities.css); only the copied/failed feedback colors stay scoped.
 * Copies the `text` prop to the clipboard on click and shows a brief
 * "Copied!" confirmation (checkmark icon + label swap) for `duration` ms.
 * Falls back gracefully when the clipboard API is unavailable - the button
 * shows "Failed" briefly in that case.
 */
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { Check, Copy, X } from 'lucide-vue-next';
import { copyToClipboard } from '@/utils/clipboard';

const props = withDefaults(
  defineProps<{
    /** The text to copy to the clipboard. */
    text: string;
    /** Accessible label for the button (defaults to localized "Copy"). */
    label?: string;
    /** How long (ms) the "Copied!" feedback stays visible. Default 1500. */
    duration?: number;
    /** Disable the button (e.g. when there is nothing to copy). */
    disabled?: boolean;
    /** Render as a compact icon-only button (no text label). */
    iconOnly?: boolean;
  }>(),
  {
    label: undefined,
    duration: 1500,
    disabled: false,
    iconOnly: false,
  },
);

const { t } = useI18n();
const resolvedLabel = computed(() => props.label ?? t('common.copy'));

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
    class="qt-btn qt-btn--outline"
    :class="[`copy-btn--${feedback}`, { 'qt-btn--icon': iconOnly }]"
    type="button"
    :disabled="disabled || !text"
    :aria-label="resolvedLabel"
    @click="onClick"
  >
    <span class="copy-btn__icon" aria-hidden="true">
      <Check v-if="feedback === 'copied'" :size="14" />
      <X v-else-if="feedback === 'failed'" :size="14" />
      <Copy v-else :size="14" />
    </span>
    <span v-if="!iconOnly" class="copy-btn__label">
      <template v-if="feedback === 'copied'">{{ t('common.copiedFeedback') }}</template>
      <template v-else-if="feedback === 'failed'">{{ t('common.failed') }}</template>
      <template v-else>{{ resolvedLabel }}</template>
    </span>
  </button>
</template>

<style scoped>
.copy-btn__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
/* Feedback states override the .qt-btn--outline border/color. */
.copy-btn--copied {
  border-color: var(--qt-success);
  color: var(--qt-success);
}
.copy-btn--failed {
  border-color: var(--qt-danger);
  color: var(--qt-danger);
}
</style>
