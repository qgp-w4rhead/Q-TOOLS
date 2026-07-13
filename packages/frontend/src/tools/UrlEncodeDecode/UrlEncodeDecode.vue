<script setup lang="ts">
/**
 * UrlEncodeDecode — percent-encode and decode URL strings.
 *
 * Bidirectional: text → percent-encoded (encode) and percent-encoded → text
 * (decode). Two scopes:
 *
 * - **Component** — `encodeURIComponent` / `decodeURIComponent`. Escapes
 *   everything except `A-Za-z0-9-_.!~*'()`. Use for query values, path
 *   segments, or any single URI component.
 * - **Full URI** — `encodeURI` / `decodeURI`. Preserves the reserved URI
 *   delimiters `;,/?:@&=+$#` so a complete URL keeps its structure.
 *
 * No external dependencies.
 *
 * Works in embed mode: receives `input` PostMessages to pre-fill the input,
 * select the direction, and choose the scope; sends `output` PostMessages
 * whenever the computed output changes.
 */
import { computed } from 'vue';
import { AlertCircle, ArrowLeftRight, RefreshCw, Link, Globe } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import CopyButton from '@/components/CopyButton.vue';
import {
  useUrlEncodeDecode,
  type UrlDirection,
  type UrlScope,
} from './useUrlEncodeDecode';

const {
  input,
  direction,
  scope,
  outputs,
  error,
  recompute,
  setDirection,
  setScope,
  swap,
} = useUrlEncodeDecode();

const placeholder = computed(() =>
  direction.value === 'encode'
    ? 'Enter text to percent-encode…'
    : 'Enter percent-encoded text to decode…',
);

const inputLabel = computed(() => (direction.value === 'encode' ? 'Text' : 'Encoded'));
const outputLabel = computed(() =>
  direction.value === 'encode' ? 'Percent-encoded' : 'Text',
);

const description = computed(() => {
  const scopeText =
    scope.value === 'component'
      ? 'Component scope (encodeURIComponent) — escapes all reserved chars.'
      : 'Full URI scope (encodeURI) — preserves ;,/?:@&=+$# delimiters.';
  return direction.value === 'encode'
    ? `Encode text to percent-encoding. ${scopeText}`
    : `Decode percent-encoded text. ${scopeText}`;
});

function onTextInput(e: Event): void {
  input.value = (e.target as HTMLTextAreaElement).value;
}

function onDirectionChange(d: UrlDirection): void {
  setDirection(d);
}

function onScopeChange(s: UrlScope): void {
  setScope(s);
}
</script>

<template>
  <div class="url">
    <ToolInput title="Input" :description="description">
      <template #actions>
        <button
          class="url__btn url__btn--ghost"
          type="button"
          title="Swap direction and feed the result back as input"
          @click="swap"
        >
          <ArrowLeftRight :size="14" />
          <span>Swap</span>
        </button>
        <button
          class="url__btn"
          type="button"
          :disabled="input.trim().length === 0"
          @click="recompute"
        >
          <RefreshCw :size="14" />
          <span>Convert</span>
        </button>
      </template>

      <div class="url__mode-row">
        <span class="url__label">Direction</span>
        <div class="url__mode-toggle">
          <button
            type="button"
            class="url__mode-opt"
            :class="{ 'url__mode-opt--active': direction === 'encode' }"
            :aria-pressed="direction === 'encode'"
            @click="onDirectionChange('encode')"
          >
            Encode
          </button>
          <button
            type="button"
            class="url__mode-opt"
            :class="{ 'url__mode-opt--active': direction === 'decode' }"
            :aria-pressed="direction === 'decode'"
            @click="onDirectionChange('decode')"
          >
            Decode
          </button>
        </div>
      </div>

      <div class="url__scope-row">
        <span class="url__label">Scope</span>
        <div class="url__scope-toggle">
          <button
            type="button"
            class="url__scope-opt"
            :class="{ 'url__scope-opt--active': scope === 'component' }"
            :aria-pressed="scope === 'component'"
            title="encodeURIComponent — escapes all reserved characters"
            @click="onScopeChange('component')"
          >
            <Link :size="13" />
            <span>Component</span>
          </button>
          <button
            type="button"
            class="url__scope-opt"
            :class="{ 'url__scope-opt--active': scope === 'uri' }"
            :aria-pressed="scope === 'uri'"
            title="encodeURI — preserves ;,/?:@&=+$# delimiters"
            @click="onScopeChange('uri')"
          >
            <Globe :size="13" />
            <span>Full URI</span>
          </button>
        </div>
      </div>

      <label class="url__field">
        <span class="url__label">{{ inputLabel }}</span>
        <textarea
          class="url__textarea url__textarea--mono"
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
      <p v-if="error" class="url__error">
        <AlertCircle :size="14" />
        <span>{{ error }}</span>
      </p>
      <template v-else>
        <p v-if="!outputs" class="url__empty">
          Enter a value above to convert.
        </p>
        <div v-if="outputs" class="url__result">
          <div class="url__result-head">
            <span class="url__result-label">{{ outputLabel }}</span>
            <CopyButton :text="outputs.output" label="Copy" icon-only />
          </div>
          <code class="url__code">{{ outputs.output || '—' }}</code>
          <div class="url__meta">
            <span>{{ outputs.inputBytes }} bytes in</span>
            <span class="url__dot">·</span>
            <span>{{ outputs.outputBytes }} bytes out</span>
          </div>
        </div>
      </template>
    </ToolOutput>
  </div>
</template>

<style scoped>
.url {
  display: flex;
  flex-direction: column;
  gap: var(--qt-gap);
  max-width: var(--qt-max-content);
  margin: 0 auto;
}
.url__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.url__label {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--qt-muted);
}
.url__textarea {
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
.url__textarea--mono {
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
}
.url__textarea:focus {
  border-color: var(--qt-accent);
  outline: none;
  box-shadow: 0 0 0 2px oklch(from var(--qt-accent) 90% c h / 0.25);
}
.url__mode-row,
.url__scope-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.url__mode-toggle,
.url__scope-toggle {
  display: inline-flex;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: 999px;
  padding: 3px;
}
.url__mode-opt,
.url__scope-opt {
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
.url__mode-opt--active,
.url__scope-opt--active {
  color: var(--qt-bg);
  background: var(--qt-accent);
}
.url__btn {
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
.url__btn:hover:not(:disabled) {
  transform: translateY(-1px);
}
.url__btn:active:not(:disabled) {
  transform: translateY(0);
}
.url__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.url__btn--ghost {
  background: transparent;
  color: var(--qt-text);
  border-color: var(--qt-border);
}
.url__btn--ghost:hover:not(:disabled) {
  border-color: var(--qt-accent);
  color: var(--qt-accent);
}
.url__error {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: var(--qt-danger);
  font-size: 13.5px;
}
.url__empty {
  margin: 0;
  color: var(--qt-muted);
  font-size: 13.5px;
}
.url__result {
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.url__result-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.url__result-label {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--qt-text);
  flex: 1;
}
.url__code {
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
  font-size: 14px;
  color: var(--qt-text);
  word-break: break-all;
  white-space: pre-wrap;
}
.url__meta {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--qt-muted);
}
.url__dot {
  opacity: 0.6;
}
</style>
