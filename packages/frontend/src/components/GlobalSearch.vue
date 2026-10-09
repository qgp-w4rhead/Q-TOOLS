<script setup lang="ts">
/**
 * GlobalSearch - search bar with ranked dropdown results.
 *
 * Features:
 *   - Filters tools by name, description, keywords, and category.
 *   - Dropdown panel with category badges + match-reason labels.
 *   - Keyboard navigation (↑/↓/Enter/Esc) and global shortcut (`/` or Ctrl+K).
 *   - Empty state with recent searches (LocalStorage) + curated suggestions.
 *   - Emits `update:query` so the parent (HomePage) can filter the category grid.
 */
import { computed, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { Search, X, Clock, CornerDownLeft, ArrowUp, ArrowDown } from 'lucide-vue-next';
import { getIcon } from '@/utils/icons';
import { useToolSearch, type SearchResult } from '@/composables/useToolSearch';
import { usePwaInstall } from '@/composables/usePwaInstall';

const props = withDefaults(
  defineProps<{
    /** Two-way bound query string (parent filters the grid with this). */
    query?: string;
    /** Placeholder text for the input (defaults to localized string). */
    placeholder?: string;
    /** Maximum dropdown results (default 8). */
    maxResults?: number;
  }>(),
  {
    query: '',
    placeholder: undefined,
    maxResults: 8,
  },
);

const { t } = useI18n();
const inputPlaceholder = computed(() => props.placeholder ?? t('search.placeholder'));

const emit = defineEmits<{
  (e: 'update:query', value: string): void;
  (e: 'select', result: SearchResult): void;
}>();

const router = useRouter();

const search = useToolSearch({ maxResults: props.maxResults });
const { shouldShowPrompt } = usePwaInstall();

/* ---- Two-way query binding with the parent ---- */
watch(
  () => props.query,
  (v) => {
    if (v !== search.query.value) search.query.value = v;
  },
  { immediate: true },
);
watch(
  () => search.query.value,
  (v) => {
    if (v !== props.query) emit('update:query', v);
  },
);

/* ---- Reset keyboard highlight whenever results change ---- */
watch(
  () => search.results.value,
  () => {
    search.activeIndex.value = -1;
  },
);

/* ---- Derived display state ---- */
const hasQuery = computed(() => search.query.value.trim().length > 0);
const showDropdown = computed(() => search.isOpen.value);
const showRecent = computed(
  () => !hasQuery.value && search.recent.value.length > 0,
);
const showSuggestions = computed(
  () => !hasQuery.value && search.suggestions.value.length > 0,
);
const showNoResults = computed(
  () => hasQuery.value && search.results.value.length === 0,
);

function fieldLabel(result: SearchResult): string {
  return result.matchedFields.map((f) => t(`search.field.${f}`)).join(', ');
}

function openTool(result: SearchResult): void {
  search.addRecent();
  search.close();
  emit('select', result);
  router.push({ name: 'tool-view', params: { slug: result.tool.slug } });
}

function runRecent(query: string): void {
  search.query.value = query;
  search.inputEl.value?.focus();
}

function removeRecent(event: Event, query: string): void {
  event.stopPropagation();
  search.removeRecent(query);
}

function onInputFocus(): void {
  search.isOpen.value = true;
}

function onInputBlur(e: FocusEvent): void {
  // Delay so click handlers on dropdown items fire before we close.
  const related = e.relatedTarget as HTMLElement | null;
  const panel = document.getElementById('qt-global-search-panel');
  if (related && panel && panel.contains(related)) return;
  setTimeout(() => {
    search.close();
  }, 120);
}

function onInputKeydown(e: KeyboardEvent): void {
  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault();
      search.moveDown();
      break;
    case 'ArrowUp':
      e.preventDefault();
      search.moveUp();
      break;
    case 'Enter': {
      e.preventDefault();
      const active = search.selectActive();
      if (active) {
        openTool(active);
      } else if (hasQuery.value && search.results.value.length > 0) {
        // No row highlighted → open the first result.
        const first = search.results.value[0];
        if (first) openTool(first);
      }
      break;
    }
    case 'Escape':
      e.preventDefault();
      if (hasQuery.value) {
        search.clear();
      } else {
        search.close();
      }
      break;
    case 'Tab':
      search.close();
      break;
  }
}

