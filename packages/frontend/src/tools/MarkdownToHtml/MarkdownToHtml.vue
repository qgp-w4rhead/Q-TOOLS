<script setup lang="ts">
/**
 * MarkdownToHtml — render Markdown to sanitized HTML.
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

const description = computed(() =>
  'Render Markdown to HTML with marked. GFM enables tables, strikethrough, and task lists; breaks converts single newlines to <br>; sanitize strips unsafe tags and attributes.',
);

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
  <div class="m2h">
    <ToolInput title="Markdown input" :description="description">
      <template #actions>
        <button
          class="m2h__btn"
          type="button"
          :disabled="input.trim().length === 0"
          @click="recompute"
        >
          <RefreshCw :size="14" />
          <span>Render</span>
        </button>
      </template>

      <div class="m2h__opts">
        <label class="m2h__opt m2h__opt--check">
          <input
            class="m2h__checkbox"
            type="checkbox"
            :checked="gfm"
            @change="onGfmToggle"
          />
          <span class="m2h__label">GFM</span>
        </label>

        <label class="m2h__opt m2h__opt--check">
          <input
            class="m2h__checkbox"
            type="checkbox"
            :checked="breaks"
            :disabled="!gfm"
            @change="onBreaksToggle"
          />
          <span class="m2h__label">Breaks</span>
        </label>

        <label class="m2h__opt m2h__opt--check">
          <input
            class="m2h__checkbox"
            type="checkbox"
            :checked="sanitize"
            @change="onSanitizeToggle"
          />
          <span class="m2h__label">Sanitize</span>
        </label>
      </div>

      <label class="m2h__field">
        <span class="m2h__label">Markdown</span>
        <textarea
          class="m2h__textarea m2h__textarea--mono"
          placeholder="# Hello&#10;&#10;Paste **Markdown** here…"
          :value="input"
          rows="12"
          spellcheck="false"
          autocomplete="off"
          @input="onTextInput"
        />
      </label>
    </ToolInput>

    <ToolOutput
      title="HTML output"
      :description="outputs ? `${outputs.outputBytes} bytes` : 'Paste Markdown above to render.'"
      :copy-text="outputs?.html ?? ''"
      copy-label="Copy HTML"
    >
      <p v-if="error" class="m2h__error">
        <AlertCircle :size="14" />
        <span>
          <strong v-if="errorLocation">{{ errorLocation }}:</strong>
          {{ error.message }}
        </span>
      </p>
      <template v-else>
        <p v-if="!outputs" class="m2h__empty">
          Paste Markdown above to render.
        </p>
        <div v-if="outputs" class="m2h__result">
          <div class="m2h__result-head">
            <div class="m2h__tabs">
              <button
                class="m2h__tab"
                :class="{ 'm2h__tab--active': viewMode === 'preview' }"
                type="button"
                @click="setView('preview')"
              >
                <Eye :size="14" />
                <span>Preview</span>
              </button>
              <button
                class="m2h__tab"
                :class="{ 'm2h__tab--active': viewMode === 'source' }"
                type="button"
                @click="setView('source')"
              >
                <Code2 :size="14" />
                <span>Source</span>
              </button>
            </div>
            <CopyButton :text="outputs.html" label="Copy" icon-only />
          </div>

          <div v-if="viewMode === 'preview'" class="m2h__preview" v-html="outputs.html" />
          <pre v-else class="m2h__code">{{ outputs.html }}</pre>

          <div class="m2h__meta">
            <span>{{ outputs.inputBytes }} bytes in</span>
            <span class="m2h__dot">·</span>
            <span>{{ outputs.outputBytes }} bytes out</span>
            <span v-if="sanitize" class="m2h__dot">·</span>
            <span v-if="sanitize">sanitized</span>
          </div>
        </div>
      </template>
    </ToolOutput>
  </div>
</template>

<style scoped>
.m2h {
  display: flex;
  flex-direction: column;
  gap: var(--qt-gap);
  max-width: var(--qt-max-content);
  margin: 0 auto;
}
.m2h__opts {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}
.m2h__opt--check {
  display: flex;
  align-items: center;
  gap: 8px;
}
.m2h__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.m2h__label {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--qt-muted);
}
.m2h__checkbox {
  width: 16px;
  height: 16px;
  accent-color: var(--qt-accent);
  cursor: pointer;
}
.m2h__checkbox:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.m2h__textarea {
  width: 100%;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  color: var(--qt-text);
  font: inherit;
  font-size: 14px;
  padding: 10px 12px;
  resize: vertical;
  min-height: 220px;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;
  will-change: border-color;
}
.m2h__textarea--mono {
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
}
.m2h__textarea:focus {
  border-color: var(--qt-accent);
  outline: none;
  box-shadow: 0 0 0 2px oklch(from var(--qt-accent) 90% c h / 0.25);
}
.m2h__btn {
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
.m2h__btn:hover:not(:disabled) {
  transform: translateY(-1px);
}
.m2h__btn:active:not(:disabled) {
  transform: translateY(0);
}
.m2h__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.m2h__error {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 0;
  color: var(--qt-danger);
  font-size: 13.5px;
  line-height: 1.4;
}
.m2h__error strong {
  margin-right: 4px;
}
.m2h__empty {
  margin: 0;
  color: var(--qt-muted);
  font-size: 13.5px;
}
.m2h__result {
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.m2h__result-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
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
  will-change: color, background-color;
}
.m2h__tab:hover {
  color: var(--qt-text);
}
.m2h__tab--active {
  color: var(--qt-text);
  background: var(--qt-surface);
  border-color: var(--qt-border);
}
.m2h__code {
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
  font-size: 13.5px;
  color: var(--qt-text);
  white-space: pre-wrap;
  word-break: break-word;
  margin: 0;
  max-height: 60vh;
  overflow: auto;
}
.m2h__meta {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--qt-muted);
  flex-wrap: wrap;
}
.m2h__dot {
  opacity: 0.6;
}

/* Live HTML preview — render Markdown output with readable typography. */
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
