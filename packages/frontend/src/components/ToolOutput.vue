<script setup lang="ts">
/**
 * ToolOutput - reusable labelled output wrapper for tool components.
 *
 * Provides a consistent header (title + optional description + a CopyButton
 * that copies the `copyText` prop) and a content slot for the tool's result.
 * When `copyText` is empty/whitespace the copy button is disabled.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import CopyButton from './CopyButton.vue';

const props = withDefaults(
  defineProps<{
    /** Section title (defaults to localized "Output"). */
    title?: string;
    /** Optional helper text shown under the title. */
    description?: string;
    /** Text to copy when the copy button is clicked. When empty, the button is disabled. */
    copyText?: string;
    /** Label for the copy button (defaults to localized "Copy"). */
    copyLabel?: string;
    /** Hide the copy button entirely (e.g. for non-text output). */
    hideCopy?: boolean;
  }>(),
  {
    title: undefined,
    description: '',
    copyText: '',
    copyLabel: undefined,
    hideCopy: false,
  },
);

const { t } = useI18n();
const resolvedTitle = computed(() => props.title ?? t('common.output'));
const resolvedCopyLabel = computed(() => props.copyLabel ?? t('common.copy'));
</script>

<template>
  <section class="tool-output">
    <header v-if="resolvedTitle || !hideCopy || $slots.actions" class="tool-output__header">
      <div class="tool-output__heading">
        <h2 v-if="resolvedTitle" class="tool-output__title">{{ resolvedTitle }}</h2>
        <p v-if="description" class="tool-output__desc">{{ description }}</p>
      </div>
      <div v-if="!hideCopy || $slots.actions" class="tool-output__actions">
        <slot name="actions" />
        <CopyButton
          v-if="!hideCopy"
          :text="copyText"
          :label="resolvedCopyLabel"
          :disabled="!copyText"
        />
      </div>
    </header>
    <div class="tool-output__body">
      <slot />
    </div>
  </section>
</template>

<style scoped>
.tool-output {
  background: var(--qt-surface);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius);
  padding: var(--qt-gap);
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.tool-output__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}
.tool-output__heading {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.tool-output__title {
  margin: 0;
  font-size: 14px;
  font-weight: 700;
  color: var(--qt-text);
}
.tool-output__desc {
  margin: 0;
  font-size: 12.5px;
  color: var(--qt-muted);
}
.tool-output__actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}
.tool-output__body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
</style>
