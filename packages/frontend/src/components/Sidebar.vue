<script setup lang="ts">
/**
 * Global sidebar - category navigation with collapse support.
 *
 * Fixed-positioned so it stays visible during scroll. On desktop it can be
 * collapsed to a narrow icon-only strip. On mobile (≤768px) it becomes an
 * overlay drawer toggled by a floating hamburger button.
 */
import { ref, computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { Home, ChevronLeft, ChevronRight, Menu, X } from 'lucide-vue-next';
import { CATEGORIES, TOOLS_BY_CATEGORY, getToolBySlug } from '@/data/tools';
import { categoryLabel } from '@/i18n/localized';
import { useSettingsStore } from '@/stores/settingsStore';
import { getIcon } from '@/utils/icons';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const settings = useSettingsStore();

const mobileOpen = ref(false);

const slug = computed(() => (route.params.slug as string | undefined) ?? '');
const tool = computed(() => getToolBySlug(slug.value));

const activeCategory = computed<string | null>(() => {
  if (tool.value) return tool.value.category;
  if (route.hash) {
    return route.hash.replace('#category-', '');
  }
  return null;
});

watch(() => route.fullPath, () => {
  mobileOpen.value = false;
});

function navigateToCategory(catId: string) {
  router.push({ name: 'home', hash: `#category-${catId}` });
  mobileOpen.value = false;
}

function goHome() {
  router.push({ name: 'home' });
  mobileOpen.value = false;
}
</script>

<template>
  <!-- Mobile hamburger toggle (visible only on ≤768px) -->
  <button
    v-if="!mobileOpen"
    class="sidebar__mobile-toggle"
    type="button"
    :aria-label="t('nav.open')"
    @click="mobileOpen = true"
  >
    <Menu :size="20" />
  </button>

  <!-- Mobile backdrop -->
  <div
    v-if="mobileOpen"
    class="sidebar__backdrop"
    @click="mobileOpen = false"
  />

  <aside
    class="sidebar"
    :class="{
      'sidebar--collapsed': settings.sidebarCollapsed,
      'sidebar--mobile-open': mobileOpen,
    }"
  >
    <div class="sidebar__header">
      <button class="sidebar__brand" type="button" @click="goHome">
        <Home :size="18" class="sidebar__brand-icon" />
        <span v-if="!settings.sidebarCollapsed" class="sidebar__brand-text">Q-Tools</span>
      </button>
      <button
        v-if="!settings.sidebarCollapsed"
        class="sidebar__collapse-btn"
        type="button"
        :aria-label="settings.sidebarCollapsed ? t('nav.expand') : t('nav.collapse')"
        @click="settings.toggleSidebar()"
      >
        <ChevronLeft :size="16" />
      </button>
    </div>

    <button
      v-if="settings.sidebarCollapsed"
      class="sidebar__expand-btn"
      type="button"
      :aria-label="t('nav.expand')"
      @click="settings.toggleSidebar()"
    >
      <ChevronRight :size="18" />
    </button>

    <nav class="sidebar__nav" :aria-label="t('nav.categories')">
      <button
        v-for="cat in CATEGORIES"
        :key="cat.id"
        type="button"
        class="sidebar__nav-item"
        :class="{ 'is-active': activeCategory === cat.id }"
        :title="categoryLabel(cat)"
        @click="navigateToCategory(cat.id)"
      >
        <component :is="getIcon(cat.icon)" :size="18" class="sidebar__nav-icon" />
        <span v-if="!settings.sidebarCollapsed" class="sidebar__nav-label">{{ categoryLabel(cat) }}</span>
        <span v-if="!settings.sidebarCollapsed" class="sidebar__nav-count">
          {{ TOOLS_BY_CATEGORY[cat.id]?.length ?? 0 }}
        </span>
      </button>
    </nav>

    <button
      v-if="mobileOpen"
      class="sidebar__mobile-close"
      type="button"
      :aria-label="t('nav.close')"
      @click="mobileOpen = false"
    >
      <X :size="20" />
    </button>
  </aside>
</template>

<style scoped>
.sidebar {
  position: fixed;
  top: 0;
  left: 0;
  height: 100vh;
  width: var(--qt-sidebar-width);
  flex: 0 0 var(--qt-sidebar-width);
  background: var(--qt-surface);
  border-right: 1px solid var(--qt-border);
  padding: 16px 12px;
  overflow-y: auto;
  overflow-x: hidden;
  z-index: 100;
  transition: width 0.2s ease;
  display: flex;
  flex-direction: column;
}

