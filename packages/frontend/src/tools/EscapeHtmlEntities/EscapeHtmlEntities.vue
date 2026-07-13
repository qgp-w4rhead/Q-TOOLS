<script setup lang="ts">
/**
 * EscapeHtmlEntities — escape and unescape HTML entities.
 *
 * Bidirectional: text → HTML entities (escape) and HTML entities → text
 * (unescape). Two entity styles for the escape direction:
 *
 * - **Named** — `&amp;` `&lt;` `&gt;` `&quot;` `&#39;` (the apostrophe uses
 *   the numeric form because `&apos;` is not recognised in HTML4).
 * - **Numeric** — decimal numeric character references
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

const placeholder = computed(() =>
  direction.value === 'escape'
    ? 'Enter text to escape…'
    : 'Enter HTML entities to decode…',
);

const inputLabel = computed(() => (direction.value === 'escape' ? 'Text' : 'Entities'));
const outputLabel = computed(() =>
  direction.value === 'escape' ? 'Escaped' : 'Decoded',
);

const description = computed(() => {
  const modeText =
    mode.value === 'named'
      ? 'Named entities (&amp; &lt; &gt; &quot; &#39;).'
      : 'Numeric decimal entities (&#38; &#60; &#62; &#34; &#39;).';
  return direction.value === 'escape'
    ? `Escape HTML-significant characters. ${modeText}`
    : `Decode HTML entities (named, &#NN; and &#xHH;).`;
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
  <div class="html">
    <ToolInput title="Input" :description="description">
      <template #actions>
        <button
          class="html__btn html__btn--ghost"
          type="button"
          title="Swap direction and feed the result back as input"
          @click="swap"
        >
          <ArrowLeftRight :size="14" />
          <span>Swap</span>
        </button>
        <button
          class="html__btn"
          type="button"
          :disabled="input.trim().length === 0"
          @click="recompute"
        >
          <RefreshCw :size="14" />
          <span>Convert</span>
        </button>
      </template>

      <div class="html__mode-row">
        <span class="html__label">Direction</span>
        <div class="html__mode-toggle">
          <button
            type="button"
            class="html__mode-opt"
            :class="{ 'html__mode-opt--active': direction === 'escape' }"
            :aria-pressed="direction === 'escape'"
            @click="onDirectionChange('escape')"
          >
            Escape
          </button>
          <button
            type="button"
            class="html__mode-opt"
            :class="{ 'html__mode-opt--active': direction === 'unescape' }"
            :aria-pressed="direction === 'unescape'"
            @click="onDirectionChange('unescape')"
          >
            Unescape
          </button>
        </div>
      </div>

      <div class="html__mode-row">
        <span class="html__label">Entities</span>
        <div class="html__mode-toggle">
          <button
            type="button"
            class="html__mode-opt"
            :class="{ 'html__mode-opt--active': mode === 'named' }"
            :aria-pressed="mode === 'named'"
            title="Named entities: &amp; &lt; &gt; &quot; &#39;"
            @click="onModeChange('named')"
          >
            <Code :size="13" />
            <span>Named</span>
          </button>
          <button
            type="button"
            class="html__mode-opt"
            :class="{ 'html__mode-opt--active': mode === 'numeric' }"
            :aria-pressed="mode === 'numeric'"
            title="Numeric decimal entities: &#38; &#60; &#62; &#34; &#39;"
            @click="onModeChange('numeric')"
          >
            <Hash :size="13" />
            <span>Numeric</span>
          </button>
        </div>
      </div>

      <label class="html__field">
        <span class="html__label">{{ inputLabel }}</span>
        <textarea
          class="html__textarea html__textarea--mono"
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
      :description="outputs ? `Result (${outputs.outputBytes} bytes out)` : 'Enter a value above to convert.'"
      :copy-text="outputs?.output ?? ''"
      copy-label="Copy result"
    >
      <p v-if="error" class="html__error">
        <AlertCircle :size="14" />
        <span>{{ error }}</span>
      </p>
      <template v-else>
        <p v-if="!outputs" class="html__empty">
          Enter a value above to convert.
        </p>
        <div v-if="outputs" class="html__result">
          <div class="html__result-head">
            <span class="html__result-label">{{ outputLabel }}</span>
            <CopyButton :text="outputs.output" label="Copy" icon-only />
          </div>
          <code class="html__code">{{ outputs.output || '—' }}</code>
          <div class="html__meta">
            <span>{{ outputs.inputBytes }} bytes in</span>
            <span class="html__dot">·</span>
            <span>{{ outputs.outputBytes }} bytes out</span>
          </div>
        </div>
      </template>
    </ToolOutput>
  </div>
</template>

<style scoped>
.html {
  display: flex;
  flex-direction: column;
  gap: var(--qt-gap);
  max-width: var(--qt-max-content);
  margin: 0 auto;
}
.html__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.html__label {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--qt-muted);
}
.html__textarea {
  width: 100%;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  color: var(--qt-text);
  font: inherit;
  font-size: 14px;
  padding: 10px 12px;
  resize: vertical;
  min-height: 120px;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;
  will-change: border-color;
}
.html__textarea--mono {
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
}
.html__textarea:focus {
  border-color: var(--qt-accent);
  outline: none;
  box-shadow: 0 0 0 2px oklch(from var(--qt-accent) 90% c h / 0.25);
}
.html__mode-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
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
  will-change: color, background;
}
.html__mode-opt--active {
  color: var(--qt-bg);
  background: var(--qt-accent);
}
.html__btn {
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
.html__btn:hover:not(:disabled) {
  transform: translateY(-1px);
}
.html__btn:active:not(:disabled) {
  transform: translateY(0);
}
.html__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.html__btn--ghost {
  background: transparent;
  color: var(--qt-text);
  border-color: var(--qt-border);
}
.html__btn--ghost:hover:not(:disabled) {
  border-color: var(--qt-accent);
  color: var(--qt-accent);
}
.html__error {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: var(--qt-danger);
  font-size: 13.5px;
}
.html__empty {
  margin: 0;
  color: var(--qt-muted);
  font-size: 13.5px;
}
.html__result {
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.html__result-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.html__result-label {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--qt-text);
  flex: 1;
}
.html__code {
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
  font-size: 14px;
  color: var(--qt-text);
  word-break: break-all;
  white-space: pre-wrap;
}
.html__meta {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--qt-muted);
}
.html__dot {
  opacity: 0.6;
}
</style>
