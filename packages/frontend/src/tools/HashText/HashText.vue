<script setup lang="ts">
/**
 * HashText - hash text with multiple algorithms.
 *
 * Supported: MD5, SHA-1, SHA-256, SHA-384, SHA-512, SHA3-256, SHA3-512, Blake3.
 * SHA-1/256/384/512 use the Web Crypto API; MD5, SHA3, and Blake3 use
 * `hash-wasm` (lazy-loaded into its own Vite chunk).
 *
 * Works in embed mode: receives `input` PostMessages to pre-fill the text and
 * selected algorithms, and sends `output` PostMessages whenever the computed
 * hashes change.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { AlertCircle, Loader2 } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import CopyButton from '@/components/CopyButton.vue';
import {
  useHashText,
  ALGORITHMS,
} from './useHashText';

const { t } = useI18n();

const {
  text,
  algorithms,
  results,
  computing,
  error,
  recompute,
  toggleAlgorithm,
} = useHashText();

/** All hashes as `algorithm: hex` lines - used for the "copy all" button. */
const allHashesText = computed(() =>
  results.value.map((r) => `${r.algorithm}: ${r.hex}`).join('\n'),
);

/** Char count of the input (for the description line). */
const charCount = computed(() => text.value.length);

function onTextInput(e: Event): void {
  text.value = (e.target as HTMLTextAreaElement).value;
}

function onToggle(e: Event, algo: string): void {
  const checked = (e.target as HTMLInputElement).checked;
  const current = algorithms.value.includes(algo as never);
  if (checked && !current) toggleAlgorithm(algo as never);
  if (!checked && current) toggleAlgorithm(algo as never);
}
</script>

<template>
  <div class="qt-tool">
    <ToolInput
      :title="t('common.input')"
      :description="t('tools.hash-text.ui.desc')"
    >
      <template #actions>
        <button
          class="qt-btn qt-btn--primary"
          type="button"
          :disabled="computing || text.length === 0"
          @click="recompute"
        >
          <Loader2 v-if="computing" :size="14" class="qt-spin" />
          <span>{{ computing ? t('tools.hash-text.ui.hashing') : t('tools.hash-text.ui.hash') }}</span>
        </button>
      </template>

      <textarea
        class="qt-input qt-input--mono hash-text__textarea"
        rows="6"
        :placeholder="t('tools.hash-text.ui.placeholder')"
        :value="text"
        spellcheck="false"
        autocomplete="off"
        @input="onTextInput"
      />

      <fieldset class="hash-text__fieldset">
        <legend class="qt-label hash-text__legend">{{ t('tools.hash-text.ui.algorithms') }}</legend>
        <div class="qt-grid" style="--qt-grid-min:140px; --qt-grid-gap:6px 12px">
          <label
            v-for="a in ALGORITHMS"
            :key="a.id"
            class="qt-check"
          >
            <input
              type="checkbox"
              :checked="algorithms.includes(a.id)"
              @change="onToggle($event, a.id)"
            />
            <span>{{ a.label }}</span>
          </label>
        </div>
      </fieldset>
    </ToolInput>

    <ToolOutput
      :title="t('tools.hash-text.ui.outputTitle')"
      :description="results.length ? t('tools.hash-text.ui.outputDesc', {
        digests: t('tools.hash-text.ui.digestCount', { n: results.length }, results.length),
        chars: t('tools.hash-text.ui.charCount', { n: charCount }, charCount),
      }) : ''"
      :copy-text="allHashesText"
      :copy-label="t('common.copyAll')"
    >
      <p v-if="error" class="qt-alert qt-alert--error">
        <AlertCircle :size="14" />
        <span>{{ error }}</span>
      </p>
      <p v-else-if="results.length === 0" class="qt-alert qt-alert--empty">
        {{ t('tools.hash-text.ui.empty') }}
      </p>
      <ul v-else class="qt-list qt-stack">
        <li v-for="r in results" :key="r.algorithm" class="qt-result">
          <div class="qt-row qt-row--center qt-row--between qt-row--nowrap">
            <span class="hash-text__algo">{{ r.label }}</span>
            <span class="hash-text__bits">{{ t('common.bits', { n: r.bits }) }}</span>
          </div>
          <div class="qt-row qt-row--center qt-row--nowrap" style="--qt-row-gap:8px">
            <code class="qt-mono hash-text__hex">{{ r.hex || '-' }}</code>
            <CopyButton :text="r.hex" :label="t('common.copy')" icon-only />
          </div>
        </li>
      </ul>
    </ToolOutput>
  </div>
</template>

<style scoped>
/* Kept scoped: patterns unique to this tool (no generic utility). */

/* Input textarea floor height (control + mono via .qt-input--mono). */
.hash-text__textarea {
  min-height: 120px;
}
/* Bordered algorithm-checkbox group. */
.hash-text__fieldset {
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  padding: 10px 12px;
  margin: 0;
}
.hash-text__legend {
  padding: 0 6px;
}
/* Algorithm name (text-colored, not muted). */
.hash-text__algo {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--qt-text);
}
/* Digest bit-width. */
.hash-text__bits {
  font-size: 11.5px;
  color: var(--qt-muted);
  font-variant-numeric: tabular-nums;
}
/* Hex digest (font via .qt-mono). */
.hash-text__hex {
  flex: 1 1 auto;
  min-width: 0;
  font-size: 12.5px;
  color: var(--qt-text);
  word-break: break-all;
  white-space: pre-wrap;
}
</style>