function onBackdropClick(): void {
  search.close();
}

function clearInput(): void {
  search.clear();
  search.inputEl.value?.focus();
}

function isMac(): boolean {
  return typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
}
</script>

<template>
  <div class="global-search" :class="{ 'is-open': showDropdown }">
    <div class="global-search__field">
      <Search :size="18" class="global-search__icon" />
      <input
        ref="inputEl"
        v-model="search.query.value"
        type="search"
        class="global-search__input"
        :class="{ 'global-search__input--seamless': shouldShowPrompt && !hasQuery }"
        :placeholder="inputPlaceholder"
        :aria-label="t('search.ariaLabel')"
        autocomplete="off"
        spellcheck="false"
        @focus="onInputFocus"
        @blur="onInputBlur"
        @keydown="onInputKeydown"
      />
      <button
        v-if="hasQuery"
        class="global-search__clear"
        type="button"
        :aria-label="t('search.clear')"
        @click="clearInput"
      >
        <X :size="16" />
      </button>
      <kbd v-else class="global-search__shortcut">
        <span v-if="isMac()">⌘K</span>
        <span v-else>Ctrl K</span>
      </kbd>
    </div>

    <Teleport to="body">
      <div
        v-if="showDropdown"
        class="global-search__backdrop"
        @mousedown="onBackdropClick"
      />
    </Teleport>

    <div
      v-if="showDropdown"
      id="qt-global-search-panel"
      class="global-search__panel"
      role="listbox"
      :aria-label="t('search.results')"
    >
      <!-- Match count header -->
      <div v-if="hasQuery" class="global-search__header">
        <span>
          {{ t('search.matchCount', { n: search.totalMatches.value }, search.totalMatches.value) }}
        </span>
      </div>

      <!-- Recent searches (empty query) -->
      <div v-if="showRecent" class="global-search__section">
        <div class="global-search__section-title">
          <Clock :size="13" />
          <span>{{ t('search.recent') }}</span>
          <button
            class="global-search__section-action"
            type="button"
            @click="search.clearRecent()"
          >
            {{ t('search.clearRecent') }}
          </button>
        </div>
        <ul class="global-search__recent">
          <li v-for="entry in search.recent.value" :key="entry.query">
            <div
              class="global-search__recent-item"
              role="button"
              tabindex="0"
              @mousedown.prevent="runRecent(entry.query)"
              @keydown.enter.prevent="runRecent(entry.query)"
            >
              <Clock :size="13" />
              <span class="global-search__recent-text">{{ entry.query }}</span>
              <button
                class="global-search__recent-remove"
                type="button"
                :aria-label="t('search.removeRecent')"
                @mousedown.prevent.stop="removeRecent($event, entry.query)"
              >
                <X :size="13" />
              </button>
            </div>
          </li>
        </ul>
      </div>

      <!-- Suggestions (empty query) -->
      <div v-if="showSuggestions" class="global-search__section">
        <div class="global-search__section-title">
          <span>{{ t('search.popular') }}</span>
        </div>
        <ul class="global-search__list">
          <li
            v-for="result in search.suggestions.value"
            :key="result.tool.slug"
            role="option"
            :aria-selected="false"
          >
            <button
              class="global-search__item"
              type="button"
              @mousedown.prevent="openTool(result)"
            >
              <span class="global-search__item-icon" aria-hidden="true">
                <component :is="getIcon(result.tool.icon)" :size="18" />
              </span>
              <span class="global-search__item-body">
                <span class="global-search__item-name">{{ result.tool.name }}</span>
                <span class="global-search__item-desc">{{ result.tool.description }}</span>
              </span>
              <span class="global-search__badge">{{ result.categoryLabel }}</span>
            </button>
          </li>
        </ul>
      </div>

      <!-- Ranked results (active query) -->
      <ul v-if="hasQuery && search.results.value.length > 0" class="global-search__list">
        <li
          v-for="(result, idx) in search.results.value"
          :key="result.tool.slug"
          role="option"
          :aria-selected="idx === search.activeIndex.value"
        >
          <button
            class="global-search__item"
            :class="{ 'is-active': idx === search.activeIndex.value }"
            type="button"
            @mousedown.prevent="openTool(result)"
            @mouseenter="search.activeIndex.value = idx"
          >
            <span class="global-search__item-icon" aria-hidden="true">
              <component :is="getIcon(result.tool.icon)" :size="18" />
            </span>
            <span class="global-search__item-body">
              <span class="global-search__item-name">{{ result.tool.name }}</span>
              <span class="global-search__item-desc">{{ result.tool.description }}</span>
            </span>
            <span class="global-search__badge">{{ result.categoryLabel }}</span>
            <span v-if="fieldLabel(result)" class="global-search__match">
              {{ fieldLabel(result) }}
            </span>
          </button>
        </li>
      </ul>

      <!-- No results -->
      <div v-if="showNoResults" class="global-search__empty">
        <p class="global-search__empty-title">{{ t('search.noResults', { query: search.query.value }) }}</p>
        <p class="global-search__empty-hint">
          {{ t('search.noResultsHint') }}
        </p>
      </div>

      <!-- Footer hint -->
      <div v-if="hasQuery && search.results.value.length > 0" class="global-search__footer">
        <span class="global-search__hint">
          <kbd><ArrowUp :size="11" /><ArrowDown :size="11" /></kbd>
          {{ t('search.hintNavigate') }}
          <kbd><CornerDownLeft :size="11" /></kbd>
          {{ t('search.hintOpen') }}
          <kbd>Esc</kbd>
          {{ t('search.hintClose') }}
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.global-search {
  position: relative;
  width: 100%;
  max-width: 560px;
  margin: 0 auto;
}
.global-search__field {
  position: relative;
  display: flex;
  align-items: center;
}
.global-search__icon {
  position: absolute;
  left: 14px;
  color: var(--qt-muted);
  pointer-events: none;
}
.global-search__input {
  width: 100%;
  padding: 12px 44px 12px 42px;
  border-radius: 1vw;
  border: 1px solid var(--qt-border);
  background: var(--qt-surface);
  color: var(--qt-text);
  font: inherit;
  transition: border-color 0.15s ease, box-shadow 0.15s ease, border-radius 0.25s ease;
}
.global-search__input--seamless {
  border-bottom-left-radius: 0;
  border-bottom-right-radius: 0;
}
.global-search__input:focus {
  border-color: var(--qt-accent);
  outline: none;
  box-shadow: 0 0 0 3px var(--qt-accent-soft);
}
.global-search__input::-webkit-search-cancel-button {
  -webkit-appearance: none;
  appearance: none;
}
.global-search__clear {
  position: absolute;
  right: 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border: none;
  border-radius: 50%;
  background: var(--qt-bg);
  color: var(--qt-muted);
  cursor: pointer;
}
.global-search__clear:hover {
  color: var(--qt-text);
}
.global-search__shortcut {
  position: absolute;
  right: 12px;
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 2px 7px;
  font-size: 11px;
  font-family: inherit;
  color: var(--qt-muted);
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  pointer-events: none;
  user-select: none;
}

