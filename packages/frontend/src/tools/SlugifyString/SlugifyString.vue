<script setup lang="ts">
/**
 * SlugifyString — convert text to a URL-safe slug.
 *
 * A textarea input is converted live (debounced) into a slug using the
 * selected options: separator (`-` or `_`), lowercase, trim, and strict
 * (ASCII-only) mode. Multi-line input produces one slug per line.
 *
 * No external dependencies.
 *
 * Works in embed mode: receives `input` PostMessages to pre-fill the text
 * and adjust options; sends `output` PostMessages whenever the slug changes.
 */
import { computed } from 'vue';
import { RefreshCw } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import CopyButton from '@/components/CopyButton.vue';
import {
  useSlugifyString,
  type SlugSeparator,
} from './useSlugifyString';

const {
  input,
  options,
  output,
  recompute,
  setSeparator,
  toggleLowercase,
  toggleTrim,
  toggleStrict,
} = useSlugifyString();

/** Character + word + line counts for the input. */
const inputStats = computed(() => {
  const text = input.value;
  const chars = text.length;
  const lines = text.length === 0 ? 0 : text.split('\n').length;
  const words = text.trim().length === 0 ? 0 : text.trim().split(/\s+/).length;
  return { chars, lines, words };
});

function onTextInput(e: Event): void {
  input.value = (e.target as HTMLTextAreaElement).value;
}

function onSeparatorChange(e: Event): void {
  const value = (e.target as HTMLSelectElement).value as SlugSeparator;
  if (value === '-' || value === '_') setSeparator(value);
}
</script>

<template>
  <div class="slug">
    <ToolInput
      title="Text"
      description="Enter the text to slugify. Conversion is live."
    >
      <template #actions>
        <button
          class="slug__btn"
          type="button"
          :disabled="input.trim().length === 0"
          @click="recompute"
        >
          <RefreshCw :size="14" />
          <span>Slugify</span>
        </button>
      </template>

      <div class="slug__opt-row">
        <label class="slug__field">
          <span class="slug__label">Separator</span>
          <select
            class="slug__select"
            :value="options.separator"
            @change="onSeparatorChange"
          >
            <option value="-">Hyphen ( - )</option>
            <option value="_">Underscore ( _ )</option>
          </select>
        </label>

        <label class="slug__toggle">
          <input
            type="checkbox"
            :checked="options.lowercase"
            @change="toggleLowercase"
          />
          <span>Lowercase</span>
        </label>

        <label class="slug__toggle">
          <input
            type="checkbox"
            :checked="options.trim"
            @change="toggleTrim"
          />
          <span>Trim separators</span>
        </label>

        <label class="slug__toggle">
          <input
            type="checkbox"
            :checked="options.strict"
            @change="toggleStrict"
          />
          <span>Strict (ASCII only)</span>
        </label>
      </div>

      <textarea
        class="slug__textarea"
        placeholder="Type or paste text here…"
        :value="input"
        spellcheck="false"
        autocomplete="off"
        rows="6"
        @input="onTextInput"
      />

      <p class="slug__stats">
        <span>{{ inputStats.chars }} chars</span>
        <span>{{ inputStats.words }} words</span>
        <span>{{ inputStats.lines }} lines</span>
      </p>
    </ToolInput>

    <ToolOutput
      title="Slug"
      :description="output ? 'URL-safe slug.' : 'Enter text above to slugify.'"
    >
      <template v-if="output" #actions>
        <CopyButton :text="output" label="Copy slug" />
      </template>
      <p v-if="!output" class="slug__empty">
        Enter text above to see the slugified result.
      </p>
      <pre v-else class="slug__output">{{ output }}</pre>
    </ToolOutput>
  </div>
</template>

<style scoped>
.slug {
  display: flex;
  flex-direction: column;
  gap: var(--qt-gap);
  max-width: var(--qt-max-content);
  margin: 0 auto;
}
.slug__opt-row {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}
.slug__field {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.slug__label {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--qt-muted);
}
.slug__select {
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  color: var(--qt-text);
  font: inherit;
  font-size: 13px;
  padding: 6px 10px;
  cursor: pointer;
  transition: border-color 0.15s ease;
  will-change: border-color;
}
.slug__select:focus {
  border-color: var(--qt-accent);
  outline: none;
  box-shadow: 0 0 0 2px oklch(from var(--qt-accent) 90% c h / 0.25);
}
.slug__toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--qt-text);
  cursor: pointer;
  user-select: none;
}
.slug__toggle input {
  accent-color: var(--qt-accent);
  cursor: pointer;
}
.slug__textarea {
  width: 100%;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  color: var(--qt-text);
  font: inherit;
  font-size: 14px;
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
  padding: 10px 12px;
  resize: vertical;
  min-height: 120px;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;
  will-change: border-color;
}
.slug__textarea:focus {
  border-color: var(--qt-accent);
  outline: none;
  box-shadow: 0 0 0 2px oklch(from var(--qt-accent) 90% c h / 0.25);
}
.slug__stats {
  display: flex;
  gap: 14px;
  margin: 0;
  font-size: 12px;
  color: var(--qt-muted);
}
.slug__btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: var(--qt-accent);
  border: 1px solid var(--qt-accent);
  border-radius: var(--qt-radius-sm);
  color: var(--qt-bg);
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  padding: 7px 12px;
  cursor: pointer;
  transition:
    transform 0.1s ease,
    opacity 0.15s ease;
  will-change: transform;
}
.slug__btn:hover:not(:disabled) {
  transform: translateY(-1px);
}
.slug__btn:active:not(:disabled) {
  transform: translateY(0);
}
.slug__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.slug__empty {
  margin: 0;
  color: var(--qt-muted);
  font-size: 13.5px;
}
.slug__output {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
  font-size: 14px;
  color: var(--qt-text);
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  padding: 10px 12px;
  min-height: 80px;
}
</style>
