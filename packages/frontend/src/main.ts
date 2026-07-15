/**
 * @q-tools/frontend entry point.
 *
 * Bootstraps the Vue 3 SPA: Ionic, Pinia, Vue Router, and the global
 * stylesheet. The settings store is initialised early so the persisted
 * theme is applied before the first paint.
 */

import { createApp } from 'vue';
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
import { useSettingsStore } from './stores/settingsStore';
import { useAuthStore } from './stores/authStore';
import { useFavoritesStore } from './stores/favoritesStore';
import './styles/global.css';

const app = createApp(App)
  .use(IonicVue, { mode: 'md' })
  .use(createPinia())
  .use(router);

// Initialise persisted settings (theme + locale) before mount.
useSettingsStore();
// Rehydrate favorites from LocalStorage before mount so the home page
// renders the favorites section on first paint.
const favoritesStore = useFavoritesStore();
favoritesStore.loadFromStorage();

router.isReady().then(async () => {
  app.mount('#app');
  // After mount: validate any persisted auth session and, if still
  // authenticated, sync favorites with the backend. Errors are
  // non-fatal — the app works offline with LocalStorage-only favorites.
  const auth = useAuthStore();
  try {
    const user = await auth.restore();
    if (user) {
      void favoritesStore.syncWithBackend();
    }
  } catch {
    /* offline or backend unreachable — LocalStorage favorites still work */
  }
});
