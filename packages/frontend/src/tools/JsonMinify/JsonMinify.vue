<script setup lang="ts">
/**
 * JsonMinify — minify JSON by removing all whitespace.
 *
 * Parses JSON with `JSON.parse` and re-serializes it with `JSON.stringify`
 * (no indent argument) → single-line, whitespace-free output. Reports byte
 * savings so the user can see how much space was reclaimed.
 *
 * Works in embed mode: receives `input` PostMessages to pre-fill the JSON,
 * and sends `output` PostMessages whenever the minified result changes.
 */
import { computed } from 'vue';
import { AlertCircle, RefreshCw, Minimize2 } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import CopyButton from '@/components/CopyButton.vue';
import { useJsonMinify } from './useJsonMinify';

const { input, outputs, error, recompute } = useJsonMinify();

const metaLine = computed(() => {
  if (!outputs.value) return '';
  const o = outputs.value;
  const parts = [
    `${o.outputBytes} bytes`,
    `${o.keyCount} key${o.keyCount === 1 ? '' : 's'}`,
    `depth ${o.maxDepth}`,
  ];
  if (o.inputBytes > o.outputBytes) {
    const saved = o.inputBytes - o.outputBytes;
    const pct = o.inputBytes > 0 ? Math.round((saved / o.inputBytes) * 100) : 0;
    parts.push(`saved ${saved} B (${pct}%)`);
  } else if (o.inputBytes === o.outputBytes) {
    parts.push('no savings');
  }
  return parts.join(' · ');
});

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
</script>

<template>
  <div class="jm">
    <ToolInput
      title="JSON input"
      description="Paste pretty-printed or messy JSON. It is parsed and re-serialized with no whitespace."
    >
      <template #actions>
        <button
          class="jm__btn"
          type="button"
          :disabled="input.trim().length === 0"
          @click="recompute"
        >
          <RefreshCw :size="14" />
          <span>Minify</span>
        </button>
      </template>

      <label class="jm__field">
        <span class="jm__label">JSON</span>
        <textarea
          class="jm__textarea jm__textarea--mono"
          placeholder='Paste JSON here…  e.g.  {\n  "a": 1,\n  "b": [2, 3, true, null]\n}'
          :value="input"
          rows="10"
          spellcheck="false"
          autocomplete="off"
          @input="onTextInput"
        />
      </label>
    </ToolInput>

    <ToolOutput
      title="Minified JSON"
      :description="outputs ? metaLine : 'Paste JSON above to minify.'"
      :copy-text="outputs?.json ?? ''"
      copy-label="Copy JSON"
    >
      <p v-if="error" class="jm__error">
        <AlertCircle :size="14" />
        <span>
          <strong v-if="errorLocation">{{ errorLocation }}:</strong>
          {{ error.message }}
        </span>
      </p>
      <template v-else>
        <p v-if="!outputs" class="jm__empty">
          Paste JSON above to minify.
        </p>
        <div v-if="outputs" class="jm__result">
          <div class="jm__result-head">
            <span class="jm__result-label">
              <Minimize2 :size="13" />
              <span>Minified</span>
            </span>
            <CopyButton :text="outputs.json" label="Copy" icon-only />
          </div>
          <pre
            v-if="outputs.json"
            class="jm__code"
          ><code>{{ outputs.json }}</code></pre>
          <p v-else class="jm__empty">JSON parsed to an empty result.</p>
          <div class="jm__meta">
            <span>{{ metaLine }}</span>
          </div>
        </div>
      </template>
    </ToolOutput>
  </div>
</template>

<style scoped>
.jm {
  display: flex;
  flex-direction: column;
  gap: var(--qt-gap);
  max-width: var(--qt-max-content);
  margin: 0 auto;
}
.jm__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.jm__label {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--qt-muted);
}
.jm__textarea {
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
.jm__textarea--mono {
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
}
.jm__textarea:focus {
  border-color: var(--qt-accent);
  outline: none;
  box-shadow: 0 0 0 2px oklch(from var(--qt-accent) 90% c h / 0.25);
}
.jm__btn {
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
.jm__btn:hover:not(:disabled) {
  transform: translateY(-1px);
}
.jm__btn:active:not(:disabled) {
  transform: translateY(0);
}
.jm__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.jm__error {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 0;
  color: var(--qt-danger);
  font-size: 13.5px;
  line-height: 1.4;
}
.jm__error strong {
  margin-right: 4px;
}
.jm__empty {
  margin: 0;
  color: var(--qt-muted);
  font-size: 13.5px;
}
.jm__result {
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.jm__result-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.jm__result-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--qt-text);
  flex: 1;
}
.jm__code {
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
  font-size: 13.5px;
  color: var(--qt-text);
  white-space: pre-wrap;
  word-break: break-word;
  margin: 0;
  max-height: 60vh;
  overflow: auto;
  tab-size: 4;
}
.jm__code code {
  font: inherit;
  white-space: pre-wrap;
}
.jm__meta {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--qt-muted);
  flex-wrap: wrap;
}
</style>
