<script setup lang="ts">
/**
 * JsonMinify - minify JSON by removing all whitespace.
 *
 * Parses JSON with `JSON.parse` and re-serializes it with `JSON.stringify`
 * (no indent argument) → single-line, whitespace-free output. Reports byte
 * savings so the user can see how much space was reclaimed.
 *
 * Works in embed mode: receives `input` PostMessages to pre-fill the JSON,
 * and sends `output` PostMessages whenever the minified result changes.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { AlertCircle, RefreshCw, Minimize2 } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import CopyButton from '@/components/CopyButton.vue';
import { useJsonMinify } from './useJsonMinify';

const { input, outputs, error, recompute } = useJsonMinify();

const { t } = useI18n();
const U = 'tools.json-minify.ui.';

const metaLine = computed(() => {
  if (!outputs.value) return '';
  const o = outputs.value;
  const parts = [
    t(U + 'metaBytes', { n: o.outputBytes }),
    t(o.keyCount === 1 ? U + 'metaKeysOne' : U + 'metaKeys', { n: o.keyCount }),
    t(U + 'metaDepth', { n: o.maxDepth }),
  ];
  if (o.inputBytes > o.outputBytes) {
    const saved = o.inputBytes - o.outputBytes;
    const pct = o.inputBytes > 0 ? Math.round((saved / o.inputBytes) * 100) : 0;
    parts.push(t(U + 'metaSaved', { n: saved, pct }));
  } else if (o.inputBytes === o.outputBytes) {
    parts.push(t(U + 'metaNoSavings'));
  }
  return parts.join(' · ');
});

const errorLocation = computed(() => {
  if (!error.value) return '';
  const e = error.value;
  if (e.line != null && e.column != null) {
    return t(U + 'errLineCol', { line: e.line, col: e.column });
  }
  if (e.line != null) return t(U + 'errLine', { line: e.line });
  return '';
});

function onTextInput(e: Event): void {
  input.value = (e.target as HTMLTextAreaElement).value;
}
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
          <span>{{ t(U + 'minify') }}</span>
        </button>
      </template>

      <label class="qt-field">
        <span class="qt-label">{{ t(U + 'jsonLabel') }}</span>
        <textarea
          class="qt-input qt-input--mono"
          style="min-height:180px"
          :placeholder="t(U + 'phJson')"
          :value="input"
          rows="10"
          spellcheck="false"
          autocomplete="off"
          @input="onTextInput"
        />
      </label>
    </ToolInput>

    <ToolOutput
      :title="t(U + 'outTitle')"
      :description="outputs ? metaLine : t(U + 'descEmpty')"
      :copy-text="outputs?.json ?? ''"
      :copy-label="t(U + 'copyJson')"
    >
      <p v-if="error" class="qt-alert qt-alert--error">
        <AlertCircle :size="14" />
        <span>
          <strong v-if="errorLocation" style="margin-right:4px">{{ errorLocation }}:</strong>
          {{ error.message }}
        </span>
      </p>
      <template v-else>
        <p v-if="!outputs" class="qt-alert qt-alert--empty">
          {{ t(U + 'descEmpty') }}
        </p>
        <div v-if="outputs" class="qt-panel qt-stack" style="--qt-stack-gap:6px;padding:8px 10px">
          <div class="qt-row qt-row--center" style="--qt-row-gap:8px">
            <span class="qt-label" style="color:var(--qt-text);flex:1">
              <Minimize2 :size="13" />
              <span>{{ t(U + 'minifiedLabel') }}</span>
            </span>
            <CopyButton :text="outputs.json" :label="t('common.copy')" icon-only />
          </div>
          <pre
            v-if="outputs.json"
            class="jm__code"
          ><code>{{ outputs.json }}</code></pre>
          <p v-else class="qt-alert qt-alert--empty">{{ t(U + 'emptyResult') }}</p>
          <div class="qt-row qt-row--center" style="--qt-row-gap:6px;font-size:12px;color:var(--qt-muted)">
            <span>{{ metaLine }}</span>
          </div>
        </div>
      </template>
    </ToolOutput>
  </div>
</template>

<style scoped>
/* Kept scoped: patterns unique to this tool (no generic utility). */

/* Minified output — bare code inside the result panel (no border/padding). */
.jm__code {
  font-family: var(--qt-font-mono);
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
</style>
