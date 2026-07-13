<script setup lang="ts">
/**
 * TomlToYaml — convert TOML to YAML.
 *
 * Parses TOML text via `smol-toml`'s `parse` and serializes the result to YAML
 * via the `yaml` package's `stringify`. Both packages are part of the initial
 * bundle (per `tech-stack.md`), so this tool rides the app-shell bundle for its
 * parser and serializer.
 *
 * Works in embed mode: receives `input` PostMessages to pre-fill the TOML,
 * and sends `output` PostMessages whenever the computed YAML changes.
 */
import { computed } from 'vue';
import { AlertCircle, RefreshCw, Braces } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import CopyButton from '@/components/CopyButton.vue';
import { useTomlToYaml, type YamlIndent } from './useTomlToYaml';

const {
  input,
  indent,
  flow,
  outputs,
  error,
  recompute,
  setIndent,
  toggleFlow,
} = useTomlToYaml();

const description = computed(() =>
  'Parse TOML and emit YAML. Dates and times serialize to ISO strings.',
);

const indentOptions: Array<{ value: YamlIndent; label: string }> = [
  { value: 2, label: '2 spaces' },
  { value: 4, label: '4 spaces' },
];

const errorLocation = computed(() => {
  if (!error.value) return '';
  const e = error.value;
  const stageLabel = e.stage === 'toml' ? 'TOML' : 'YAML';
  if (e.line != null && e.column != null) {
    return `${stageLabel} · Line ${e.line}, column ${e.column}`;
  }
  if (e.line != null) return `${stageLabel} · Line ${e.line}`;
  return stageLabel;
});

function onTextInput(e: Event): void {
  input.value = (e.target as HTMLTextAreaElement).value;
}

function onIndentChange(e: Event): void {
  const v = Number((e.target as HTMLSelectElement).value);
  setIndent(v as YamlIndent);
}
</script>

<template>
  <div class="t2y">
    <ToolInput title="TOML input" :description="description">
      <template #actions>
        <button
          class="t2y__btn"
          type="button"
          :disabled="input.trim().length === 0"
          @click="recompute"
        >
          <RefreshCw :size="14" />
          <span>Convert</span>
        </button>
      </template>

      <div class="t2y__opts">
        <label class="t2y__opt">
          <span class="t2y__label">Indent</span>
          <select
            class="t2y__select"
            :value="indent"
            @change="onIndentChange"
          >
            <option v-for="o in indentOptions" :key="o.value" :value="o.value">
              {{ o.label }}
            </option>
          </select>
        </label>
        <button
          type="button"
          class="t2y__toggle"
          :class="{ 't2y__toggle--active': flow }"
          :aria-pressed="flow"
          title="Use flow-style collections ([1, 2] and {a: 1}) instead of block style"
          @click="toggleFlow"
        >
          <Braces :size="13" />
          <span>Flow style</span>
        </button>
      </div>

      <label class="t2y__field">
        <span class="t2y__label">TOML</span>
        <textarea
          class="t2y__textarea t2y__textarea--mono"
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
      title="YAML output"
      :description="outputs ? `${outputs.rootKeyCount} root key${outputs.rootKeyCount === 1 ? '' : 's'} · ${outputs.outputBytes} bytes` : 'Paste TOML above to convert.'"
      :copy-text="outputs?.yaml ?? ''"
      copy-label="Copy YAML"
    >
      <p v-if="error" class="t2y__error">
        <AlertCircle :size="14" />
        <span>
          <strong v-if="errorLocation">{{ errorLocation }}:</strong>
          {{ error.message }}
        </span>
      </p>
      <template v-else>
        <p v-if="!outputs" class="t2y__empty">
          Paste TOML above to convert.
        </p>
        <div v-if="outputs" class="t2y__result">
          <div class="t2y__result-head">
            <span class="t2y__result-label">YAML</span>
            <CopyButton :text="outputs.yaml" label="Copy" icon-only />
          </div>
          <pre v-if="outputs.yaml" class="t2y__code">{{ outputs.yaml }}</pre>
          <p v-else class="t2y__empty">TOML parsed to an empty result.</p>
          <div class="t2y__meta">
            <span>{{ outputs.rootKeyCount }} root key{{ outputs.rootKeyCount === 1 ? '' : 's' }}</span>
            <span class="t2y__dot">·</span>
            <span>{{ outputs.inputBytes }} bytes in</span>
            <span class="t2y__dot">·</span>
            <span>{{ outputs.outputBytes }} bytes out</span>
          </div>
        </div>
      </template>
    </ToolOutput>
  </div>
</template>

<style scoped>
.t2y {
  display: flex;
  flex-direction: column;
  gap: var(--qt-gap);
  max-width: var(--qt-max-content);
  margin: 0 auto;
}
.t2y__opts {
  display: flex;
  align-items: flex-end;
  gap: 12px;
  flex-wrap: wrap;
}
.t2y__opt {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.t2y__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.t2y__label {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--qt-muted);
}
.t2y__select {
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
.t2y__select:focus {
  border-color: var(--qt-accent);
  outline: none;
  box-shadow: 0 0 0 2px oklch(from var(--qt-accent) 90% c h / 0.25);
}
.t2y__toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: 999px;
  color: var(--qt-muted);
  font: inherit;
  font-size: 12.5px;
  font-weight: 600;
  padding: 6px 11px;
  cursor: pointer;
  transition:
    color 0.15s ease,
    border-color 0.15s ease,
    background 0.15s ease;
  will-change: color, border-color;
}
.t2y__toggle--active {
  color: var(--qt-bg);
  background: var(--qt-accent);
  border-color: var(--qt-accent);
}
.t2y__textarea {
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
.t2y__textarea--mono {
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
}
.t2y__textarea:focus {
  border-color: var(--qt-accent);
  outline: none;
  box-shadow: 0 0 0 2px oklch(from var(--qt-accent) 90% c h / 0.25);
}
.t2y__btn {
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
.t2y__btn:hover:not(:disabled) {
  transform: translateY(-1px);
}
.t2y__btn:active:not(:disabled) {
  transform: translateY(0);
}
.t2y__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.t2y__error {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 0;
  color: var(--qt-danger);
  font-size: 13.5px;
  line-height: 1.4;
}
.t2y__error strong {
  margin-right: 4px;
}
.t2y__empty {
  margin: 0;
  color: var(--qt-muted);
  font-size: 13.5px;
}
.t2y__result {
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.t2y__result-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.t2y__result-label {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--qt-text);
  flex: 1;
}
.t2y__code {
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
  font-size: 13.5px;
  color: var(--qt-text);
  white-space: pre-wrap;
  word-break: break-word;
  margin: 0;
  max-height: 60vh;
  overflow: auto;
}
.t2y__meta {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--qt-muted);
  flex-wrap: wrap;
}
.t2y__dot {
  opacity: 0.6;
}
</style>
