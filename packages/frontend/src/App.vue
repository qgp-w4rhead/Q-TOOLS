<script setup lang="ts">
/**
 * Root component.
 *
 * Renders the global Sidebar (fixed-position, present on all routes except
 * embed views), the OfflineBanner, and the Vue Router outlet. The main
 * content area is offset by the sidebar width so it doesn't sit underneath
 * the fixed sidebar.
 *
 * Q-Tools uses standard Vue Router with plain divs - not Ionic's
 * ion-router-outlet (which has a shadow DOM with position:absolute +
 * contain:layout-size-style that prevents native scrolling). The IonicVue
 * plugin is still installed for individual Ionic components used in tool
 * views.
 *
 * The `?embed=1` query alias is handled per-route (ToolLayout renders
 * chromeless when present); the dedicated `/embed/tools/:slug` route uses
 * EmbedView. In both embed cases the sidebar is hidden.
 */
import { computed, watch } from 'vue';
import { RouterView, useRoute } from 'vue-router';
import OfflineBanner from '@/components/OfflineBanner.vue';
import Sidebar from '@/components/Sidebar.vue';
import { isSupportedLocale, setActiveLocale } from '@/i18n';
import { useSettingsStore } from '@/stores/settingsStore';

const route = useRoute();
const settings = useSettingsStore();

const isEmbed = computed(
  () =>
    route.name === 'embed-tool' ||
    (route.name === 'tool' && (route.query.embed === '1' || route.query.embed === 'true')),
);

// `?lang=` query override - primarily for embeds (`/embed/tools/:slug?lang=es`
// and the `?embed=1` alias). Applies the locale WITHOUT persisting it, so an
// embedded view can't clobber the user's stored preference.
watch(
  () => route.query.lang,
  (lang) => {
    const value = Array.isArray(lang) ? lang[0] : lang;
    if (isSupportedLocale(value)) void setActiveLocale(value);
  },
  { immediate: true },
);
</script>

<template>
  <div class="app-root">
    <Sidebar v-if="!isEmbed" />
    <div
      class="app-root__content"
      :class="{
        'app-root__content--sidebar': !isEmbed,
        'app-root__content--collapsed': !isEmbed && settings.sidebarCollapsed,
      }"
    >
      <OfflineBanner />
      <RouterView />
    </div>
  </div>
</template>

<style scoped>
.app-root__content {
  min-height: 100vh;
}

.app-root__content--sidebar {
  margin-left: var(--qt-sidebar-width);
  transition: margin-left 0.2s ease;
}

.app-root__content--collapsed {
  margin-left: var(--qt-sidebar-collapsed-width);
}

@media (max-width: 768px) {
  .app-root__content--sidebar,
  .app-root__content--collapsed {
    margin-left: 0;
  }
}
</style>