/* ---- Dropdown panel ---- */
.global-search__backdrop {
  position: fixed;
  inset: 0;
  z-index: 20;
  background: transparent;
}
.global-search__panel {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  right: 0;
  z-index: 21;
  max-height: min(60vh, 480px);
  overflow-y: auto;
  background: var(--qt-surface);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.32);
  padding: 6px;
}
.global-search__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px;
  font-size: 12px;
  color: var(--qt-muted);
}
.global-search__section {
  padding: 4px 0 6px;
}
.global-search__section + .global-search__section {
  border-top: 1px solid var(--qt-border);
  margin-top: 4px;
  padding-top: 8px;
}
.global-search__section-title {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--qt-muted);
}
.global-search__section-action {
  margin-left: auto;
  background: transparent;
  border: none;
  color: var(--qt-muted);
  font: inherit;
  font-size: 11px;
  text-transform: none;
  letter-spacing: 0;
  cursor: pointer;
  padding: 0;
}
.global-search__section-action:hover {
  color: var(--qt-text);
}

/* ---- Recent searches ---- */
.global-search__recent {
  list-style: none;
  margin: 0;
  padding: 0;
}
.global-search__recent-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 7px 10px;
  background: transparent;
  border: none;
  border-radius: var(--qt-radius-sm);
  color: var(--qt-text);
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.global-search__recent-item:focus-visible {
  outline: 2px solid var(--qt-accent);
  outline-offset: -2px;
}
.global-search__recent-item:hover {
  background: var(--qt-bg);
}
.global-search__recent-text {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.global-search__recent-remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--qt-muted);
  cursor: pointer;
}
.global-search__recent-remove:hover {
  color: var(--qt-text);
  background: var(--qt-border);
}

