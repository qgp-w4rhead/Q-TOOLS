<script setup lang="ts">
/**
 * Tool page layout for `/tools/:slug`.
 *
 * Renders a header (back link, theme toggle, embed link) and the active tool
 * via `<router-view>`. The sidebar is now rendered globally in App.vue.
 * When `?embed=1` is present, renders chromeless.
 */
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { ArrowLeft, Moon, Sun, ExternalLink } from 'lucide-vue-next';
import { getToolBySlug } from '@/data/tools';
import { localizedToolName } from '@/i18n/localized';
import { useSettingsStore } from '@/stores/settingsStore';
import FavoriteButton from '@/components/FavoriteButton.vue';
import LanguageSwitcher from '@/components/LanguageSwitcher.vue';

const { t } = useI18n();
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
      <div class="tool-layout__main">
        <header class="tool-layout__header">
          <button class="tool-layout__back" type="button" @click="goHome">
            <ArrowLeft :size="16" />
            <span>{{ t('common.back') }}</span>
          </button>
          <h1 class="tool-layout__title">
            {{ tool ? localizedToolName(tool) : t('tool.fallbackTitle') }}
          </h1>
          <div class="tool-layout__actions">
            <FavoriteButton
              v-if="slug"
              :slug="slug"
              :label="tool ? localizedToolName(tool) : undefined"
            />
            <button
              class="tool-layout__icon-btn"
              type="button"
              @click="openEmbed"
              :title="t('tool.openEmbed')"
              :aria-label="t('tool.openEmbed')"
            >
              <ExternalLink :size="16" />
            </button>
            <button
              class="tool-layout__icon-btn"
              type="button"
              @click="settings.toggleTheme()"
              :aria-label="settings.isDark ? t('theme.light') : t('theme.dark')"
            >
              <Sun v-if="settings.isDark" :size="16" />
              <Moon v-else :size="16" />
            </button>
            <LanguageSwitcher />
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
  min-height: 100vh;
}
.tool-layout__main {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
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
</style>
