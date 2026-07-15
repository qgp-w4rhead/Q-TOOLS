<script setup lang="ts">
/**
 * Full app layout for `/tools/:slug`.
 *
 * Renders a sidebar (category navigation), a header (back link, theme toggle,
 * embed link), and the active tool via `<router-view>`. When `?embed=1` is
 * present, renders chromeless (delegates to the embed view styling).
 *
 * The actual tool component is injected by the child route (`tool-view` →
 * ToolPlaceholder until tools are implemented in M1+).
 */
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ArrowLeft, Moon, Sun, ExternalLink, Home } from 'lucide-vue-next';
import {
  CATEGORIES,
  TOOLS_BY_CATEGORY,
  getToolBySlug,
} from '@/data/tools';
import { useSettingsStore } from '@/stores/settingsStore';
import FavoriteButton from '@/components/FavoriteButton.vue';

const route = useRoute();
const router = useRouter();
const settings = useSettingsStore();

const slug = computed(() => (route.params.slug as string | undefined) ?? '');
const tool = computed(() => getToolBySlug(slug.value));
const isEmbedAlias = computed(() => route.query.embed === '1' || route.query.embed === 'true');

function goHome() {
  router.push({ name: 'home' });
}
function openEmbed() {
  if (slug.value) {
    window.open(`/embed/tools/${slug.value}`, '_blank', 'noopener');
  }
}
</script>

<template>
  <div class="tool-layout" :class="{ 'tool-layout--embed': isEmbedAlias }">
    <template v-if="!isEmbedAlias">
      <aside class="tool-layout__sidebar">
        <button class="tool-layout__brand" type="button" @click="goHome">
          <Home :size="16" />
          <span>Q-Tools</span>
        </button>
        <nav class="tool-layout__nav" aria-label="Categories">
          <button
            v-for="cat in CATEGORIES"
            :key="cat.id"
            type="button"
            class="tool-layout__nav-item"
            :class="{ 'is-active': tool?.category === cat.id }"
            @click="router.push({ name: 'home', hash: `#category-${cat.id}` })"
          >
            <span>{{ cat.label }}</span>
            <span class="tool-layout__nav-count">{{ TOOLS_BY_CATEGORY[cat.id]?.length ?? 0 }}</span>
          </button>
        </nav>
      </aside>

      <div class="tool-layout__main">
        <header class="tool-layout__header">
          <button class="tool-layout__back" type="button" @click="goHome">
            <ArrowLeft :size="16" />
            <span>Back</span>
          </button>
          <h1 class="tool-layout__title">{{ tool?.name ?? 'Tool' }}</h1>
          <div class="tool-layout__actions">
            <FavoriteButton
              v-if="slug"
              :slug="slug"
              :label="tool?.name"
            />
            <button
              class="tool-layout__icon-btn"
              type="button"
              @click="openEmbed"
              title="Open embed view"
              aria-label="Open embed view"
            >
              <ExternalLink :size="16" />
            </button>
            <button
              class="tool-layout__icon-btn"
              type="button"
              @click="settings.toggleTheme()"
              :aria-label="settings.isDark ? 'Light mode' : 'Dark mode'"
            >
              <Sun v-if="settings.isDark" :size="16" />
              <Moon v-else :size="16" />
            </button>
          </div>
        </header>
        <main class="tool-layout__content">
          <router-view />
        </main>
      </div>
    </template>

    <!-- embed=1 alias: chromeless -->
    <main v-else class="tool-layout__chromeless">
      <router-view />
    </main>
  </div>
</template>

<style scoped>
.tool-layout {
  display: flex;
  min-height: 100vh;
}
.tool-layout__sidebar {
  position: sticky;
  top: 0;
  align-self: flex-start;
  width: var(--qt-sidebar-width);
  height: 100vh;
  flex: 0 0 var(--qt-sidebar-width);
  background: var(--qt-surface);
  border-right: 1px solid var(--qt-border);
  padding: 16px 12px;
  overflow-y: auto;
}
.tool-layout__brand {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  background: transparent;
  border: none;
  color: var(--qt-accent);
  font-weight: 700;
  font-size: 15px;
  cursor: pointer;
  padding: 8px 10px;
  margin-bottom: 12px;
  border-radius: var(--qt-radius-sm);
}
.tool-layout__brand:hover {
  background: var(--qt-bg);
}
.tool-layout__nav {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.tool-layout__nav-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  background: transparent;
  border: none;
  color: var(--qt-text);
  font: inherit;
  text-align: left;
  padding: 8px 10px;
  border-radius: var(--qt-radius-sm);
  cursor: pointer;
}
.tool-layout__nav-item:hover {
  background: var(--qt-bg);
}
.tool-layout__nav-item.is-active {
  background: var(--qt-bg);
  color: var(--qt-accent);
  font-weight: 600;
}
.tool-layout__nav-count {
  font-size: 11px;
  color: var(--qt-muted);
}
.tool-layout__main {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.tool-layout__header {
  position: sticky;
  top: 0;
  z-index: 5;
  display: flex;
  align-items: center;
  gap: 12px;
  height: var(--qt-header-height);
  padding: 0 16px;
  background: var(--qt-surface);
  border-bottom: 1px solid var(--qt-border);
}
.tool-layout__back {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: transparent;
  border: none;
  color: var(--qt-muted);
  cursor: pointer;
  font: inherit;
}
.tool-layout__back:hover {
  color: var(--qt-text);
}
.tool-layout__title {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: var(--qt-text);
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.tool-layout__actions {
  display: flex;
  gap: 8px;
}
.tool-layout__icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: var(--qt-radius-sm);
  border: 1px solid var(--qt-border);
  background: var(--qt-bg);
  color: var(--qt-text);
  cursor: pointer;
}
.tool-layout__icon-btn:hover {
  border-color: var(--qt-accent-soft);
}
.tool-layout__content {
  flex: 1 1 auto;
  padding: 24px;
  overflow-y: auto;
}
.tool-layout__chromeless {
  padding: 16px;
}
@media (max-width: 768px) {
  .tool-layout__sidebar {
    display: none;
  }
}
</style>
