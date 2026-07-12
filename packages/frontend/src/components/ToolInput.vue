<script setup lang="ts">
/**
 * ToolInput — reusable labelled input wrapper for tool components.
 *
 * Provides a consistent header (title + optional description + optional
 * actions slot) and a content slot for the tool's input controls. Pure
 * presentational wrapper — no logic.
 */
withDefaults(
  defineProps<{
    /** Section title (e.g. "Input"). */
    title?: string;
    /** Optional helper text shown under the title. */
    description?: string;
  }>(),
  {
    title: 'Input',
    description: '',
  },
);
</script>

<template>
  <section class="tool-input">
    <header v-if="title || $slots.actions" class="tool-input__header">
      <div class="tool-input__heading">
        <h2 v-if="title" class="tool-input__title">{{ title }}</h2>
        <p v-if="description" class="tool-input__desc">{{ description }}</p>
      </div>
      <div v-if="$slots.actions" class="tool-input__actions">
        <slot name="actions" />
      </div>
    </header>
    <div class="tool-input__body">
      <slot />
    </div>
  </section>
</template>

<style scoped>
.tool-input {
  background: var(--qt-surface);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius);
  padding: var(--qt-gap);
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.tool-input__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}
.tool-input__heading {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.tool-input__title {
  margin: 0;
  font-size: 14px;
  font-weight: 700;
  color: var(--qt-text);
}
.tool-input__desc {
  margin: 0;
  font-size: 12.5px;
  color: var(--qt-muted);
}
.tool-input__actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}
.tool-input__body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
</style>
