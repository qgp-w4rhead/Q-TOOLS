<script setup lang="ts">
/**
 * UrlParser — parse a URL into its components and rebuild it.
 *
 * Uses the native `URL` API (no external dependencies). The user pastes a
 * URL (scheme is optional — `example.com/path` is auto-prepended with
 * `https://`). The tool displays each component (protocol, userinfo,
 * hostname, port, pathname, hash) in an editable field, plus the query
 * parameters as an editable key/value table. The rebuilt URL is shown live
 * and can be fed back into the input.
 *
 * Works in embed mode: receives `input` PostMessages to pre-fill the URL,
 * sends `output` PostMessages with `{ url, valid }` whenever the rebuilt URL
 * changes.
 */
import { computed } from 'vue';
import {
  AlertCircle,
  ArrowUp,
  ArrowDown,
  Plus,
  Trash2,
  RefreshCw,
  RotateCcw,
  Link as LinkIcon,
} from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import CopyButton from '@/components/CopyButton.vue';
import {
  useUrlParser,
  type ParsedUrl,
} from './useUrlParser';

const {
  input,
  parsed,
  error,
  rebuilt,
  rebuiltValid,
  recompute,
  setComponent,
  updateQueryParam,
  addQueryParam,
  removeQueryParam,
  moveQueryParamUp,
  moveQueryParamDown,
  applyRebuilt,
} = useUrlParser();

const hasParsed = computed(() => parsed.value !== null);
const queryParams = computed(() => parsed.value?.searchParams ?? []);

function onTextInput(e: Event): void {
  input.value = (e.target as HTMLTextAreaElement).value;
}

function onFieldInput(
  field: keyof Omit<ParsedUrl, 'searchParams' | 'origin'>,
  e: Event,
): void {
  setComponent(field, (e.target as HTMLInputElement).value);
}

function onParamKeyInput(id: number, e: Event): void {
  updateQueryParam(id, { key: (e.target as HTMLInputElement).value });
}

function onParamValueInput(id: number, e: Event): void {
  updateQueryParam(id, { value: (e.target as HTMLInputElement).value });
}

const componentFields: Array<{
  key: keyof Omit<ParsedUrl, 'searchParams' | 'origin'>;
  label: string;
  placeholder: string;
  mono?: boolean;
}> = [
  { key: 'protocol', label: 'Protocol', placeholder: 'https:' },
  { key: 'username', label: 'Username', placeholder: 'user' },
  { key: 'password', label: 'Password', placeholder: 'pass' },
  { key: 'hostname', label: 'Hostname', placeholder: 'example.com' },
  { key: 'port', label: 'Port', placeholder: '443' },
  { key: 'pathname', label: 'Path', placeholder: '/path/to/resource', mono: true },
  { key: 'hash', label: 'Hash', placeholder: '#section', mono: true },
];
</script>

<template>
  <div class="urlp">
    <ToolInput
      title="Input URL"
      description="Paste a URL to parse. Scheme is optional — bare hosts are auto-prepended with https://."
    >
      <template #actions>
        <button
          class="urlp__btn"
          type="button"
          :disabled="input.trim().length === 0"
          @click="recompute"
        >
          <RefreshCw :size="14" />
          <span>Parse</span>
        </button>
      </template>

      <label class="urlp__field">
        <textarea
          class="urlp__textarea urlp__textarea--mono"
          placeholder="https://user:pass@example.com:8080/path/to/page?name=ferret&color=black#section"
          :value="input"
          rows="3"
          spellcheck="false"
          autocomplete="off"
          @input="onTextInput"
        />
      </label>
    </ToolInput>

    <p v-if="error" class="urlp__error">
      <AlertCircle :size="14" />
      <span>{{ error }}</span>
    </p>

    <div v-if="hasParsed && parsed" class="urlp__components">
      <div class="urlp__section-head">
        <LinkIcon :size="14" />
        <span>Components</span>
      </div>
      <div class="urlp__grid">
        <label
          v-for="field in componentFields"
          :key="field.key"
          class="urlp__cell"
        >
          <span class="urlp__cell-label">{{ field.label }}</span>
          <input
            type="text"
            class="urlp__input"
            :class="{ 'urlp__input--mono': field.mono }"
            :placeholder="field.placeholder"
            :value="(parsed as ParsedUrl)[field.key]"
            spellcheck="false"
            autocomplete="off"
            @input="onFieldInput(field.key, $event)"
          />
        </label>
      </div>

      <div class="urlp__origin">
        <span class="urlp__cell-label">Origin</span>
        <code class="urlp__origin-code">{{ parsed.origin || '—' }}</code>
      </div>
    </div>

    <div v-if="hasParsed && parsed" class="urlp__query">
      <div class="urlp__section-head">
        <span>Query parameters</span>
        <button
          class="urlp__btn urlp__btn--ghost urlp__btn--sm"
          type="button"
          @click="addQueryParam"
        >
          <Plus :size="13" />
          <span>Add</span>
        </button>
      </div>

      <p v-if="queryParams.length === 0" class="urlp__empty">
        No query parameters.
      </p>

      <div v-else class="urlp__table">
        <div class="urlp__row urlp__row--head">
          <span class="urlp__row-key">Key</span>
          <span class="urlp__row-val">Value</span>
          <span class="urlp__row-actions"></span>
        </div>
        <div
          v-for="(param, idx) in queryParams"
          :key="param.id"
          class="urlp__row"
        >
          <input
            type="text"
            class="urlp__input urlp__input--mono urlp__row-key"
            placeholder="key"
            :value="param.key"
            spellcheck="false"
            autocomplete="off"
            @input="onParamKeyInput(param.id, $event)"
          />
          <input
            type="text"
            class="urlp__input urlp__input--mono urlp__row-val"
            placeholder="value"
            :value="param.value ?? ''"
            spellcheck="false"
            autocomplete="off"
            @input="onParamValueInput(param.id, $event)"
          />
          <div class="urlp__row-actions">
            <button
              class="urlp__icon-btn"
              type="button"
              title="Move up"
              :disabled="idx === 0"
              @click="moveQueryParamUp(param.id)"
            >
              <ArrowUp :size="13" />
            </button>
            <button
              class="urlp__icon-btn"
              type="button"
              title="Move down"
              :disabled="idx === queryParams.length - 1"
              @click="moveQueryParamDown(param.id)"
            >
              <ArrowDown :size="13" />
            </button>
            <button
              class="urlp__icon-btn urlp__icon-btn--danger"
              type="button"
              title="Remove"
              @click="removeQueryParam(param.id)"
            >
              <Trash2 :size="13" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <ToolOutput
      v-if="hasParsed"
      title="Rebuilt URL"
      :description="rebuiltValid ? 'Live-rebuilt from the edited components.' : 'Current components do not form a valid URL.'"
      :copy-text="rebuilt"
      copy-label="Copy URL"
    >
      <template #actions>
        <button
          class="urlp__btn urlp__btn--ghost"
          type="button"
          :disabled="!rebuiltValid"
          title="Feed the rebuilt URL back into the input"
          @click="applyRebuilt"
        >
          <RotateCcw :size="14" />
          <span>Feed back</span>
        </button>
      </template>

      <p v-if="!rebuiltValid" class="urlp__error">
        <AlertCircle :size="14" />
        <span>The edited components do not form a valid URL.</span>
      </p>
      <div v-else class="urlp__result">
        <div class="urlp__result-head">
          <code class="urlp__code">{{ rebuilt }}</code>
          <CopyButton :text="rebuilt" label="Copy" icon-only />
        </div>
      </div>
    </ToolOutput>
  </div>
