<script setup lang="ts">
/**
 * Home page - category grid with global search.
 *
 * Lists every tool grouped by category. The search box filters tools across
 * all categories in real time. The theme toggle lives in the header.
 */
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { Moon, Sun, Wrench } from 'lucide-vue-next';
import CategorySection from '@/components/CategorySection.vue';
import FavoritesSection from '@/components/FavoritesSection.vue';
import GlobalSearch from '@/components/GlobalSearch.vue';
import InstallPrompt from '@/components/InstallPrompt.vue';
import LanguageSwitcher from '@/components/LanguageSwitcher.vue';
import {
  CATEGORIES,
  TOOLS_BY_CATEGORY,
  searchTools,
  type ToolMetadata,
  type CategoryDefinition,
} from '@/data/tools';
import { useSettingsStore } from '@/stores/settingsStore';
import { useFavoritesStore } from '@/stores/favoritesStore';

const { t } = useI18n();
const settings = useSettingsStore();
const favorites = useFavoritesStore();

const query = ref('');

const toolCount = computed(() =>
  Object.values(TOOLS_BY_CATEGORY).reduce((n, tools) => n + tools.length, 0),
);

const filteredTools = computed<ToolMetadata[]>(() => searchTools(query.value));

/** Categories that still have tools after filtering, preserving order. */
const visibleCategories = computed<{ category: CategoryDefinition; tools: ToolMetadata[] }[]>(() => {
  if (!query.value.trim()) {
    return CATEGORIES.map((category) => ({
      category,
      tools: TOOLS_BY_CATEGORY[category.id] ?? [],
    }));
  }
  const matched = filteredTools.value;
  return CATEGORIES.map((category) => ({
    category,
    tools: matched.filter((t) => t.category === category.id),
  })).filter((entry) => entry.tools.length > 0);
});

const matchCount = computed(() => filteredTools.value.length);

/** Show the favorites section only when not filtering by search. */
const showFavorites = computed(() => !query.value.trim() && favorites.count > 0);
</script>

<template>
  <div class="home">
    <header class="home__header">
      <div class="home__brand">
        <Wrench :size="22" />
        <span class="home__brand-name">Q-Tools</span>
      </div>
      <div class="home__actions">
        <LanguageSwitcher />
        <button
          class="home__theme-toggle"
          type="button"
          @click="settings.toggleTheme()"
          :aria-label="settings.isDark ? t('theme.toLight') : t('theme.toDark')"
          :title="settings.isDark ? t('theme.light') : t('theme.dark')"
        >
          <Sun v-if="settings.isDark" :size="18" />
          <Moon v-else :size="18" />
        </button>
      </div>
    </header>

    <section class="home__hero qt-container">
      <h1 class="home__title">{{ t('home.title') }}</h1>
      <p class="home__subtitle">
        {{ t('home.subtitle', { count: toolCount, categories: CATEGORIES.length }) }}
      </p>
      <GlobalSearch v-model:query="query" />
      <p v-if="query.trim()" class="home__match-count">
        {{ t('home.matchCount', { n: matchCount }, matchCount) }}
      </p>
      <InstallPrompt v-if="!query.trim()" />
    </section>

    <main class="qt-container home__main">
      <FavoritesSection v-if="showFavorites" />
      <CategorySection
        v-for="entry in visibleCategories"
        :key="entry.category.id"
        :category="entry.category"
        :tools="entry.tools"
      />
      <p v-if="visibleCategories.length === 0" class="home__empty">
        {{ t('home.empty', { query }) }}
      </p>
    </main>

    <footer class="home__footer">
      <span>{{ t('home.footer') }}</span>
    </footer>
  </div>
</template>

<style scoped>
.home {
  min-height: 100vh;
}
.home__header {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: var(--qt-header-height);
  padding: 0 16px;
  background: var(--qt-surface);
  border-bottom: 1px solid var(--qt-border);
  backdrop-filter: blur(8px);
}
.home__actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.home__brand {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--qt-accent);
  font-weight: 700;
}
.home__brand-name {
  color: var(--qt-text);
}
.home__theme-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: var(--qt-radius-sm);
  border: 1px solid var(--qt-border);
  background: var(--qt-bg);
  color: var(--qt-text);
  cursor: pointer;
  transition: transform 0.15s ease, border-color 0.15s ease;
}
.home__theme-toggle:hover {
  transform: scale(1.05);
  border-color: var(--qt-accent-soft);
}
.home__hero {
  padding-top: 40px;
  padding-bottom: 24px;
  text-align: center;
}
.home__title {
  margin: 0 0 8px;
  font-size: clamp(22px, 4vw, 32px);
  font-weight: 800;
  color: var(--qt-text);
  letter-spacing: -0.02em;
}
.home__subtitle {
  margin: 0 auto 24px;
  max-width: 640px;
  color: var(--qt-muted);
  font-size: 14px;
}
.home__match-count {
  margin: 12px 0 0;
  color: var(--qt-muted);
  font-size: 13px;
}
.home__main {
  padding-top: 8px;
}
.home__empty {
  text-align: center;
  color: var(--qt-muted);
  padding: 40px 0;
}
.home__footer {
  text-align: center;
  color: var(--qt-muted);
  font-size: 12px;
  padding: 24px 0 40px;
}
</style>
