<script setup lang="ts">
/**
 * TomlToYaml - convert TOML to YAML.
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
import { useI18n } from 'vue-i18n';
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

const { t } = useI18n();
const U = 'tools.toml-to-yaml.ui.';

const description = computed(() => t(U + 'desc'));

const indentOptions: Array<{ value: YamlIndent; label: string }> = [
  { value: 2, label: '2 spaces' },
  { value: 4, label: '4 spaces' },
];

/** Localized indent-option label. */
function indentLabel(o: { value: YamlIndent }): string {
  return t(U + 'indentN', { n: o.value });
}

const errorLocation = computed(() => {
  if (!error.value) return '';
  const e = error.value;
  const stageLabel = e.stage === 'toml' ? 'TOML' : 'YAML';
  if (e.line != null && e.column != null) {
    return t(U + 'errStageLineCol', { stage: stageLabel, line: e.line, col: e.column });
  }
  if (e.line != null) return t(U + 'errStageLine', { stage: stageLabel, line: e.line });
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
        <label class="qt-field">
          <span class="qt-label">{{ t(U + 'indent') }}</span>
          <select
            class="qt-input"
            :value="indent"
            @change="onIndentChange"
          >
            <option v-for="o in indentOptions" :key="o.value" :value="o.value">
              {{ indentLabel(o) }}
            </option>
          </select>
        </label>
        <button
          type="button"
          class="qt-chip qt-chip--filled"
          :class="{ 'qt-chip--solid': flow }"
          :aria-pressed="flow"
          :title="t(U + 'flowTitle')"
          @click="toggleFlow"
        >
          <Braces :size="13" />
          <span>{{ t(U + 'flow') }}</span>
        </button>
      </div>

      <label class="qt-field">
        <span class="qt-label">{{ t(U + 'tomlLabel') }}</span>
        <textarea
          class="qt-input qt-input--mono t2y__textarea"
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
      :copy-text="outputs?.yaml ?? ''"
      :copy-label="t(U + 'copyYaml')"
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
            <span class="qt-label">YAML</span>
            <CopyButton :text="outputs.yaml" :label="t('common.copy')" icon-only />
          </div>
          <pre v-if="outputs.yaml" class="qt-mono t2y__code">{{ outputs.yaml }}</pre>
          <p v-else class="qt-alert qt-alert--empty">{{ t(U + 'emptyResult') }}</p>
          <div class="qt-row qt-row--center qt-hint" style="--qt-row-gap:6px">
            <span>{{ t(U + 'rootKeys', outputs.rootKeyCount) }}</span>
            <span class="t2y__dot">·</span>
            <span>{{ t(U + 'bytesIn', { n: outputs.inputBytes }) }}</span>
            <span class="t2y__dot">·</span>
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
.t2y__textarea {
  min-height: 180px;
}
/* YAML output block (font via .qt-mono) — scrollable, pre-wrapped. */
.t2y__code {
  font-size: 13.5px;
  color: var(--qt-text);
  white-space: pre-wrap;
  word-break: break-word;
  margin: 0;
  max-height: 60vh;
  overflow: auto;
}
/* Meta separator dot. */
.t2y__dot {
  opacity: 0.6;
}
</style>
