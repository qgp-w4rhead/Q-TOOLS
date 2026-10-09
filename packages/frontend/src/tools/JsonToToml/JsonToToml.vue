<script setup lang="ts">
/**
 * JsonToToml - convert JSON to TOML.
 *
 * Parses a JSON object (the TOML root is always a table - non-object roots
 * are rejected) and serializes it to TOML via `smol-toml`. The `smol-toml`
 * package is part of the initial bundle per `tech-stack.md`, so this tool
 * rides the app-shell bundle for its serializer.
 *
 * Works in embed mode: receives `input` PostMessages to pre-fill the JSON,
 * and sends `output` PostMessages whenever the computed TOML changes.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
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

const { t } = useI18n();
const U = 'tools.json-to-toml.ui.';

const description = computed(() =>
  numbersAsFloat.value ? t(U + 'descFloat') : t(U + 'descInt'),
);

const errorLocation = computed(() => {
  if (!error.value) return '';
  const e = error.value;
  const stageLabel = e.stage === 'json' ? 'JSON' : 'TOML';
  if (e.line != null && e.column != null) {
    return t(U + 'errStageLineCol', { stage: stageLabel, line: e.line, col: e.column });
  }
  if (e.line != null) return t(U + 'errStageLine', { stage: stageLabel, line: e.line });
  return stageLabel;
});

function onTextInput(e: Event): void {
  input.value = (e.target as HTMLTextAreaElement).value;
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
          <span>{{ t('common.convert') }}</span>
        </button>
      </template>

      <div class="qt-row qt-row--end" style="--qt-row-gap:12px">
        <button
          type="button"
          class="qt-chip qt-chip--filled"
          :class="{ 'qt-chip--solid': numbersAsFloat }"
          :aria-pressed="numbersAsFloat"
          :title="t(U + 'numbersAsFloatTitle')"
          @click="toggleNumbersAsFloat"
        >
          <Hash :size="13" />
          <span>{{ t(U + 'numbersAsFloat') }}</span>
        </button>
      </div>

      <label class="qt-field">
        <span class="qt-label">{{ t(U + 'jsonLabel') }}</span>
        <textarea
          class="qt-input qt-input--mono j2t__textarea"
          :placeholder="t(U + 'placeholder')"
          :value="input"
          rows="10"
          spellcheck="false"
          autocomplete="off"
          @input="onTextInput"
        />
      </label>
    </ToolInput>

    <ToolOutput
      :title="t(U + 'outputTitle')"
      :description="outputs ? t(U + 'outputDesc', { keys: t(U + 'rootKeys', outputs.rootKeyCount), bytes: outputs.outputBytes }) : t(U + 'empty')"
      :copy-text="outputs?.toml ?? ''"
      :copy-label="t(U + 'copyToml')"
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
            <span class="qt-label">TOML</span>
            <CopyButton :text="outputs.toml" :label="t('common.copy')" icon-only />
          </div>
          <pre v-if="outputs.toml" class="qt-mono j2t__code">{{ outputs.toml }}</pre>
          <p v-else class="qt-alert qt-alert--empty">{{ t(U + 'emptyResult') }}</p>
          <div class="qt-row qt-row--center qt-hint" style="--qt-row-gap:6px">
            <span>{{ t(U + 'rootKeys', outputs.rootKeyCount) }}</span>
            <span class="j2t__dot">·</span>
            <span>{{ t(U + 'bytesIn', { n: outputs.inputBytes }) }}</span>
            <span class="j2t__dot">·</span>
            <span>{{ t(U + 'bytesOut', { n: outputs.outputBytes }) }}</span>
          </div>
        </div>
      </template>
    </ToolOutput>
  </div>
</template>

<style scoped>
/* Kept scoped: patterns unique to this tool (no generic utility). */

/* Input textarea floor (control + mono via .qt-input--mono). */
.j2t__textarea {
  min-height: 180px;
}
/* TOML output block (font via .qt-mono) — scrollable, pre-wrapped. */
.j2t__code {
  font-size: 13.5px;
  color: var(--qt-text);
  white-space: pre-wrap;
  word-break: break-word;
  margin: 0;
  max-height: 60vh;
  overflow: auto;
}
/* Meta separator dot. */
.j2t__dot {
  opacity: 0.6;
}
</style>
