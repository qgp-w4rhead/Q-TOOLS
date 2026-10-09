<script setup lang="ts">
/**
 * ResultRow - labelled result/stat card with an icon-only CopyButton.
 *
 * Emits the global `.qt-result` / `.qt-label` / `.qt-stat-head` / `.qt-value`
 * utility classes (see styles/utilities.css). Replaces the repeated
 * `.x__result-row` / `.x__stat` pattern used by calculator-style tools:
 *
 *   <ResultRow label="GCD" :value="gcdResult" size="lg" />
 *   <ResultRow label="Elapsed" :value="elapsedText" :icon="Timer" uppercase />
 *
 * The copy button is hidden when the resolved copy text is empty or '-'
 * (the codebase's "no result" sentinel).
 */
import { computed, type Component } from 'vue';
import CopyButton from '@/components/CopyButton.vue';

const props = withDefaults(
  defineProps<{
    /** Small label above the value. */
    label: string;
    /** Displayed result value. */
    value: string;
    /** Optional lucide icon shown before the label. */
    icon?: Component;
    /** Uppercase label styling (stat-card look). */
    uppercase?: boolean;
    /** Value font size: lg (24px), md (18px), sm (13.5px). */
    size?: 'sm' | 'md' | 'lg';
    /** Override the copied text (defaults to `value`). */
    copyText?: string;
  }>(),
  {
    icon: undefined,
    uppercase: false,
    size: 'md',
    copyText: undefined,
  },
);

const resolvedCopy = computed(() => props.copyText ?? props.value);
const showCopy = computed(
  () => resolvedCopy.value !== '' && resolvedCopy.value !== '-',
);
</script>

<template>
  <div class="qt-result">
    <span :class="uppercase ? 'qt-stat-head' : 'qt-label'">
      <component :is="icon" v-if="icon" :size="13" />
      <span>{{ label }}</span>
    </span>
    <div class="qt-row qt-row--center qt-row--nowrap">
      <span class="qt-value" :class="`qt-value--${size}`">{{ value }}</span>
      <CopyButton
        v-if="showCopy"
        :text="resolvedCopy"
        label="Copy"
        icon-only
      />
    </div>
  </div>
</template>
