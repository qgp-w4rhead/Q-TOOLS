<script setup lang="ts">
/**
 * AsciiArtTextGenerator - render text as ASCII art using figlet.
 *
 * The figlet core module and each font are lazy-loaded on demand (separate
 * Vite chunks). A curated set of 26 popular fonts is offered via a dropdown
 * and a live preview gallery that re-renders as the input changes. Horizontal
 * and vertical layout (kerning / smushing) modes are configurable.
 *
 * Works in embed mode: receives `input` PostMessages to set the text, font,
 * and layout options, and sends `output` PostMessages with the rendered art.
 */
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { RotateCcw, Search } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import CopyButton from '@/components/CopyButton.vue';
import {
  useAsciiArtTextGenerator,
  CURATED_FONTS,
  KERNING_METHODS,
  DEFAULT_SAMPLE,
  type KerningMethod,
} from './useAsciiArtTextGenerator';

const {
  input,
  font,
  horizontalLayout,
  verticalLayout,
  output,
  loading,
  error,
  gallery,
  reset,
} = useAsciiArtTextGenerator();

// Debounce the input so typing stays responsive. The composable watches the
// `input` ref directly; we just buffer the textarea value and flush on a timer.
const draft = ref<string>(input.value);
let timer: ReturnType<typeof setTimeout> | null = null;

function onInput(e: Event): void {
  draft.value = (e.target as HTMLTextAreaElement).value;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    input.value = draft.value;
  }, 150);
}

function onFont(e: Event): void {
  font.value = (e.target as HTMLSelectElement).value;
}

function onHorizontalLayout(value: KerningMethod): void {
  horizontalLayout.value = value;
}

function onVerticalLayout(value: KerningMethod): void {
  verticalLayout.value = value;
}

function onReset(): void {
  if (timer) clearTimeout(timer);
  reset();
  draft.value = '';
}

function selectFont(name: string): void {
  font.value = name;
  // Scroll the dropdown into view too (helps on mobile).
  const sel = document.getElementById('aat-font-select') as HTMLSelectElement | null;
  if (sel) sel.value = name;
}

// Gallery filter state.
const galleryFilter = ref<string>('');
const filteredGallery = () => {
  const q = galleryFilter.value.trim().toLowerCase();
  if (!q) return gallery.value;
  return gallery.value.filter((p) => p.name.toLowerCase().includes(q));
};

const { t } = useI18n();
const U = 'tools.ascii-art-text-generator.ui.';

const KERN_KEYS: Record<KerningMethod, string> = {
  default: 'kernDefault',
  full: 'kernFull',
  fitted: 'kernFitted',
  'controlled smushing': 'kernControlled',
  'universal smushing': 'kernUniversal',
};
function kernLabel(m: KerningMethod): string {
  return t(U + KERN_KEYS[m]);
}

const gallerySampleText = () =>
  input.value.length > 0 ? input.value : DEFAULT_SAMPLE;
</script>

<template>
  <div class="qt-tool">
    <ToolInput
      :title="t('common.input')"
      :description="t(U + 'desc')"
    >
      <template #actions>
        <button
          type="button"
          class="qt-btn qt-btn--ghost"
          :title="t(U + 'clearTitle')"
          @click="onReset"
        >
          <RotateCcw :size="14" />
          <span>{{ t('common.clear') }}</span>
        </button>
      </template>

      <textarea
        class="qt-input"
        style="min-height:100px;line-height:1.6;padding:12px 14px"
        spellcheck="false"
        :placeholder="t(U + 'placeholder')"
        :value="draft"
        @input="onInput"
        :aria-label="t(U + 'ariaInput')"
      ></textarea>

      <div class="qt-row qt-row--bottom" style="--qt-row-gap:16px;margin-top:12px">
        <label class="qt-field">
          <span class="qt-label">{{ t(U + 'font') }}</span>
          <select
            id="aat-font-select"
            class="qt-input"
            style="min-width:200px"
            :value="font"
            @change="onFont"
          >
            <option v-for="name in CURATED_FONTS" :key="name" :value="name">
              {{ name }}
            </option>
          </select>
        </label>
      </div>

      <div class="qt-stack" style="--qt-stack-gap:10px;margin-top:14px">
        <div class="qt-row qt-row--center">
          <span class="aat__layout-label">{{ t(U + 'horizontal') }}</span>
          <div class="qt-row" style="--qt-row-gap:6px">
            <button
              v-for="mode in KERNING_METHODS"
              :key="`h-${mode}`"
              type="button"
              class="aat__chip"
              :class="{ 'aat__chip--active': horizontalLayout === mode }"
              @click="onHorizontalLayout(mode)"
            >
              {{ kernLabel(mode) }}
            </button>
          </div>
        </div>
        <div class="qt-row qt-row--center">
          <span class="aat__layout-label">{{ t(U + 'vertical') }}</span>
          <div class="qt-row" style="--qt-row-gap:6px">
            <button
              v-for="mode in KERNING_METHODS"
              :key="`v-${mode}`"
              type="button"
              class="aat__chip"
              :class="{ 'aat__chip--active': verticalLayout === mode }"
              @click="onVerticalLayout(mode)"
            >
              {{ kernLabel(mode) }}
            </button>
          </div>
        </div>
      </div>
    </ToolInput>

    <ToolOutput
      :title="t(U + 'outputTitle')"
      :description="loading ? t(U + 'descRendering') : (error ? error : t(U + 'descReady'))"
    >
      <template #actions>
        <CopyButton
          :text="output"
          :label="t('common.copy')"
          class="qt-copy-float"
        />
      </template>

      <div v-if="error" class="aat__error">{{ error }}</div>
      <pre
        v-else
        class="aat__output"
        :aria-label="t(U + 'ariaOutput')"
      >{{ output || (loading ? t(U + 'descRendering') : t(U + 'emptyOutput')) }}</pre>
    </ToolOutput>

    <section style="margin-top:4px">
      <header class="qt-row qt-row--center qt-row--between" style="--qt-row-gap:12px;margin-bottom:6px">
        <h2 style="font-size:14px;font-weight:600;color:var(--qt-text);margin:0">{{ t(U + 'galleryTitle') }}</h2>
        <div class="aat__gallery-filter">
          <Search :size="14" />
          <input
            type="text"
            class="aat__filter-input"
            :placeholder="t(U + 'filterPlaceholder')"
            v-model="galleryFilter"
            :aria-label="t(U + 'ariaFilter')"
          />
        </div>
      </header>
      <p style="font-size:12.5px;color:var(--qt-muted);margin:0 0 12px 0">
        {{ t(U + 'previewText') }} <code class="qt-kbd">{{ gallerySampleText() }}</code>
      </p>

      <div class="qt-grid" style="--qt-grid-min:280px;--qt-grid-gap:12px">
        <button
          v-for="preview in filteredGallery()"
          :key="preview.name"
          type="button"
          class="aat__card"
          :class="{ 'aat__card--active': font === preview.name }"
          :title="t(U + 'useFontTitle', { name: preview.name })"
          @click="selectFont(preview.name)"
        >
          <div class="qt-stat-head">{{ preview.name }}</div>
          <pre
            v-if="preview.art && !preview.error"
            class="aat__card-art"
          >{{ preview.art }}</pre>
          <div v-else-if="preview.loading" class="aat__card-status">
            {{ t(U + 'loadingCard') }}
          </div>
          <div v-else-if="preview.error" class="aat__card-status aat__card-status--err">
            {{ t(U + 'failedCard') }}
          </div>
          <div v-else class="aat__card-status">-</div>
        </button>
      </div>
    </section>
  </div>
