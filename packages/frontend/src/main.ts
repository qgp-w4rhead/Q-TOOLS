/**
 * @q-tools/frontend entry point.
 *
 * Bootstraps the Vue 3 SPA: Ionic, Pinia, Vue Router, and the global
 * stylesheet. The settings store is initialised early so the persisted
 * theme is applied before the first paint.
 */

import { createApp, watch } from 'vue';
import { createPinia } from 'pinia';
import { IonicVue } from '@ionic/vue';
import '@ionic/vue/css/core.css';
import '@ionic/vue/css/normalize.css';
import '@ionic/vue/css/structure.css';
import '@ionic/vue/css/typography.css';
import '@ionic/vue/css/padding.css';
import '@ionic/vue/css/float-elements.css';
import '@ionic/vue/css/text-alignment.css';
import '@ionic/vue/css/text-transformation.css';
import '@ionic/vue/css/flex-utils.css';
import '@ionic/vue/css/display.css';

import App from './App.vue';
import router from './router';
import { i18n, isSupportedLocale, setActiveLocale } from './i18n';
import { localizedToolName } from './i18n/localized';
import { getToolBySlug } from './data/tools';
import { useSettingsStore } from './stores/settingsStore';
import { useAuthStore } from './stores/authStore';
import { useFavoritesStore } from './stores/favoritesStore';
import './styles/global.css';
import './styles/utilities.css';

const app = createApp(App)
  .use(IonicVue, { mode: 'md' })
  .use(createPinia())
  .use(i18n)
  .use(router);

// Initialise persisted settings (theme + locale) before mount.
const settingsStore = useSettingsStore();
// Activate the persisted locale (lazy-loads es/fr messages on first use)
// and keep i18n in sync whenever the user changes language.
if (isSupportedLocale(settingsStore.locale)) {
  void setActiveLocale(settingsStore.locale);
}
watch(
  () => settingsStore.locale,
  (locale) => {
    if (isSupportedLocale(locale)) void setActiveLocale(locale);
  },
);

/** Sync <title> + meta description with the active route and locale. */
function updateDocumentMeta(): void {
  const gt = i18n.global.t;
  const slug = (router.currentRoute.value.params.slug as string | undefined) ?? '';
  const tool = slug ? getToolBySlug(slug) : undefined;
  document.title = tool
    ? gt('app.titleTool', { name: localizedToolName(tool) })
    : gt('app.titleHome');
  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc) metaDesc.setAttribute('content', gt('app.metaDescription'));
}

router.afterEach(() => updateDocumentMeta());
// Re-apply meta when the locale changes (covers embeds + language switch).
watch(() => i18n.global.locale.value, () => updateDocumentMeta());
// Rehydrate favorites from LocalStorage before mount so the home page
// renders the favorites section on first paint.
const favoritesStore = useFavoritesStore();
favoritesStore.loadFromStorage();

router.isReady().then(async () => {
  app.mount('#app');
  // After mount: validate any persisted auth session and, if still
  // authenticated, sync favorites with the backend. Errors are
  // non-fatal - the app works offline with LocalStorage-only favorites.
  const auth = useAuthStore();
  try {
    const user = await auth.restore();
    if (user) {
      void favoritesStore.syncWithBackend();
    }
  } catch {
    /* offline or backend unreachable - LocalStorage favorites still work */
  }
});
