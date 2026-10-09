<script setup lang="ts">
/**
 * EscapeHtmlEntities - escape and unescape HTML entities.
 *
 * Bidirectional: text → HTML entities (escape) and HTML entities → text
 * (unescape). Two entity styles for the escape direction:
 *
 * - **Named** - `&amp;` `&lt;` `&gt;` `&quot;` `&#39;` (the apostrophe uses
 *   the numeric form because `&apos;` is not recognised in HTML4).
 * - **Numeric** - decimal numeric character references
 *   `&#38;` `&#60;` `&#62;` `&#34;` `&#39;`.
 *
 * Unescape handles named, decimal (`&#NN;`) and hex (`&#xHH;`) references.
 *
 * No external dependencies.
 *
 * Works in embed mode: receives `input` PostMessages to pre-fill the input,
 * select the direction, and choose the entity mode; sends `output` PostMessages
 * whenever the computed output changes.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { AlertCircle, ArrowLeftRight, RefreshCw, Code, Hash } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import CopyButton from '@/components/CopyButton.vue';
import {
  useEscapeHtml,
  type HtmlDirection,
  type HtmlEntityMode,
} from './useEscapeHtml';

const {
  input,
  direction,
  mode,
  outputs,
  error,
  recompute,
  setDirection,
  setMode,
  swap,
} = useEscapeHtml();

const { t } = useI18n();
const U = 'tools.escape-html-entities.ui.';

const placeholder = computed(() =>
  direction.value === 'escape' ? t(U + 'placeholderEscape') : t(U + 'placeholderUnescape'),
);

const inputLabel = computed(() =>
  direction.value === 'escape' ? t('common.text') : t(U + 'labelEntities'),
);
const outputLabel = computed(() =>
  direction.value === 'escape' ? t(U + 'labelEscaped') : t(U + 'labelDecoded'),
);

const description = computed(() => {
  const modeText = mode.value === 'named' ? t(U + 'descNamed') : t(U + 'descNumeric');
  return direction.value === 'escape'
    ? t(U + 'descEscape', { mode: modeText })
    : t(U + 'descUnescape');
});

function onTextInput(e: Event): void {
  input.value = (e.target as HTMLTextAreaElement).value;
}

function onDirectionChange(d: HtmlDirection): void {
  setDirection(d);
}

function onModeChange(m: HtmlEntityMode): void {
  setMode(m);
}
</script>

<template>
  <div class="qt-tool">
    <ToolInput :title="t('common.input')" :description="description">
      <template #actions>
        <button
          class="qt-btn qt-btn--ghost"
          type="button"
          :title="t('common.swapTitle')"
          @click="swap"
        >
          <ArrowLeftRight :size="14" />
          <span>{{ t('common.swap') }}</span>
        </button>
        <button
          class="qt-btn qt-btn--primary"
          type="button"
          :disabled="input.trim().length === 0"
          @click="recompute"
        >
          <RefreshCw :size="14" />
          <span>{{ t('common.convert') }}</span>
        </button>
      </template>

      <div class="qt-row qt-row--center" style="--qt-row-gap:10px">
        <span class="qt-label">{{ t('common.direction') }}</span>
        <div class="html__mode-toggle">
          <button
            type="button"
            class="html__mode-opt"
            :class="{ 'html__mode-opt--active': direction === 'escape' }"
            :aria-pressed="direction === 'escape'"
            @click="onDirectionChange('escape')"
          >
            {{ t(U + 'escape') }}
          </button>
          <button
            type="button"
            class="html__mode-opt"
            :class="{ 'html__mode-opt--active': direction === 'unescape' }"
            :aria-pressed="direction === 'unescape'"
            @click="onDirectionChange('unescape')"
          >
            {{ t(U + 'unescape') }}
          </button>
        </div>
      </div>

      <div class="qt-row qt-row--center" style="--qt-row-gap:10px">
        <span class="qt-label">{{ t(U + 'entities') }}</span>
        <div class="html__mode-toggle">
          <button
            type="button"
            class="html__mode-opt"
            :class="{ 'html__mode-opt--active': mode === 'named' }"
            :aria-pressed="mode === 'named'"
            :title="t(U + 'namedTitle')"
            @click="onModeChange('named')"
          >
            <Code :size="13" />
            <span>{{ t(U + 'named') }}</span>
          </button>
          <button
            type="button"
            class="html__mode-opt"
            :class="{ 'html__mode-opt--active': mode === 'numeric' }"
            :aria-pressed="mode === 'numeric'"
            :title="t(U + 'numericTitle')"
            @click="onModeChange('numeric')"
          >
            <Hash :size="13" />
            <span>{{ t(U + 'numeric') }}</span>
          </button>
        </div>
      </div>

      <label class="qt-field">
        <span class="qt-label">{{ inputLabel }}</span>
        <textarea
          class="qt-input qt-input--mono html__textarea"
          :placeholder="placeholder"
          :value="input"
          rows="6"
          spellcheck="false"
          autocomplete="off"
          @input="onTextInput"
        />
      </label>
    </ToolInput>

    <ToolOutput
      :title="outputLabel"
      :description="outputs ? t(U + 'outputDesc', outputs.outputBytes) : t('common.enterToConvert')"
      :copy-text="outputs?.output ?? ''"
      :copy-label="t('common.copyResult')"
    >
      <p v-if="error" class="qt-alert qt-alert--error">
        <AlertCircle :size="14" />
        <span>{{ error }}</span>
      </p>
      <template v-else>
        <p v-if="!outputs" class="qt-alert qt-alert--empty">
          {{ t('common.enterToConvert') }}
        </p>
        <div v-if="outputs" class="qt-result">
          <div class="qt-row qt-row--center qt-row--between qt-row--nowrap" style="--qt-row-gap:8px">
            <span class="qt-label">{{ outputLabel }}</span>
            <CopyButton :text="outputs.output" icon-only />
          </div>
          <code class="qt-mono html__code">{{ outputs.output || '-' }}</code>
          <div class="qt-row qt-row--center qt-hint" style="--qt-row-gap:6px">
            <span>{{ t(U + 'bytesIn', outputs.inputBytes) }}</span>
            <span class="html__dot">·</span>
            <span>{{ t(U + 'bytesOut', outputs.outputBytes) }}</span>
          </div>
        </div>
      </template>
    </ToolOutput>
  </div>
</template>

<style scoped>
/* Kept scoped: patterns unique to this tool (no generic utility). */

/* Direction + entities pill segmented controls (solid-accent active). */
.html__mode-toggle {
  display: inline-flex;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: 999px;
  padding: 3px;
}
.html__mode-opt {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  border-radius: 999px;
  border: none;
  background: transparent;
  color: var(--qt-muted);
  font: inherit;
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  transition:
    color 0.15s ease,
    background 0.15s ease;
}
.html__mode-opt--active {
  color: var(--qt-bg);
  background: var(--qt-accent);
}
/* Input textarea floor (control + mono via .qt-input--mono). */
.html__textarea {
  min-height: 120px;
}
/* Output code (font via .qt-mono) — break-anywhere, pre-wrapped. */
.html__code {
  font-size: 14px;
  color: var(--qt-text);
  word-break: break-all;
  white-space: pre-wrap;
}
/* Meta separator dot. */
.html__dot {
  opacity: 0.6;
}
</style>
