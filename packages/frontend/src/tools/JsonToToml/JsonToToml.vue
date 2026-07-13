<script setup lang="ts">
/**
 * JsonToToml — convert JSON to TOML.
 *
 * Parses a JSON object (the TOML root is always a table — non-object roots
 * are rejected) and serializes it to TOML via `smol-toml`. The `smol-toml`
 * package is part of the initial bundle per `tech-stack.md`, so this tool
 * rides the app-shell bundle for its serializer.
 *
 * Works in embed mode: receives `input` PostMessages to pre-fill the JSON,
 * and sends `output` PostMessages whenever the computed TOML changes.
 */
import { computed } from 'vue';
import { AlertCircle, RefreshCw, Hash } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import CopyButton from '@/components/CopyButton.vue';
import { useJsonToToml } from './useJsonToToml';

const {
  input,
  numbersAsFloat,
  outputs,
  error,
  recompute,
  toggleNumbersAsFloat,
} = useJsonToToml();

const description = computed(() =>
  numbersAsFloat.value
    ? 'Parse a JSON object and emit TOML. Numbers render as floats (1.0).'
    : 'Parse a JSON object and emit TOML. Integer-valued floats render as integers.',
);

const errorLocation = computed(() => {
  if (!error.value) return '';
  const e = error.value;
  const stageLabel = e.stage === 'json' ? 'JSON' : 'TOML';
  if (e.line != null && e.column != null) {
    return `${stageLabel} · Line ${e.line}, column ${e.column}`;
  }
  if (e.line != null) return `${stageLabel} · Line ${e.line}`;
  return stageLabel;
});

function onTextInput(e: Event): void {
  input.value = (e.target as HTMLTextAreaElement).value;
}
</script>

<template>
  <div class="j2t">
    <ToolInput title="JSON input" :description="description">
      <template #actions>
        <button
          class="j2t__btn"
          type="button"
          :disabled="input.trim().length === 0"
          @click="recompute"
        >
          <RefreshCw :size="14" />
          <span>Convert</span>
        </button>
      </template>

      <div class="j2t__opts">
        <button
          type="button"
          class="j2t__toggle"
          :class="{ 'j2t__toggle--active': numbersAsFloat }"
          :aria-pressed="numbersAsFloat"
          title="Render every number with a decimal part (1.0 instead of 1)"
          @click="toggleNumbersAsFloat"
        >
          <Hash :size="13" />
          <span>Numbers as floats</span>
        </button>
      </div>

      <label class="j2t__field">
        <span class="j2t__label">JSON</span>
        <textarea
          class="j2t__textarea j2t__textarea--mono"
          placeholder="Paste JSON here… (object root only)"
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
      :description="outputs ? `${outputs.rootKeyCount} root key${outputs.rootKeyCount === 1 ? '' : 's'} · ${outputs.outputBytes} bytes` : 'Paste JSON above to convert.'"
      :copy-text="outputs?.toml ?? ''"
      copy-label="Copy TOML"
    >
      <p v-if="error" class="j2t__error">
        <AlertCircle :size="14" />
        <span>
          <strong v-if="errorLocation">{{ errorLocation }}:</strong>
          {{ error.message }}
        </span>
      </p>
      <template v-else>
        <p v-if="!outputs" class="j2t__empty">
          Paste JSON above to convert.
        </p>
        <div v-if="outputs" class="j2t__result">
          <div class="j2t__result-head">
            <span class="j2t__result-label">TOML</span>
            <CopyButton :text="outputs.toml" label="Copy" icon-only />
          </div>
          <pre v-if="outputs.toml" class="j2t__code">{{ outputs.toml }}</pre>
          <p v-else class="j2t__empty">JSON parsed to an empty result.</p>
          <div class="j2t__meta">
            <span>{{ outputs.rootKeyCount }} root key{{ outputs.rootKeyCount === 1 ? '' : 's' }}</span>
            <span class="j2t__dot">·</span>
            <span>{{ outputs.inputBytes }} bytes in</span>
            <span class="j2t__dot">·</span>
            <span>{{ outputs.outputBytes }} bytes out</span>
          </div>
        </div>
      </template>
    </ToolOutput>
  </div>
</template>

<style scoped>
.j2t {
  display: flex;
  flex-direction: column;
  gap: var(--qt-gap);
  max-width: var(--qt-max-content);
  margin: 0 auto;
}
.j2t__opts {
  display: flex;
  align-items: flex-end;
  gap: 12px;
  flex-wrap: wrap;
}
.j2t__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.j2t__label {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--qt-muted);
}
.j2t__toggle {
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
.j2t__toggle--active {
  color: var(--qt-bg);
  background: var(--qt-accent);
  border-color: var(--qt-accent);
}
.j2t__textarea {
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
.j2t__textarea--mono {
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
}
.j2t__textarea:focus {
  border-color: var(--qt-accent);
  outline: none;
  box-shadow: 0 0 0 2px oklch(from var(--qt-accent) 90% c h / 0.25);
}
.j2t__btn {
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
.j2t__btn:hover:not(:disabled) {
  transform: translateY(-1px);
}
.j2t__btn:active:not(:disabled) {
  transform: translateY(0);
}
.j2t__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.j2t__error {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 0;
  color: var(--qt-danger);
  font-size: 13.5px;
  line-height: 1.4;
}
.j2t__error strong {
  margin-right: 4px;
}
.j2t__empty {
  margin: 0;
  color: var(--qt-muted);
  font-size: 13.5px;
}
.j2t__result {
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.j2t__result-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.j2t__result-label {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--qt-text);
  flex: 1;
}
.j2t__code {
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
  font-size: 13.5px;
  color: var(--qt-text);
  white-space: pre-wrap;
  word-break: break-word;
  margin: 0;
  max-height: 60vh;
  overflow: auto;
}
.j2t__meta {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--qt-muted);
  flex-wrap: wrap;
}
.j2t__dot {
  opacity: 0.6;
}
</style>
