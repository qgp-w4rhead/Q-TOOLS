<script setup lang="ts" generic="T extends string">
/**
 * SegmentedControl - joined-button mode switcher shared by tool components.
 *
 * Emits the global `.qt-seg` / `.qt-seg__btn` utility classes (see
 * styles/utilities.css). Replaces the repeated `.x__mode` / `.x__mode-btn` /
 * `.x__mode-btn--active` pattern used by multi-mode tools. Generic over the
 * option id type, so a
 * `Ref<'a' | 'b'>` mode binds directly via `v-model`:
 *
 *   <SegmentedControl
 *     v-model="mode"
 *     :options="[
 *       { id: 'check', label: 'Primality check' },
 *       { id: 'range', label: 'Primes in range' },
 *     ]"
 *   />
 */
defineProps<{
  /** Selectable options (stable id + display label). */
  options: Array<{ id: T; label: string }>;
}>();

const model = defineModel<T>({ required: true });
</script>

<template>
  <div class="qt-seg" role="tablist">
    <button
      v-for="opt in options"
      :key="opt.id"
      type="button"
      role="tab"
      class="qt-seg__btn"
      :class="{ 'qt-seg__btn--active': model === opt.id }"
      :aria-selected="model === opt.id"
      @click="model = opt.id"
    >
      {{ opt.label }}
    </button>
  </div>
</template>
