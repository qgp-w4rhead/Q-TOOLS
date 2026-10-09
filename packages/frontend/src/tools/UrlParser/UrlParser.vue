<script setup lang="ts">
/**
 * UrlParser - parse a URL into its components and rebuild it.
 *
 * Uses the native `URL` API (no external dependencies). The user pastes a
 * URL (scheme is optional - `example.com/path` is auto-prepended with
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
import { useI18n } from 'vue-i18n';
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

const { t } = useI18n();
const U = 'tools.url-parser.ui.';

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
  labelKey: string;
  placeholder: string;
  mono?: boolean;
}> = [
  { key: 'protocol', labelKey: 'fieldProtocol', placeholder: 'https:' },
  { key: 'username', labelKey: 'fieldUsername', placeholder: 'user' },
  { key: 'password', labelKey: 'fieldPassword', placeholder: 'pass' },
  { key: 'hostname', labelKey: 'fieldHostname', placeholder: 'example.com' },
  { key: 'port', labelKey: 'fieldPort', placeholder: '443' },
  { key: 'pathname', labelKey: 'fieldPathname', placeholder: '/path/to/resource', mono: true },
  { key: 'hash', labelKey: 'fieldHash', placeholder: '#section', mono: true },
];
</script>

<template>
  <div class="qt-tool">
    <ToolInput
      :title="t(U + 'inputTitle')"
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
          <span>{{ t(U + 'parse') }}</span>
        </button>
      </template>

      <label class="qt-field">
        <textarea
          class="qt-input qt-input--mono urlp__textarea"
          placeholder="https://user:pass@example.com:8080/path/to/page?name=ferret&color=black#section"
          :value="input"
          rows="3"
          spellcheck="false"
          autocomplete="off"
          @input="onTextInput"
        />
      </label>
    </ToolInput>

    <p v-if="error" class="qt-alert qt-alert--error">
      <AlertCircle :size="14" />
      <span>{{ error }}</span>
    </p>

    <div v-if="hasParsed && parsed" class="qt-card qt-stack" style="--qt-stack-gap:12px">
      <div class="qt-row qt-row--center qt-row--nowrap urlp__section-head" style="--qt-row-gap:8px">
        <LinkIcon :size="14" />
        <span>{{ t(U + 'components') }}</span>
      </div>
      <div class="qt-grid" style="--qt-grid-min:180px;--qt-grid-gap:10px 12px">
        <label
          v-for="field in componentFields"
          :key="field.key"
          class="qt-field"
        >
          <span class="qt-stat-head">{{ t(U + field.labelKey) }}</span>
          <input
            type="text"
            class="qt-input urlp__input"
            :class="{ 'qt-input--mono': field.mono }"
            :placeholder="field.placeholder"
            :value="(parsed as ParsedUrl)[field.key]"
            spellcheck="false"
            autocomplete="off"
            @input="onFieldInput(field.key, $event)"
          />
        </label>
      </div>

      <div class="qt-field">
        <span class="qt-stat-head">{{ t(U + 'origin') }}</span>
        <code class="qt-mono urlp__origin-code">{{ parsed.origin || '-' }}</code>
      </div>
    </div>

    <div v-if="hasParsed && parsed" class="qt-card qt-stack" style="--qt-stack-gap:12px">
      <div class="qt-row qt-row--center qt-row--nowrap urlp__section-head" style="--qt-row-gap:8px">
        <span>{{ t(U + 'queryParams') }}</span>
        <button
          class="qt-btn qt-btn--ghost qt-btn--sm"
          type="button"
          @click="addQueryParam"
        >
          <Plus :size="13" />
          <span>{{ t(U + 'add') }}</span>
        </button>
      </div>

      <p v-if="queryParams.length === 0" class="qt-alert qt-alert--empty">
        {{ t(U + 'noParams') }}
      </p>

      <div v-else class="qt-stack" style="--qt-stack-gap:6px">
        <div class="urlp__row urlp__row--head">
          <span class="urlp__row-key">{{ t(U + 'keyHeader') }}</span>
          <span class="urlp__row-val">{{ t(U + 'valueHeader') }}</span>
          <span class="urlp__row-actions"></span>
        </div>
        <div
          v-for="(param, idx) in queryParams"
          :key="param.id"
          class="urlp__row"
        >
          <input
            type="text"
            class="qt-input qt-input--mono urlp__input urlp__row-key"
            placeholder="key"
            :value="param.key"
            spellcheck="false"
            autocomplete="off"
            @input="onParamKeyInput(param.id, $event)"
          />
          <input
            type="text"
            class="qt-input qt-input--mono urlp__input urlp__row-val"
            placeholder="value"
            :value="param.value ?? ''"
            spellcheck="false"
            autocomplete="off"
            @input="onParamValueInput(param.id, $event)"
          />
          <div class="qt-row qt-row--center qt-row--nowrap" style="--qt-row-gap:4px">
            <button
              class="urlp__icon-btn"
              type="button"
              :title="t(U + 'moveUp')"
              :disabled="idx === 0"
              @click="moveQueryParamUp(param.id)"
            >
              <ArrowUp :size="13" />
            </button>
            <button
              class="urlp__icon-btn"
              type="button"
              :title="t(U + 'moveDown')"
              :disabled="idx === queryParams.length - 1"
              @click="moveQueryParamDown(param.id)"
            >
              <ArrowDown :size="13" />
            </button>
            <button
              class="urlp__icon-btn urlp__icon-btn--danger"
              type="button"
              :title="t(U + 'remove')"
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
      :title="t(U + 'outputTitle')"
      :description="rebuiltValid ? t(U + 'descValid') : t(U + 'descInvalid')"
      :copy-text="rebuilt"
      :copy-label="t(U + 'copyUrl')"
    >
      <template #actions>
        <button
          class="qt-btn qt-btn--ghost"
          type="button"
          :disabled="!rebuiltValid"
          :title="t(U + 'feedBackTitle')"
          @click="applyRebuilt"
        >
          <RotateCcw :size="14" />
          <span>{{ t(U + 'feedBack') }}</span>
        </button>
      </template>

      <p v-if="!rebuiltValid" class="qt-alert qt-alert--error">
        <AlertCircle :size="14" />
        <span>{{ t(U + 'invalidUrl') }}</span>
      </p>
      <div v-else class="qt-result">
        <div class="qt-row qt-row--center qt-row--nowrap" style="--qt-row-gap:8px">
          <code class="qt-mono urlp__code">{{ rebuilt }}</code>
          <CopyButton :text="rebuilt" icon-only />
        </div>
      </div>
    </ToolOutput>
  </div>
</template>

<style scoped>
/* Kept scoped: patterns unique to this tool (no generic utility). */

/* Section heading inside a panel (row via .qt-row) — bold text + flex span. */
.urlp__section-head {
  font-size: 13px;
  font-weight: 700;
  color: var(--qt-text);
}
.urlp__section-head span {
  flex: 1;
}
/* Dense component/param input (control via .qt-input). */
.urlp__input {
  font-size: 13.5px;
  padding: 7px 10px;
}
/* Origin readout (font via .qt-mono) — bordered mono block. */
.urlp__origin-code {
  font-size: 13px;
  color: var(--qt-text);
  word-break: break-all;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  padding: 7px 10px;
}
/* Query-param rows — 3-col grid (key / value / actions). */
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
/* Small bordered icon buttons (move/remove) + danger variant. */
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
/* Rebuilt-URL code (font via .qt-mono) — grows to fill the row. */
.urlp__code {
  flex: 1;
  font-size: 14px;
  color: var(--qt-text);
  word-break: break-all;
}
/* Input textarea floor (control + mono via .qt-input--mono). */
.urlp__textarea {
  min-height: 72px;
}
</style>
