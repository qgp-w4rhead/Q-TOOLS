<script setup lang="ts">
/**
 * UrlEncodeDecode - percent-encode and decode URL strings.
 *
 * Bidirectional: text → percent-encoded (encode) and percent-encoded → text
 * (decode). Two scopes:
 *
 * - **Component** - `encodeURIComponent` / `decodeURIComponent`. Escapes
 *   everything except `A-Za-z0-9-_.!~*'()`. Use for query values, path
 *   segments, or any single URI component.
 * - **Full URI** - `encodeURI` / `decodeURI`. Preserves the reserved URI
 *   delimiters `;,/?:@&=+$#` so a complete URL keeps its structure.
 *
 * No external dependencies.
 *
 * Works in embed mode: receives `input` PostMessages to pre-fill the input,
 * select the direction, and choose the scope; sends `output` PostMessages
 * whenever the computed output changes.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
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

const { t } = useI18n();
const U = 'tools.url-encode-decode.ui.';

const placeholder = computed(() =>
  direction.value === 'encode' ? t(U + 'placeholderEncode') : t(U + 'placeholderDecode'),
);

const inputLabel = computed(() =>
  direction.value === 'encode' ? t('common.text') : t(U + 'labelEncoded'),
);
const outputLabel = computed(() =>
  direction.value === 'encode' ? t(U + 'labelPercentEncoded') : t('common.text'),
);

const description = computed(() => {
  const scopeText =
    scope.value === 'component' ? t(U + 'descScopeComponent') : t(U + 'descScopeUri');
  return direction.value === 'encode'
    ? t(U + 'descEncode', { scope: scopeText })
    : t(U + 'descDecode', { scope: scopeText });
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
        <div class="url__mode-toggle">
          <button
            type="button"
            class="url__mode-opt"
            :class="{ 'url__mode-opt--active': direction === 'encode' }"
            :aria-pressed="direction === 'encode'"
            @click="onDirectionChange('encode')"
          >
            {{ t('common.encode') }}
          </button>
          <button
            type="button"
            class="url__mode-opt"
            :class="{ 'url__mode-opt--active': direction === 'decode' }"
            :aria-pressed="direction === 'decode'"
            @click="onDirectionChange('decode')"
          >
            {{ t('common.decode') }}
          </button>
        </div>
      </div>

      <div class="qt-row qt-row--center" style="--qt-row-gap:10px">
        <span class="qt-label">{{ t(U + 'scope') }}</span>
        <div class="url__scope-toggle">
          <button
            type="button"
            class="url__scope-opt"
            :class="{ 'url__scope-opt--active': scope === 'component' }"
            :aria-pressed="scope === 'component'"
            :title="t(U + 'scopeComponentTitle')"
            @click="onScopeChange('component')"
          >
            <Link :size="13" />
            <span>{{ t(U + 'scopeComponent') }}</span>
          </button>
          <button
            type="button"
            class="url__scope-opt"
            :class="{ 'url__scope-opt--active': scope === 'uri' }"
            :aria-pressed="scope === 'uri'"
            :title="t(U + 'scopeUriTitle')"
            @click="onScopeChange('uri')"
          >
            <Globe :size="13" />
            <span>{{ t(U + 'scopeUri') }}</span>
          </button>
        </div>
      </div>

      <label class="qt-field">
        <span class="qt-label">{{ inputLabel }}</span>
        <textarea
          class="qt-input qt-input--mono url__textarea"
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
          <code class="qt-mono url__code">{{ outputs.output || '-' }}</code>
          <div class="qt-row qt-row--center qt-hint" style="--qt-row-gap:6px">
            <span>{{ t(U + 'bytesIn', outputs.inputBytes) }}</span>
            <span class="url__dot">·</span>
            <span>{{ t(U + 'bytesOut', outputs.outputBytes) }}</span>
          </div>
        </div>
      </template>
    </ToolOutput>
  </div>
</template>

<style scoped>
/* Kept scoped: patterns unique to this tool (no generic utility). */

/* Direction + scope pill segmented controls (solid-accent active). */
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
}
.url__mode-opt--active,
.url__scope-opt--active {
  color: var(--qt-bg);
  background: var(--qt-accent);
}
/* Input textarea floor (control + mono via .qt-input--mono). */
.url__textarea {
  min-height: 120px;
}
/* Output code (font via .qt-mono) — break-anywhere, pre-wrapped. */
.url__code {
  font-size: 14px;
  color: var(--qt-text);
  word-break: break-all;
  white-space: pre-wrap;
}
/* Meta separator dot. */
.url__dot {
  opacity: 0.6;
}
</style>
