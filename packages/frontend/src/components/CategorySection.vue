<script setup lang="ts">
/**
 * Groups a category header with its tool cards in a responsive grid.
 */
import { computed } from 'vue';
import { getIcon } from '@/utils/icons';
import ToolCard from './ToolCard.vue';
import type { CategoryDefinition, ToolMetadata } from '@/data/tools';

const props = defineProps<{
  category: CategoryDefinition;
  tools: ToolMetadata[];
}>();

const Icon = computed(() => getIcon(props.category.icon));
</script>

<template>
  <section class="category-section" :data-category="category.id">
    <header class="category-section__header">
      <span class="category-section__icon" aria-hidden="true">
        <component :is="Icon" :size="18" />
      </span>
      <h2 class="category-section__title">{{ category.label }}</h2>
      <span class="category-section__count">{{ tools.length }}</span>
    </header>
    <p class="category-section__desc">{{ category.description }}</p>
    <div class="category-section__grid">
      <ToolCard v-for="tool in tools" :key="tool.slug" :tool="tool" />
    </div>
  </section>
</template>

<style scoped>
.category-section {
  margin-bottom: 32px;
}
.category-section__header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 4px;
}
.category-section__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--qt-accent);
}
.category-section__title {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: var(--qt-text);
}
.category-section__count {
  font-size: 12px;
  color: var(--qt-muted);
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: 999px;
  padding: 1px 8px;
}
.category-section__desc {
  margin: 0 0 14px;
  color: var(--qt-muted);
  font-size: 13px;
}
.category-section__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 12px;
}
</style>
