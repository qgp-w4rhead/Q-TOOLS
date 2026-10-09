<script setup lang="ts">
/**
 * LanguageSwitcher - EN/ES/FR dropdown for the top navbar.
 *
 * Shows the active locale code; opens a small menu listing each supported
 * locale by its endonym (English / Español / Français). Selecting a locale
 * calls `settingsStore.setLocale`, which persists the choice; main.ts
 * watches the store and activates the locale in vue-i18n.
 *
 * Mounted in `home__header` and `tool-layout__actions` (right side).
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { Check, ChevronDown, Languages } from 'lucide-vue-next';
import { SUPPORTED_LOCALES, isSupportedLocale, type SupportedLocale } from '@/i18n';
import { useSettingsStore } from '@/stores/settingsStore';

const { t } = useI18n();
const settings = useSettingsStore();
const open = ref(false);
const root = ref<HTMLElement | null>(null);

const LOCALE_LABELS: Record<SupportedLocale, string> = {
  en: 'English',
  es: 'Español',
  fr: 'Français',
};

const current = computed<SupportedLocale>(() =>
  isSupportedLocale(settings.locale) ? settings.locale : 'en',
);

function toggle() {
  open.value = !open.value;
}

function select(locale: SupportedLocale) {
  settings.setLocale(locale);
  open.value = false;
}

function onDocClick(event: MouseEvent) {
  if (root.value && !root.value.contains(event.target as Node)) {
    open.value = false;
  }
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') open.value = false;
}

onMounted(() => {
  document.addEventListener('click', onDocClick);
  document.addEventListener('keydown', onKeydown);
});
onBeforeUnmount(() => {
  document.removeEventListener('click', onDocClick);
  document.removeEventListener('keydown', onKeydown);
});
</script>

<template>
  <div ref="root" class="lang-switcher">
    <button
      type="button"
      class="lang-switcher__toggle"
      :aria-label="t('app.language')"
      :title="t('app.language')"
      :aria-expanded="open"
      aria-haspopup="listbox"
      @click.stop="toggle"
    >
      <Languages :size="16" />
      <span class="lang-switcher__code">{{ current.toUpperCase() }}</span>
      <ChevronDown :size="12" class="lang-switcher__chevron" :class="{ 'is-open': open }" />
    </button>
    <ul v-if="open" class="lang-switcher__menu" role="listbox" :aria-label="t('app.language')">
      <li v-for="locale in SUPPORTED_LOCALES" :key="locale">
        <button
          type="button"
          class="lang-switcher__option"
          :class="{ 'is-active': locale === current }"
          role="option"
          :aria-selected="locale === current"
          @click="select(locale)"
        >
          <span>{{ LOCALE_LABELS[locale] }}</span>
          <Check v-if="locale === current" :size="14" />
        </button>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.lang-switcher {
  position: relative;
}
.lang-switcher__toggle {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 6px 8px;
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius);
  background: transparent;
  color: var(--qt-text);
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease;
}
.lang-switcher__toggle:hover {
  border-color: var(--qt-accent-soft);
  background: var(--qt-surface-hover, rgba(255, 255, 255, 0.04));
}
.lang-switcher__chevron {
  transition: transform 0.15s ease;
}
.lang-switcher__chevron.is-open {
  transform: rotate(180deg);
}
.lang-switcher__menu {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  min-width: 140px;
  margin: 0;
  padding: 4px;
  list-style: none;
  background: var(--qt-surface);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
  z-index: 50;
}
.lang-switcher__option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  padding: 7px 10px;
  border: 0;
  border-radius: calc(var(--qt-radius) - 2px);
  background: transparent;
  color: var(--qt-text);
  font: inherit;
  font-size: 13px;
  text-align: left;
  cursor: pointer;
}
.lang-switcher__option:hover {
  background: var(--qt-surface-hover, rgba(255, 255, 255, 0.06));
}
.lang-switcher__option.is-active {
  color: var(--qt-accent, #58a6ff);
}
</style>
