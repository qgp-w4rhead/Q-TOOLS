<script setup lang="ts">
/**
 * MarkdownToHtml - render Markdown to sanitized HTML.
 *
 * Uses `marked` (initial bundle, statically imported in the composable) to
 * parse Markdown, then optionally runs the DOMParser-based allowlist
 * sanitizer to strip dangerous tags/attributes. A live HTML preview is
 * rendered alongside the raw HTML source.
 *
 * Options: GFM (GitHub-Flavoured Markdown), breaks (single `\n` → `<br>`),
 * sanitize (strip unsafe tags/attrs).
 *
 * Works in embed mode: receives `input` PostMessages to pre-fill the
 * Markdown and option overrides, and sends `output` PostMessages whenever
 * the computed HTML changes.
 */
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { AlertCircle, RefreshCw, Eye, Code2 } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import CopyButton from '@/components/CopyButton.vue';
import { useMarkdownToHtml } from './useMarkdownToHtml';

const {
  input,
  gfm,
  breaks,
  sanitize,
  outputs,
  error,
  recompute,
  setGfm,
  setBreaks,
  setSanitize,
} = useMarkdownToHtml();

const { t } = useI18n();
const U = 'tools.markdown-to-html.ui.';

const description = computed(() => t(U + 'desc'));

const viewMode = ref<'preview' | 'source'>('preview');

const errorLocation = computed(() => {
  if (!error.value) return '';
  return '';
});

function onTextInput(e: Event): void {
  input.value = (e.target as HTMLTextAreaElement).value;
}

function onGfmToggle(e: Event): void {
  setGfm((e.target as HTMLInputElement).checked);
}

function onBreaksToggle(e: Event): void {
  setBreaks((e.target as HTMLInputElement).checked);
}

function onSanitizeToggle(e: Event): void {
  setSanitize((e.target as HTMLInputElement).checked);
}

function setView(mode: 'preview' | 'source'): void {
  viewMode.value = mode;
}
</script>

<template>
  <div class="qt-tool">
    <ToolInput :title="t(U + 'inputTitle')" :description="description">
      <template #actions>
        <button
          class="qt-btn qt-btn--primary"
          type="button"
          :disabled="input.trim().length === 0"
          @click="recompute"
        >
          <RefreshCw :size="14" />
          <span>{{ t(U + 'render') }}</span>
        </button>
      </template>

      <div class="qt-row qt-row--center" style="--qt-row-gap:16px">
        <label class="qt-check">
          <input
            type="checkbox"
            :checked="gfm"
            @change="onGfmToggle"
          />
          <span>{{ t(U + 'gfm') }}</span>
        </label>

        <label class="qt-check">
          <input
            type="checkbox"
            :checked="breaks"
            :disabled="!gfm"
            @change="onBreaksToggle"
          />
          <span>{{ t(U + 'breaks') }}</span>
        </label>

        <label class="qt-check">
          <input
            type="checkbox"
            :checked="sanitize"
            @change="onSanitizeToggle"
          />
          <span>{{ t(U + 'sanitize') }}</span>
        </label>
      </div>

      <label class="qt-field">
        <span class="qt-label">{{ t(U + 'markdownLabel') }}</span>
        <textarea
          class="qt-input qt-input--mono m2h__textarea"
          :placeholder="t(U + 'placeholder')"
          :value="input"
          rows="12"
          spellcheck="false"
          autocomplete="off"
          @input="onTextInput"
        />
      </label>
    </ToolInput>

    <ToolOutput
      :title="t(U + 'outputTitle')"
      :description="outputs ? t(U + 'outputDesc', { n: outputs.outputBytes }) : t(U + 'empty')"
      :copy-text="outputs?.html ?? ''"
      :copy-label="t(U + 'copyHtml')"
    >
      <p v-if="error" class="qt-alert qt-alert--error">
        <AlertCircle :size="14" />
        <span>
          <strong v-if="errorLocation">{{ errorLocation }}:</strong>
          {{ error.message }}
        </span>
      </p>
      <template v-else>
        <p v-if="!outputs" class="qt-alert qt-alert--empty">
          {{ t(U + 'empty') }}
        </p>
        <div v-if="outputs" class="qt-result">
          <div class="qt-row qt-row--center qt-row--between qt-row--nowrap" style="--qt-row-gap:8px">
            <div class="m2h__tabs">
              <button
                class="m2h__tab"
                :class="{ 'm2h__tab--active': viewMode === 'preview' }"
                type="button"
                @click="setView('preview')"
              >
                <Eye :size="14" />
                <span>{{ t(U + 'preview') }}</span>
              </button>
              <button
                class="m2h__tab"
                :class="{ 'm2h__tab--active': viewMode === 'source' }"
                type="button"
                @click="setView('source')"
              >
                <Code2 :size="14" />
                <span>{{ t(U + 'source') }}</span>
              </button>
            </div>
            <CopyButton :text="outputs.html" :label="t('common.copy')" icon-only />
          </div>

          <div v-if="viewMode === 'preview'" class="m2h__preview" v-html="outputs.html" />
          <pre v-else class="qt-mono m2h__code">{{ outputs.html }}</pre>

          <div class="qt-row qt-row--center qt-hint" style="--qt-row-gap:6px">
            <span>{{ t(U + 'bytesIn', { n: outputs.inputBytes }) }}</span>
            <span class="m2h__dot">·</span>
            <span>{{ t(U + 'bytesOut', { n: outputs.outputBytes }) }}</span>
            <span v-if="sanitize" class="m2h__dot">·</span>
            <span v-if="sanitize">{{ t(U + 'sanitized') }}</span>
          </div>
        </div>
      </template>
    </ToolOutput>
  </div>
