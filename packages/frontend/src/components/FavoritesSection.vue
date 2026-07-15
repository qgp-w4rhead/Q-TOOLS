<script setup lang="ts">
/**
 * FavoritesSection — home page section showing the user's starred tools.
 *
 * Renders a compact grid of ToolCards for every active favorite, sorted
 * newest-first. Hidden when there are no favorites. Clicking a card
 * navigates to the tool as usual.
 */
import { computed } from 'vue';
import { Star } from 'lucide-vue-next';
import ToolCard from './ToolCard.vue';
import { TOOLS_BY_SLUG } from '@/data/tools';
import type { ToolMetadata } from '@/data/tools';
import { useFavoritesStore } from '@/stores/favoritesStore';

const favorites = useFavoritesStore();

/** Map favorite slugs to tool metadata, dropping any unknown slugs. */
const favoriteTools = computed<ToolMetadata[]>(() => {
  return favorites.favorites
    .map((entry) => TOOLS_BY_SLUG[entry.toolSlug])
    .filter((t): t is ToolMetadata => !!t);
});
</script>

<template>
  <section v-if="favoriteTools.length > 0" class="favorites-section" id="favorites">
    <header class="favorites-section__header">
      <span class="favorites-section__icon" aria-hidden="true">
        <Star :size="18" fill="currentColor" />
      </span>
      <h2 class="favorites-section__title">Favorites</h2>
      <span class="favorites-section__count">{{ favoriteTools.length }}</span>
    </header>
    <p class="favorites-section__desc">Your starred tools, synced across devices when logged in.</p>
    <div class="favorites-section__grid">
      <ToolCard v-for="tool in favoriteTools" :key="tool.slug" :tool="tool" />
    </div>
  </section>
</template>

<style scoped>
.favorites-section {
  margin-bottom: 32px;
}
.favorites-section__header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 4px;
}
.favorites-section__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--qt-warning);
}
.favorites-section__title {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: var(--qt-text);
}
.favorites-section__count {
  font-size: 12px;
  color: var(--qt-muted);
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: 999px;
  padding: 1px 8px;
}
.favorites-section__desc {
  margin: 0 0 14px;
  color: var(--qt-muted);
  font-size: 13px;
}
.favorites-section__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 12px;
}
</style>