</template>

<style scoped>
.urlp {
  display: flex;
  flex-direction: column;
  gap: var(--qt-gap);
  max-width: var(--qt-max-content);
  margin: 0 auto;
}
.urlp__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.urlp__textarea {
  width: 100%;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  color: var(--qt-text);
  font: inherit;
  font-size: 14px;
  padding: 10px 12px;
  resize: vertical;
  min-height: 72px;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;
  will-change: border-color;
}
.urlp__textarea--mono,
.urlp__input--mono {
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
}
.urlp__textarea:focus,
.urlp__input:focus {
  border-color: var(--qt-accent);
  outline: none;
  box-shadow: 0 0 0 2px oklch(from var(--qt-accent) 90% c h / 0.25);
}
.urlp__btn {
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
.urlp__btn:hover:not(:disabled) {
  transform: translateY(-1px);
}
.urlp__btn:active:not(:disabled) {
  transform: translateY(0);
}
.urlp__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.urlp__btn--ghost {
  background: transparent;
  color: var(--qt-text);
  border-color: var(--qt-border);
}
.urlp__btn--ghost:hover:not(:disabled) {
  border-color: var(--qt-accent);
  color: var(--qt-accent);
}
.urlp__btn--sm {
  padding: 4px 9px;
  font-size: 12px;
}
.urlp__error {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: var(--qt-danger);
  font-size: 13.5px;
}
.urlp__empty {
  margin: 0;
  color: var(--qt-muted);
  font-size: 13.5px;
}
.urlp__components,
.urlp__query {
  background: var(--qt-surface);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius);
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.urlp__section-head {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 700;
  color: var(--qt-text);
}
.urlp__section-head span {
  flex: 1;
}
.urlp__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 10px 12px;
}
.urlp__cell {
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.urlp__cell-label {
  font-size: 11.5px;
  font-weight: 600;
  color: var(--qt-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.urlp__input {
  width: 100%;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  color: var(--qt-text);
  font: inherit;
  font-size: 13.5px;
  padding: 7px 10px;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;
  will-change: border-color;
}
.urlp__origin {
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.urlp__origin-code {
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
  font-size: 13px;
  color: var(--qt-text);
  word-break: break-all;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  padding: 7px 10px;
}
.urlp__table {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.urlp__row {
  display: grid;
  grid-template-columns: 1fr 1fr auto;
  gap: 8px;
  align-items: center;
}
.urlp__row--head {
  font-size: 11.5px;
  font-weight: 600;
  color: var(--qt-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 0 4px;
}
.urlp__row-actions {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.urlp__icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  background: transparent;
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  color: var(--qt-muted);
  cursor: pointer;
  transition:
    color 0.15s ease,
    border-color 0.15s ease;
  will-change: color, border-color;
}
.urlp__icon-btn:hover:not(:disabled) {
  color: var(--qt-accent);
  border-color: var(--qt-accent);
}
.urlp__icon-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.urlp__icon-btn--danger:hover:not(:disabled) {
  color: var(--qt-danger);
  border-color: var(--qt-danger);
}
.urlp__result {
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  padding: 8px 10px;
}
.urlp__result-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.urlp__code {
  flex: 1;
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
  font-size: 14px;
  color: var(--qt-text);
  word-break: break-all;
}
</style>
