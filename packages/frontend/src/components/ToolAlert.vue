<script setup lang="ts">
/**
 * ToolAlert - inline error/empty/warn/note/success line for tool output.
 *
 * Emits the global `.qt-alert` utility classes (see styles/utilities.css), so
 * `<ToolAlert kind="error">` and `<p class="qt-alert qt-alert--error">` are
 * interchangeable. Replaces the repeated `.x__error` / `.x__empty` paragraphs:
 *
 *   <ToolAlert v-if="hasError" kind="error">{{ snapshot?.message }}</ToolAlert>
 *   <ToolAlert v-else-if="isEmpty" kind="empty">Enter values to compute.</ToolAlert>
 */
import { AlertCircle } from 'lucide-vue-next';

withDefaults(
  defineProps<{
    /** Alert tone: error (danger + icon), empty/note (muted), warn, success. */
    kind?: 'error' | 'empty' | 'warn' | 'note' | 'success';
  }>(),
  {
    kind: 'empty',
  },
);
</script>

<template>
  <p class="qt-alert" :class="`qt-alert--${kind}`">
    <AlertCircle v-if="kind === 'error'" :size="14" />
    <span><slot /></span>
  </p>
</template>