</template>

<style scoped>
/* Kept scoped: patterns unique to this tool (no generic utility). */

/* Input textarea floor (control + mono via .qt-input--mono). */
.m2h__textarea {
  min-height: 220px;
}
/* Preview/source tab toggle (borderless). */
.m2h__tabs {
  display: flex;
  gap: 4px;
  flex: 1;
}
.m2h__tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--qt-radius-sm);
  color: var(--qt-muted);
  font: inherit;
  font-size: 12.5px;
  font-weight: 600;
  padding: 5px 10px;
  cursor: pointer;
  transition:
    color 0.15s ease,
    background-color 0.15s ease,
    border-color 0.15s ease;
}
.m2h__tab:hover {
  color: var(--qt-text);
}
.m2h__tab--active {
  color: var(--qt-text);
  background: var(--qt-surface);
  border-color: var(--qt-border);
}
/* HTML source block (font via .qt-mono) — scrollable, pre-wrapped. */
.m2h__code {
  font-size: 13.5px;
  color: var(--qt-text);
  white-space: pre-wrap;
  word-break: break-word;
  margin: 0;
  max-height: 60vh;
  overflow: auto;
}
/* Meta separator dot. */
.m2h__dot {
  opacity: 0.6;
}

/* Live HTML preview - render Markdown output with readable typography. */
.m2h__preview {
  color: var(--qt-text);
  font-size: 14px;
  line-height: 1.6;
  max-height: 60vh;
  overflow: auto;
  padding: 4px 6px;
  word-wrap: break-word;
}
.m2h__preview :deep(h1),
.m2h__preview :deep(h2),
.m2h__preview :deep(h3),
.m2h__preview :deep(h4),
.m2h__preview :deep(h5),
.m2h__preview :deep(h6) {
  margin: 1em 0 0.5em;
  line-height: 1.25;
  font-weight: 700;
  color: var(--qt-text);
}
.m2h__preview :deep(h1) { font-size: 1.7em; }
.m2h__preview :deep(h2) { font-size: 1.5em; }
.m2h__preview :deep(h3) { font-size: 1.3em; }
.m2h__preview :deep(h4) { font-size: 1.15em; }
.m2h__preview :deep(h5) { font-size: 1.05em; }
.m2h__preview :deep(h6) { font-size: 1em; color: var(--qt-muted); }
.m2h__preview :deep(p) {
  margin: 0.6em 0;
}
.m2h__preview :deep(a) {
  color: var(--qt-accent);
  text-decoration: underline;
  text-underline-offset: 2px;
}
.m2h__preview :deep(a:hover) {
  text-decoration-thickness: 2px;
}
.m2h__preview :deep(ul),
.m2h__preview :deep(ol) {
  margin: 0.6em 0;
  padding-left: 1.6em;
}
.m2h__preview :deep(li) {
  margin: 0.25em 0;
}
.m2h__preview :deep(li > input[type='checkbox']) {
  margin-right: 6px;
  accent-color: var(--qt-accent);
}
.m2h__preview :deep(blockquote) {
  margin: 0.8em 0;
  padding: 0.2em 1em;
  border-left: 3px solid var(--qt-accent);
  color: var(--qt-muted);
  background: oklch(from var(--qt-surface) 95% c h / 0.5);
}
.m2h__preview :deep(blockquote p) {
  margin: 0.4em 0;
}
.m2h__preview :deep(code) {
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
  font-size: 0.9em;
  background: var(--qt-surface);
  border: 1px solid var(--qt-border);
  border-radius: 4px;
  padding: 0.1em 0.35em;
}
.m2h__preview :deep(pre) {
  margin: 0.8em 0;
  padding: 0.8em 1em;
  background: var(--qt-surface);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  overflow: auto;
}
.m2h__preview :deep(pre code) {
  background: transparent;
  border: none;
  padding: 0;
  font-size: 13px;
  line-height: 1.5;
}
.m2h__preview :deep(hr) {
  border: none;
  border-top: 1px solid var(--qt-border);
  margin: 1.2em 0;
}
.m2h__preview :deep(img) {
  max-width: 100%;
  height: auto;
  border-radius: var(--qt-radius-sm);
}
.m2h__preview :deep(table) {
  border-collapse: collapse;
  width: 100%;
  margin: 0.8em 0;
  font-size: 13.5px;
}
.m2h__preview :deep(th),
.m2h__preview :deep(td) {
  border: 1px solid var(--qt-border);
  padding: 6px 10px;
  text-align: left;
}
.m2h__preview :deep(th) {
  background: var(--qt-surface);
  font-weight: 700;
}
.m2h__preview :deep(em) { font-style: italic; }
.m2h__preview :deep(strong) { font-weight: 700; }
.m2h__preview :deep(del) { text-decoration: line-through; color: var(--qt-muted); }
.m2h__preview :deep(kbd) {
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
  font-size: 0.85em;
  background: var(--qt-surface);
  border: 1px solid var(--qt-border);
  border-bottom-width: 2px;
  border-radius: 4px;
  padding: 0.1em 0.4em;
}
</style>
