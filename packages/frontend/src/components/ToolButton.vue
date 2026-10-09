<script setup lang="ts">
/**
 * ToolButton - shared button styling for tool components.
 *
 * Emits the global `.qt-btn` utility classes (see styles/utilities.css), so
 * `<ToolButton variant="primary">` and `<button class="qt-btn qt-btn--primary">`
 * are interchangeable. Put a lucide icon and a <span> label in the slot:
 *
 *   <ToolButton @click="reset"><RotateCcw :size="14" /><span>Reset</span></ToolButton>
 *   <ToolButton variant="primary" @click="go"><Sparkles :size="14" /><span>Run</span></ToolButton>
 */
withDefaults(
  defineProps<{
    /** Visual variant: ghost (default), primary, outline, or danger. */
    variant?: 'ghost' | 'primary' | 'outline' | 'danger';
    /** Button type attribute. */
    type?: 'button' | 'submit' | 'reset';
    /** Disabled state. */
    disabled?: boolean;
    /** Tooltip / accessible title. */
    title?: string;
  }>(),
  {
    variant: 'ghost',
    type: 'button',
    disabled: false,
    title: undefined,
  },
);
</script>

<template>
  <button
    :type="type"
    class="qt-btn"
    :class="`qt-btn--${variant}`"
    :disabled="disabled"
    :title="title"
  >
    <slot />
  </button>
</template>