.sidebar--collapsed {
  width: var(--qt-sidebar-collapsed-width);
  padding: 16px 8px;
}

/* ---- Header / brand ---- */
.sidebar__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.sidebar__brand {
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
  border-radius: var(--qt-radius-sm);
}

.sidebar__brand:hover {
  background: var(--qt-bg);
}

.sidebar__brand-icon {
  flex-shrink: 0;
}

.sidebar__collapse-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  border-radius: var(--qt-radius-sm);
  border: 1px solid var(--qt-border);
  background: var(--qt-bg);
  color: var(--qt-muted);
  cursor: pointer;
}

.sidebar__collapse-btn:hover {
  color: var(--qt-text);
  border-color: var(--qt-accent-soft);
}

.sidebar__expand-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  margin: 0 auto 12px;
  border-radius: var(--qt-radius-sm);
  border: 1px solid var(--qt-border);
  background: var(--qt-bg);
  color: var(--qt-muted);
  cursor: pointer;
}

.sidebar__expand-btn:hover {
  color: var(--qt-text);
  border-color: var(--qt-accent-soft);
}

/* ---- Navigation ---- */
.sidebar__nav {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.sidebar__nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  background: transparent;
  border: none;
  color: var(--qt-text);
  font: inherit;
  text-align: left;
  padding: 8px 10px;
  border-radius: var(--qt-radius-sm);
  cursor: pointer;
  white-space: nowrap;
}

.sidebar__nav-item:hover {
  background: var(--qt-bg);
}

.sidebar__nav-item.is-active {
  background: var(--qt-bg);
  color: var(--qt-accent);
  font-weight: 600;
}

.sidebar__nav-icon {
  flex-shrink: 0;
}

.sidebar__nav-label {
  flex: 1 1 auto;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sidebar__nav-count {
  font-size: 11px;
  color: var(--qt-muted);
  flex-shrink: 0;
}

/* Collapsed: center icons */
.sidebar--collapsed .sidebar__nav-item {
  justify-content: center;
  padding: 8px 6px;
}

/* ---- Mobile close button ---- */
.sidebar__mobile-close {
  display: none;
}

/* ---- Mobile hamburger (hidden on desktop) ---- */
.sidebar__mobile-toggle {
  display: none;
}

.sidebar__backdrop {
  display: none;
}

/* ---- Mobile styles (≤768px) ---- */
@media (max-width: 768px) {
  .sidebar {
    transform: translateX(-100%);
    transition: transform 0.25s ease;
    width: var(--qt-sidebar-width);
    padding: 16px 12px;
  }

  .sidebar--collapsed {
    width: var(--qt-sidebar-width);
    padding: 16px 12px;
  }

  .sidebar--mobile-open {
    transform: translateX(0);
  }

  /* Show collapsed content on mobile even if "collapsed" */
  .sidebar--collapsed .sidebar__nav-item {
    justify-content: flex-start;
    padding: 8px 10px;
  }

  .sidebar__mobile-toggle {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    position: fixed;
    top: 12px;
    left: 12px;
    width: 40px;
    height: 40px;
    z-index: 101;
    border-radius: var(--qt-radius-sm);
    border: 1px solid var(--qt-border);
    background: var(--qt-surface);
    color: var(--qt-text);
    cursor: pointer;
  }

  .sidebar__mobile-toggle:hover {
    border-color: var(--qt-accent-soft);
  }

  .sidebar__backdrop {
    display: block;
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 99;
  }

  .sidebar__mobile-close {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    position: absolute;
    top: 12px;
    right: 12px;
    width: 32px;
    height: 32px;
    border-radius: var(--qt-radius-sm);
    border: 1px solid var(--qt-border);
    background: var(--qt-bg);
    color: var(--qt-text);
    cursor: pointer;
  }

  /* On mobile, always show labels */
  .sidebar__brand-text,
  .sidebar__nav-label,
  .sidebar__nav-count {
    display: inline;
  }

  .sidebar__collapse-btn {
    display: none;
  }

  .sidebar__expand-btn {
    display: none;
  }
}
</style>
