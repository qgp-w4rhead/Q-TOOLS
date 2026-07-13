<script setup lang="ts">
/**
 * TomlToJson — convert TOML to JSON.
 *
 * Parses TOML text via `smol-toml`'s `parse` and emits pretty-printed (or
 * compact) JSON. The `smol-toml` package is part of the initial bundle (per
 * `tech-stack.md`), so this tool rides the app-shell bundle for its parser.
 *
 * Works in embed mode: receives `input` PostMessages to pre-fill the TOML,
 * and sends `output` PostMessages whenever the computed JSON changes.
 */
import { computed } from 'vue';
import { AlertCircle, RefreshCw } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import CopyButton from '@/components/CopyButton.vue';
import {
  useTomlToJson,
  type JsonIndent,
} from './useTomlToJson';

const {
  input,
  indent,
  outputs,
  error,
  recompute,
  setIndent,
} = useTomlToJson();

const description = computed(() =>
  'Parse TOML and emit JSON. Dates and times serialize to ISO strings.',
);

const indentOptions: Array<{ value: JsonIndent; label: string }> = [
  { value: 2, label: '2 spaces' },
  { value: 4, label: '4 spaces' },
  { value: 0, label: 'Compact' },
];

const errorLocation = computed(() => {
  if (!error.value) return '';
  const e = error.value;
  if (e.line != null && e.column != null) {
    return `Line ${e.line}, column ${e.column}`;
  }
  if (e.line != null) return `Line ${e.line}`;
  return '';
});

function onTextInput(e: Event): void {
  input.value = (e.target as HTMLTextAreaElement).value;
}

function onIndentChange(e: Event): void {
  const v = Number((e.target as HTMLSelectElement).value);
  setIndent(v as JsonIndent);
}
</script>

<template>
  <div class="t2j">
    <ToolInput title="TOML input" :description="description">
      <template #actions>
        <button
          class="t2j__btn"
          type="button"
          :disabled="input.trim().length === 0"
          @click="recompute"
        >
          <RefreshCw :size="14" />
          <span>Convert</span>
        </button>
      </template>

      <div class="t2j__opts">
        <label class="t2j__opt">
          <span class="t2j__label">Indent</span>
          <select
            class="t2j__select"
            :value="indent"
            @change="onIndentChange"
          >
            <option v-for="o in indentOptions" :key="o.value" :value="o.value">
              {{ o.label }}
            </option>
          </select>
        </label>
      </div>

      <label class="t2j__field">
        <span class="t2j__label">TOML</span>
        <textarea
          class="t2j__textarea t2j__textarea--mono"
          placeholder="Paste TOML here…"
          :value="input"
          rows="10"
          spellcheck="false"
          autocomplete="off"
          @input="onTextInput"
        />
      </label>
    </ToolInput>

    <ToolOutput
      title="JSON output"
      :description="outputs ? `${outputs.rootKeyCount} root key${outputs.rootKeyCount === 1 ? '' : 's'} · ${outputs.outputBytes} bytes` : 'Paste TOML above to convert.'"
      :copy-text="outputs?.json ?? ''"
      copy-label="Copy JSON"
    >
      <p v-if="error" class="t2j__error">
        <AlertCircle :size="14" />
        <span>
          <strong v-if="errorLocation">{{ errorLocation }}:</strong>
          {{ error.message }}
        </span>
      </p>
      <template v-else>
        <p v-if="!outputs" class="t2j__empty">
          Paste TOML above to convert.
        </p>
        <div v-if="outputs" class="t2j__result">
          <div class="t2j__result-head">
            <span class="t2j__result-label">JSON</span>
            <CopyButton :text="outputs.json" label="Copy" icon-only />
          </div>
          <pre v-if="outputs.json" class="t2j__code">{{ outputs.json }}</pre>
          <p v-else class="t2j__empty">TOML parsed to an empty result.</p>
          <div class="t2j__meta">
            <span>{{ outputs.rootKeyCount }} root key{{ outputs.rootKeyCount === 1 ? '' : 's' }}</span>
            <span class="t2j__dot">·</span>
            <span>{{ outputs.inputBytes }} bytes in</span>
            <span class="t2j__dot">·</span>
            <span>{{ outputs.outputBytes }} bytes out</span>
          </div>
        </div>
      </template>
    </ToolOutput>
  </div>
</template>

<style scoped>
.t2j {
  display: flex;
  flex-direction: column;
  gap: var(--qt-gap);
  max-width: var(--qt-max-content);
  margin: 0 auto;
}
.t2j__opts {
  display: flex;
  align-items: flex-end;
  gap: 12px;
  flex-wrap: wrap;
}
.t2j__opt {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.t2j__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.t2j__label {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--qt-muted);
}
.t2j__select {
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  color: var(--qt-text);
  font: inherit;
  font-size: 13px;
  padding: 6px 10px;
  cursor: pointer;
  transition: border-color 0.15s ease;
  will-change: border-color;
}
.t2j__select:focus {
  border-color: var(--qt-accent);
  outline: none;
  box-shadow: 0 0 0 2px oklch(from var(--qt-accent) 90% c h / 0.25);
}
.t2j__textarea {
  width: 100%;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  color: var(--qt-text);
  font: inherit;
  font-size: 14px;
  padding: 10px 12px;
  resize: vertical;
  min-height: 180px;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;
  will-change: border-color;
}
.t2j__textarea--mono {
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
}
.t2j__textarea:focus {
  border-color: var(--qt-accent);
  outline: none;
  box-shadow: 0 0 0 2px oklch(from var(--qt-accent) 90% c h / 0.25);
}
.t2j__btn {
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
.t2j__btn:hover:not(:disabled) {
  transform: translateY(-1px);
}
.t2j__btn:active:not(:disabled) {
  transform: translateY(0);
}
.t2j__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.t2j__error {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 0;
  color: var(--qt-danger);
  font-size: 13.5px;
  line-height: 1.4;
}
.t2j__error strong {
  margin-right: 4px;
}
.t2j__empty {
  margin: 0;
  color: var(--qt-muted);
  font-size: 13.5px;
}
.t2j__result {
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.t2j__result-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.t2j__result-label {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--qt-text);
  flex: 1;
}
.t2j__code {
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
  font-size: 13.5px;
  color: var(--qt-text);
  white-space: pre-wrap;
  word-break: break-word;
  margin: 0;
  max-height: 60vh;
  overflow: auto;
}
.t2j__meta {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--qt-muted);
  flex-wrap: wrap;
}
.t2j__dot {
  opacity: 0.6;
}
</style>
