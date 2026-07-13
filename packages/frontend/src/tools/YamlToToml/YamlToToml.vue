<script setup lang="ts">
/**
 * YamlToToml — convert YAML documents to TOML.
 *
 * Parses a single YAML document (multi-document streams are rejected — TOML
 * has no multi-document form) and serializes it to TOML via `smol-toml`.
 * Both `yaml` and `smol-toml` are part of the initial bundle per
 * `tech-stack.md`, so this tool rides the app-shell bundle for its parsers.
 *
 * Works in embed mode: receives `input` PostMessages to pre-fill the YAML,
 * and sends `output` PostMessages whenever the computed TOML changes.
 */
import { computed } from 'vue';
import { AlertCircle, RefreshCw, Hash } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import CopyButton from '@/components/CopyButton.vue';
import { useYamlToToml } from './useYamlToToml';

const {
  input,
  numbersAsFloat,
  outputs,
  error,
  recompute,
  toggleNumbersAsFloat,
} = useYamlToToml();

const description = computed(() =>
  numbersAsFloat.value
    ? 'Parse a single YAML document and emit TOML. Numbers render as floats (1.0).'
    : 'Parse a single YAML document and emit TOML. Integer-valued floats render as integers.',
);

const errorLocation = computed(() => {
  if (!error.value) return '';
  const e = error.value;
  if (e.line != null && e.column != null) {
    return `${e.stage === 'yaml' ? 'YAML' : 'TOML'} · Line ${e.line}, column ${e.column}`;
  }
  if (e.line != null) return `${e.stage === 'yaml' ? 'YAML' : 'TOML'} · Line ${e.line}`;
  return e.stage === 'yaml' ? 'YAML' : 'TOML';
});

function onTextInput(e: Event): void {
  input.value = (e.target as HTMLTextAreaElement).value;
}
</script>

<template>
  <div class="y2t">
    <ToolInput title="YAML input" :description="description">
      <template #actions>
        <button
          class="y2t__btn"
          type="button"
          :disabled="input.trim().length === 0"
          @click="recompute"
        >
          <RefreshCw :size="14" />
          <span>Convert</span>
        </button>
      </template>

      <div class="y2t__opts">
        <button
          type="button"
          class="y2t__toggle"
          :class="{ 'y2t__toggle--active': numbersAsFloat }"
          :aria-pressed="numbersAsFloat"
          title="Render every number with a decimal part (1.0 instead of 1)"
          @click="toggleNumbersAsFloat"
        >
          <Hash :size="13" />
          <span>Numbers as floats</span>
        </button>
      </div>

      <label class="y2t__field">
        <span class="y2t__label">YAML</span>
        <textarea
          class="y2t__textarea y2t__textarea--mono"
          placeholder="Paste YAML here… (single document only)"
          :value="input"
          rows="10"
          spellcheck="false"
          autocomplete="off"
          @input="onTextInput"
        />
      </label>
    </ToolInput>

    <ToolOutput
      title="TOML output"
      :description="outputs ? `${outputs.documentCount} document · ${outputs.outputBytes} bytes` : 'Paste YAML above to convert.'"
      :copy-text="outputs?.toml ?? ''"
      copy-label="Copy TOML"
    >
      <p v-if="error" class="y2t__error">
        <AlertCircle :size="14" />
        <span>
          <strong v-if="errorLocation">{{ errorLocation }}:</strong>
          {{ error.message }}
        </span>
      </p>
      <template v-else>
        <p v-if="!outputs" class="y2t__empty">
          Paste YAML above to convert.
        </p>
        <div v-if="outputs" class="y2t__result">
          <div class="y2t__result-head">
            <span class="y2t__result-label">TOML</span>
            <CopyButton :text="outputs.toml" label="Copy" icon-only />
          </div>
          <pre v-if="outputs.toml" class="y2t__code">{{ outputs.toml }}</pre>
          <p v-else class="y2t__empty">YAML parsed to an empty result.</p>
          <div class="y2t__meta">
            <span>{{ outputs.documentCount }} doc</span>
            <span class="y2t__dot">·</span>
            <span>{{ outputs.inputBytes }} bytes in</span>
            <span class="y2t__dot">·</span>
            <span>{{ outputs.outputBytes }} bytes out</span>
          </div>
        </div>
      </template>
    </ToolOutput>
  </div>
</template>

<style scoped>
.y2t {
  display: flex;
  flex-direction: column;
  gap: var(--qt-gap);
  max-width: var(--qt-max-content);
  margin: 0 auto;
}
.y2t__opts {
  display: flex;
  align-items: flex-end;
  gap: 12px;
  flex-wrap: wrap;
}
.y2t__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.y2t__label {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--qt-muted);
}
.y2t__toggle {
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
.y2t__toggle--active {
  color: var(--qt-bg);
  background: var(--qt-accent);
  border-color: var(--qt-accent);
}
.y2t__textarea {
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
.y2t__textarea--mono {
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
}
.y2t__textarea:focus {
  border-color: var(--qt-accent);
  outline: none;
  box-shadow: 0 0 0 2px oklch(from var(--qt-accent) 90% c h / 0.25);
}
.y2t__btn {
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
.y2t__btn:hover:not(:disabled) {
  transform: translateY(-1px);
}
.y2t__btn:active:not(:disabled) {
  transform: translateY(0);
}
.y2t__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.y2t__error {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 0;
  color: var(--qt-danger);
  font-size: 13.5px;
  line-height: 1.4;
}
.y2t__error strong {
  margin-right: 4px;
}
.y2t__empty {
  margin: 0;
  color: var(--qt-muted);
  font-size: 13.5px;
}
.y2t__result {
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.y2t__result-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.y2t__result-label {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--qt-text);
  flex: 1;
}
.y2t__code {
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
  font-size: 13.5px;
  color: var(--qt-text);
  white-space: pre-wrap;
  word-break: break-word;
  margin: 0;
  max-height: 60vh;
  overflow: auto;
}
.y2t__meta {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--qt-muted);
  flex-wrap: wrap;
}
.y2t__dot {
  opacity: 0.6;
}
</style>
