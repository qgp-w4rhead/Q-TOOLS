<script setup lang="ts">
/**
 * FavoriteButton — star toggle for a tool.
 *
 * Uses the global `favoritesStore` so the star state is shared across
 * the home page, tool header, and embed alias. In embed mode the store
 * still works (LocalStorage-backed); backend sync simply no-ops when
 * the user is not authenticated.
 */
import { computed } from 'vue';
import { Star } from 'lucide-vue-next';
import { useFavoritesStore } from '@/stores/favoritesStore';

const props = withDefaults(
  defineProps<{
    slug: string;
    /** Optional label/alias stored with the favorite. */
    label?: string;
    /** Icon size in pixels (lucide convention). */
    size?: number;
    /** Visual variant — `icon` (header icon button) or `chip` (label row). */
    variant?: 'icon' | 'chip';
  }>(),
  {
    size: 16,
    variant: 'icon',
  },
);

const favorites = useFavoritesStore();

const isFav = computed(() => favorites.isFavorite(props.slug));

function toggle() {
  favorites.toggle(props.slug, props.label);
}
</script>

<template>
  <button
    v-if="variant === 'icon'"
    class="fav-btn fav-btn--icon"
    :class="{ 'is-active': isFav }"
    type="button"
    :aria-pressed="isFav"
    :title="isFav ? 'Remove from favorites' : 'Add to favorites'"
    :aria-label="isFav ? 'Remove from favorites' : 'Add to favorites'"
    @click="toggle"
  >
    <Star :size="size" :fill="isFav ? 'currentColor' : 'none'" />
  </button>
  <button
    v-else
    class="fav-btn fav-btn--chip"
    :class="{ 'is-active': isFav }"
    type="button"
    :aria-pressed="isFav"
    @click="toggle"
  >
    <Star :size="size" :fill="isFav ? 'currentColor' : 'none'" />
    <span>{{ isFav ? 'Favorited' : 'Favorite' }}</span>
  </button>
</template>

<style scoped>
.fav-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border-radius: var(--qt-radius-sm);
  background: var(--qt-bg);
  color: var(--qt-text);
  cursor: pointer;
  font: inherit;
  transition: color 0.15s ease, border-color 0.15s ease, transform 0.15s ease;
}
.fav-btn--icon {
  width: 32px;
  height: 32px;
  border: 1px solid var(--qt-border);
}
.fav-btn--icon:hover {
  border-color: var(--qt-accent-soft);
  transform: scale(1.05);
}
.fav-btn--chip {
  padding: 6px 12px;
  border: 1px solid var(--qt-border);
  font-size: 13px;
}
.fav-btn--chip:hover {
  border-color: var(--qt-accent-soft);
}
.fav-btn.is-active {
  color: var(--qt-warning);
  border-color: var(--qt-accent-soft);
}
</style>
