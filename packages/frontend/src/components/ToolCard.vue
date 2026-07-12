<script setup lang="ts">
/**
 * Reusable tool card for the home grid.
 *
 * Renders the tool's icon, name, and description. Clicking navigates to the
 * full tool route. Uses GPU-friendly transforms for the hover lift.
 */
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { getIcon } from '@/utils/icons';
import type { ToolMetadata } from '@/data/tools';

const props = defineProps<{ tool: ToolMetadata }>();

const router = useRouter();
const Icon = computed(() => getIcon(props.tool.icon));

function open() {
  router.push({ name: 'tool', params: { slug: props.tool.slug } });
}
</script>

<template>
  <button class="tool-card" type="button" @click="open" :aria-label="`Open ${tool.name}`">
    <span class="tool-card__icon" aria-hidden="true">
      <component :is="Icon" :size="22" />
    </span>
    <span class="tool-card__body">
      <span class="tool-card__name">{{ tool.name }}</span>
      <span class="tool-card__desc">{{ tool.description }}</span>
    </span>
  </button>
</template>

<style scoped>
.tool-card {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  width: 100%;
  text-align: left;
  background: var(--qt-surface);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius);
  padding: 14px;
  color: var(--qt-text);
  cursor: pointer;
  font: inherit;
  transition: transform 0.18s ease, border-color 0.18s ease;
  will-change: transform;
}
.tool-card:hover {
  transform: translateY(-2px);
  border-color: var(--qt-accent-soft);
}
.tool-card:active {
  transform: translateY(0);
}
.tool-card__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  flex: 0 0 38px;
  border-radius: var(--qt-radius-sm);
  background: oklch(from var(--qt-accent) 90% c h);
  color: var(--qt-bg);
}
.tool-card__body {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.tool-card__name {
  font-weight: 600;
  font-size: 14px;
  color: var(--qt-text);
}
.tool-card__desc {
  font-size: 12.5px;
  color: var(--qt-muted);
  line-height: 1.4;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}
</style>