/* ---- Result list ---- */
.global-search__list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.global-search__item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px 10px;
  background: transparent;
  border: none;
  border-radius: var(--qt-radius-sm);
  color: var(--qt-text);
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: background 0.1s ease;
}
.global-search__item:hover,
.global-search__item.is-active {
  background: var(--qt-bg);
}
.global-search__item-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  flex: 0 0 32px;
  border-radius: var(--qt-radius-sm);
  background: oklch(from var(--qt-accent) 90% c h);
  color: var(--qt-bg);
}
.global-search__item-body {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
  flex: 1 1 auto;
}
.global-search__item-name {
  font-weight: 600;
  font-size: 13.5px;
  color: var(--qt-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.global-search__item-desc {
  font-size: 12px;
  color: var(--qt-muted);
  line-height: 1.35;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.global-search__badge {
  flex: 0 0 auto;
  font-size: 11px;
  color: var(--qt-muted);
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: 999px;
  padding: 1px 8px;
  white-space: nowrap;
}
.global-search__match {
  flex: 0 0 auto;
  font-size: 10.5px;
  color: var(--qt-accent);
  text-transform: uppercase;
  letter-spacing: 0.03em;
  white-space: nowrap;
}

/* ---- Empty state ---- */
.global-search__empty {
  padding: 24px 16px;
  text-align: center;
}
.global-search__empty-title {
  margin: 0 0 4px;
  font-size: 14px;
  color: var(--qt-text);
}
.global-search__empty-hint {
  margin: 0;
  font-size: 12.5px;
  color: var(--qt-muted);
}

/* ---- Footer hint ---- */
.global-search__footer {
  display: flex;
  justify-content: flex-end;
  padding: 6px 10px;
  border-top: 1px solid var(--qt-border);
  margin-top: 4px;
}
.global-search__hint {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: var(--qt-muted);
}
.global-search__hint kbd {
  display: inline-flex;
  align-items: center;
  gap: 1px;
  padding: 1px 5px;
  font-family: inherit;
  font-size: 11px;
  color: var(--qt-muted);
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: 4px;
}

@media (max-width: 560px) {
  .global-search__panel {
    position: fixed;
    top: auto;
    left: 8px;
    right: 8px;
    max-height: 70vh;
  }
  .global-search__item-desc {
    display: none;
  }
}
</style>
