<script setup lang="ts">
/**
 * SlugifyString - convert text to a URL-safe slug.
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
import { useI18n } from 'vue-i18n';
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

const { t } = useI18n();
const U = 'tools.slugify-string.ui.';

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
  <div class="qt-tool">
    <ToolInput
      :title="t('common.text')"
      :description="t(U + 'desc')"
    >
      <template #actions>
        <button
          class="qt-btn qt-btn--primary"
          type="button"
          :disabled="input.trim().length === 0"
          @click="recompute"
        >
          <RefreshCw :size="14" />
          <span>{{ t(U + 'slugify') }}</span>
        </button>
      </template>

      <div class="qt-row qt-row--center" style="--qt-row-gap:16px">
        <label class="qt-row qt-row--center qt-row--nowrap" style="--qt-row-gap:8px">
          <span class="qt-label">{{ t(U + 'separator') }}</span>
          <select
            class="qt-input"
            :value="options.separator"
            @change="onSeparatorChange"
          >
            <option value="-">{{ t(U + 'sepHyphen') }}</option>
            <option value="_">{{ t(U + 'sepUnderscore') }}</option>
          </select>
        </label>

        <label class="qt-check">
          <input
            type="checkbox"
            :checked="options.lowercase"
            @change="toggleLowercase"
          />
          <span>{{ t(U + 'lowercase') }}</span>
        </label>

        <label class="qt-check">
          <input
            type="checkbox"
            :checked="options.trim"
            @change="toggleTrim"
          />
          <span>{{ t(U + 'trimSeparators') }}</span>
        </label>

        <label class="qt-check">
          <input
            type="checkbox"
            :checked="options.strict"
            @change="toggleStrict"
          />
          <span>{{ t(U + 'strict') }}</span>
        </label>
      </div>

      <textarea
        class="qt-input qt-input--mono slug__textarea"
        :placeholder="t('common.typeOrPaste')"
        :value="input"
        spellcheck="false"
        autocomplete="off"
        rows="6"
        @input="onTextInput"
      />

      <p class="qt-row qt-row--center qt-hint" style="--qt-row-gap:14px">
        <span>{{ t('common.chars', inputStats.chars) }}</span>
        <span>{{ t('common.words', inputStats.words) }}</span>
        <span>{{ t('common.lines', inputStats.lines) }}</span>
      </p>
    </ToolInput>

    <ToolOutput
      :title="t(U + 'outputTitle')"
      :description="output ? t(U + 'descResult') : t(U + 'descEmpty')"
    >
      <template v-if="output" #actions>
        <CopyButton :text="output" :label="t(U + 'copySlug')" />
      </template>
      <p v-if="!output" class="qt-alert qt-alert--empty">
        {{ t(U + 'empty') }}
      </p>
      <pre v-else class="qt-result qt-mono slug__output">{{ output }}</pre>
    </ToolOutput>
  </div>
</template>

<style scoped>
/* Kept scoped: patterns unique to this tool (no generic utility). */

/* Input textarea floor (control + mono via .qt-input--mono). */
.slug__textarea {
  min-height: 120px;
}
/* Output block (card via .qt-result, font via .qt-mono) — pre-wrapped. */
.slug__output {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  min-height: 80px;
}
</style>