</template>

<style scoped>
/* Kept scoped: patterns unique to this tool (no generic utility). */

/* Layout-group label — fixed min-width, shrinks on narrow. */
.aat__layout-label {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--qt-muted);
  min-width: 80px;
}

/* Option chip — rounded-sm toggle chip with accent-text active. */
.aat__chip {
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  color: var(--qt-muted);
  font: inherit;
  font-size: 12.5px;
  font-weight: 500;
  padding: 5px 10px;
  cursor: pointer;
  transition:
    border-color 0.15s ease,
    color 0.15s ease,
    background 0.15s ease;
}
.aat__chip:hover {
  color: var(--qt-text);
  border-color: var(--qt-accent);
}
.aat__chip--active {
  color: var(--qt-accent);
  border-color: var(--qt-accent);
  background: oklch(from var(--qt-accent) 95% c h / 0.12);
}

/* Scrollable ASCII-art <pre> — tiny mono, no wrap. */
.aat__output {
  width: 100%;
  min-height: 160px;
  max-height: 60vh;
  overflow: auto;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  color: var(--qt-text);
  font-family: var(--qt-font-mono);
  font-size: 11px;
  line-height: 1.2;
  padding: 12px 14px;
  white-space: pre;
  overflow-x: auto;
  margin: 0;
}

/* Warning block for render errors. */
.aat__error {
  width: 100%;
  min-height: 80px;
  background: oklch(from var(--qt-warning) 95% c h / 0.1);
  border: 1px solid var(--qt-warning);
  border-radius: var(--qt-radius-sm);
  color: var(--qt-warning);
  font-size: 13px;
  padding: 12px 14px;
  white-space: pre-wrap;
  word-break: break-word;
}

/* Gallery search box — icon + borderless input in a bordered shell. */
.aat__gallery-filter {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  padding: 6px 10px;
  color: var(--qt-muted);
}
.aat__filter-input {
  border: none;
  background: transparent;
  color: var(--qt-text);
  font: inherit;
  font-size: 13px;
  outline: none;
  width: 140px;
}

/* Selectable font-preview card. */
.aat__card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  padding: 10px 12px;
  cursor: pointer;
  text-align: left;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease,
    transform 0.1s ease;
}
.aat__card:hover {
  border-color: var(--qt-accent);
}
.aat__card:active {
  transform: translateY(1px);
}
.aat__card--active {
  border-color: var(--qt-accent);
  box-shadow: 0 0 0 2px oklch(from var(--qt-accent) 90% c h / 0.25);
}
.aat__card-art {
  font-family: var(--qt-font-mono);
  font-size: 7px;
  line-height: 1.05;
  color: var(--qt-text);
  white-space: pre;
  overflow: auto;
  max-height: 140px;
  margin: 0;
}
.aat__card-status {
  font-size: 12px;
  color: var(--qt-muted);
  min-height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.aat__card-status--err {
  color: var(--qt-warning);
}
@media (max-width: 640px) {
  .aat__card-art {
    font-size: 6px;
  }
  .aat__layout-label {
    min-width: 70px;
  }
}
</style>
