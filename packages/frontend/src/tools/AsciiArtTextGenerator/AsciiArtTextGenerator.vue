<script setup lang="ts">
/**
 * AsciiArtTextGenerator — render text as ASCII art using figlet.
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

const gallerySampleText = () =>
  input.value.length > 0 ? input.value : DEFAULT_SAMPLE;
</script>

<template>
  <div class="aat">
    <ToolInput
      title="Input"
      description="Type text to render as ASCII art. Renders live."
    >
      <template #actions>
        <button
          type="button"
          class="aat__btn aat__btn--ghost"
          title="Clear input"
          @click="onReset"
        >
          <RotateCcw :size="14" />
          <span>Clear</span>
        </button>
      </template>

      <textarea
        class="aat__input"
        spellcheck="false"
        placeholder="e.g. Hello World"
        :value="draft"
        @input="onInput"
        aria-label="Text to render as ASCII art"
      ></textarea>

      <div class="aat__options">
        <label class="aat__field">
          <span class="aat__label">Font</span>
          <select
            id="aat-font-select"
            class="aat__select"
            :value="font"
            @change="onFont"
          >
            <option v-for="name in CURATED_FONTS" :key="name" :value="name">
              {{ name }}
            </option>
          </select>
        </label>
      </div>

      <div class="aat__layouts">
        <div class="aat__layout-group">
          <span class="aat__layout-label">Horizontal</span>
          <div class="aat__chips">
            <button
              v-for="mode in KERNING_METHODS"
              :key="`h-${mode}`"
              type="button"
              class="aat__chip"
              :class="{ 'aat__chip--active': horizontalLayout === mode }"
              @click="onHorizontalLayout(mode)"
            >
              {{ mode }}
            </button>
          </div>
        </div>
        <div class="aat__layout-group">
          <span class="aat__layout-label">Vertical</span>
          <div class="aat__chips">
            <button
              v-for="mode in KERNING_METHODS"
              :key="`v-${mode}`"
              type="button"
              class="aat__chip"
              :class="{ 'aat__chip--active': verticalLayout === mode }"
              @click="onVerticalLayout(mode)"
            >
              {{ mode }}
            </button>
          </div>
        </div>
      </div>
    </ToolInput>

    <ToolOutput
      title="ASCII art"
      :description="loading ? 'Rendering…' : (error ? error : 'Ready')"
    >
      <template #actions>
        <CopyButton
          :text="output"
          label="Copy"
          class="aat__copy"
        />
      </template>

      <div v-if="error" class="aat__error">{{ error }}</div>
      <pre
        v-else
        class="aat__output"
        aria-label="Rendered ASCII art"
      >{{ output || (loading ? 'Rendering…' : 'Type something to render.') }}</pre>
    </ToolOutput>

    <section class="aat__gallery-section">
      <header class="aat__gallery-header">
        <h2 class="aat__gallery-title">Font preview gallery</h2>
        <div class="aat__gallery-filter">
          <Search :size="14" />
          <input
            type="text"
            class="aat__filter-input"
            placeholder="Filter fonts…"
            v-model="galleryFilter"
            aria-label="Filter fonts by name"
          />
        </div>
      </header>
      <p class="aat__gallery-sample">
        Preview text: <code>{{ gallerySampleText() }}</code>
      </p>

      <div class="aat__gallery">
        <button
          v-for="preview in filteredGallery()"
          :key="preview.name"
          type="button"
          class="aat__card"
          :class="{ 'aat__card--active': font === preview.name }"
          :title="`Use font: ${preview.name}`"
          @click="selectFont(preview.name)"
        >
          <div class="aat__card-name">{{ preview.name }}</div>
          <pre
            v-if="preview.art && !preview.error"
            class="aat__card-art"
          >{{ preview.art }}</pre>
          <div v-else-if="preview.loading" class="aat__card-status">
            Loading…
          </div>
          <div v-else-if="preview.error" class="aat__card-status aat__card-status--err">
            Failed to load
          </div>
          <div v-else class="aat__card-status">—</div>
        </button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.aat {
  display: flex;
  flex-direction: column;
  gap: var(--qt-gap);
  max-width: var(--qt-max-content);
  margin: 0 auto;
}
.aat__input {
  width: 100%;
  min-height: 100px;
  resize: vertical;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  color: var(--qt-text);
  font: inherit;
  font-size: 14px;
  line-height: 1.6;
  padding: 12px 14px;
  white-space: pre-wrap;
  word-break: break-word;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;
}
.aat__input:focus {
  border-color: var(--qt-accent);
  outline: none;
  box-shadow: 0 0 0 2px oklch(from var(--qt-accent) 90% c h / 0.25);
}
.aat__options {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 16px;
  margin-top: 12px;
}
.aat__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.aat__label {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--qt-muted);
}
.aat__select {
  min-width: 200px;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  color: var(--qt-text);
  font: inherit;
  font-size: 14px;
  padding: 8px 10px;
  cursor: pointer;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;
}
.aat__select:focus {
  border-color: var(--qt-accent);
  outline: none;
  box-shadow: 0 0 0 2px oklch(from var(--qt-accent) 90% c h / 0.25);
}
.aat__layouts {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 14px;
}
.aat__layout-group {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}
.aat__layout-label {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--qt-muted);
  min-width: 80px;
}
.aat__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
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
.aat__btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border-radius: var(--qt-radius-sm);
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  padding: 7px 12px;
  cursor: pointer;
  transition:
    transform 0.1s ease,
    opacity 0.15s ease,
    border-color 0.15s ease,
    color 0.15s ease,
    background 0.15s ease;
}
.aat__btn--ghost {
  background: transparent;
  border: 1px solid var(--qt-border);
  color: var(--qt-muted);
}
.aat__btn--ghost:hover:not(:disabled) {
  color: var(--qt-text);
  border-color: var(--qt-accent);
}
.aat__btn--ghost:active:not(:disabled) {
  transform: translateY(1px);
}
.aat__btn--ghost:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.aat__copy {
  position: absolute;
  top: 8px;
  right: 8px;
}
.aat__output {
  width: 100%;
  min-height: 160px;
  max-height: 60vh;
  overflow: auto;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  color: var(--qt-text);
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
  font-size: 11px;
  line-height: 1.2;
  padding: 12px 14px;
  white-space: pre;
  overflow-x: auto;
  margin: 0;
}
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
.aat__gallery-section {
  margin-top: 4px;
}
.aat__gallery-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 6px;
}
.aat__gallery-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--qt-text);
  margin: 0;
}
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
.aat__gallery-sample {
  font-size: 12.5px;
  color: var(--qt-muted);
  margin: 0 0 12px 0;
}
.aat__gallery-sample code {
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
  color: var(--qt-text);
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: 4px;
  padding: 1px 6px;
}
.aat__gallery {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 12px;
}
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
.aat__card-name {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--qt-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.aat__card-art {
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
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
