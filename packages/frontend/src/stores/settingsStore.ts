import { defineStore } from 'pinia';

export type ThemeMode = 'dark' | 'light';

const STORAGE_KEY = 'q-tools-settings';

interface PersistedSettings {
  theme: ThemeMode;
  locale: string;
}

const DEFAULTS: PersistedSettings = {
  theme: 'dark',
  locale: 'en',
};

function readPersisted(): PersistedSettings {
  if (typeof localStorage === 'undefined') return { ...DEFAULTS };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<PersistedSettings>;
    return { ...DEFAULTS, ...parsed };
  } catch {
    return { ...DEFAULTS };
  }
}

function persist(settings: PersistedSettings): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    /* ignore quota / privacy mode errors */
  }
}

/** Apply the theme attribute to <html> so global.css variables switch. */
function applyTheme(theme: ThemeMode): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (theme === 'light') {
    root.setAttribute('data-theme', 'light');
  } else {
    root.removeAttribute('data-theme');
  }
  // Keep the browser chrome + PWA manifest color in sync.
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute('content', theme === 'light' ? '#ffffff' : '#0d1117');
  }
}

export const useSettingsStore = defineStore('settings', {
  state: (): PersistedSettings => {
    const persisted = readPersisted();
    // Apply on init so the very first paint matches stored preference.
    applyTheme(persisted.theme);
    return persisted;
  },
  getters: {
    isDark: (state) => state.theme === 'dark',
  },
  actions: {
    setTheme(theme: ThemeMode) {
      this.theme = theme;
      applyTheme(theme);
      persist({ theme: this.theme, locale: this.locale });
    },
    toggleTheme() {
      this.setTheme(this.theme === 'dark' ? 'light' : 'dark');
    },
    setLocale(locale: string) {
      this.locale = locale;
      persist({ theme: this.theme, locale: this.locale });
    },
  },
});
