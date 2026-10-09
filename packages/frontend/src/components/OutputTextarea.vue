<script setup lang="ts">
/**
 * OutputTextarea - readonly monospace output area with a floating CopyButton.
 *
 * Emits the global `.qt-output-wrap` / `.qt-output` / `.qt-copy-float` utility
 * classes (see styles/utilities.css). Replaces the repeated `.x__output-wrap`
 * + `.x__output` + `.x__copy` pattern used by tools whose result is text:
 *
 *   <OutputTextarea :value="result" aria-label="Prime number result" />
 */
import CopyButton from '@/components/CopyButton.vue';

withDefaults(
  defineProps<{
    /** Text shown in the readonly area. */
    value: string;
    /** Accessible label for the textarea. */
    ariaLabel?: string;
    /** Minimum height of the textarea. */
    minHeight?: string;
    /** Label for the copy button. */
    copyLabel?: string;
  }>(),
  {
    ariaLabel: 'Output',
    minHeight: '120px',
    copyLabel: 'Copy',
  },
);
</script>

<template>
  <div class="qt-output-wrap">
    <textarea
      class="qt-output"
      readonly
      spellcheck="false"
      :value="value"
      :aria-label="ariaLabel"
      :style="{ minHeight }"
    ></textarea>
    <CopyButton :text="value" :label="copyLabel" class="qt-copy-float" />
  </div>
</template>
