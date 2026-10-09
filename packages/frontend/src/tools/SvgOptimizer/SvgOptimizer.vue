<script setup lang="ts">
/**
 * SvgOptimizer - paste SVG markup or drop a .svg file, then minify it via a
 * hand-rolled optimizer (strip XML decl/DOCTYPE/comments, editor metadata,
 * optional title/desc + dimensions, whitespace collapse, optional pretty
 * print). Shows before/after byte sizes and percentage saved. Everything
 * runs locally - nothing leaves the browser.
 *
 * Embed mode: accepts `input`/`svg`/`options`/`action` inputs and sends
 * `{ output, inputBytes, outputBytes, savingsPercent }` outputs.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { Download, Trash2, AlertTriangle, FileCode, Zap } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import FileDropZone from '@/components/FileDropZone.vue';
import {
  useSvgOptimizer,
  savingsPercent,
  DEFAULT_OPTIONS,
  type OptimizeOptions,
} from './useSvgOptimizer';
import { formatBytes } from '@/utils/media';

const {
  input,
  output,
  options,
  inputBytes,
  outputBytes,
  error,
  optimize,
  setInput,
  loadFile,
  download,
  reset,
} = useSvgOptimizer();

const { t } = useI18n();
const U = 'tools.svg-optimizer.ui.';

const saved = computed(() => savingsPercent(inputBytes.value, outputBytes.value));

function onFiles(files: File[]): void {
  const f = files[0];
  if (f) void loadFile(f);
}

function toggle(key: keyof OptimizeOptions): void {
  options.value = { ...options.value, [key]: !options.value[key] };
}

function resetOptions(): void {
  options.value = { ...DEFAULT_OPTIONS };
}
</script>

<template>
  <div class="qt-tool">
    <ToolInput
      :title="t('common.input')"
      :description="t(U + 'desc')"
    >
      <template #actions>
        <button type="button" class="qt-btn qt-btn--ghost qt-btn--sm" :title="t(U + 'resetTitle')" @click="resetOptions">
          {{ t('common.reset') }}
        </button>
      </template>

      <FileDropZone
        accept=".svg,image/svg+xml"
        :title="t(U + 'dropTitle')"
        :hint="t(U + 'dropHint')"
        @files="onFiles"
      />

      <textarea
        :value="input"
        class="qt-input qt-input--mono svgo__textarea"
        rows="8"
        placeholder='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">…</svg>'
        spellcheck="false"
        @input="setInput(($event.target as HTMLTextAreaElement).value)"
      />

      <div class="qt-stack" style="--qt-stack-gap:8px">
        <label class="qt-check">
          <input
            type="checkbox"
            :checked="options.removeMetadata"
            @change="toggle('removeMetadata')"
          />
          <span>{{ t(U + 'optRemoveMetadata') }}</span>
        </label>
        <label class="qt-check">
          <input
            type="checkbox"
            :checked="options.removeTitleDesc"
            @change="toggle('removeTitleDesc')"
          />
          <span>{{ t(U + 'optRemoveTitleDesc') }}</span>
        </label>
        <label class="qt-check">
          <input
            type="checkbox"
            :checked="options.removeDimensions"
            @change="toggle('removeDimensions')"
          />
          <span>{{ t(U + 'optRemoveDimensions') }}</span>
        </label>
        <label class="qt-check">
          <input
            type="checkbox"
            :checked="options.pretty"
            @change="toggle('pretty')"
          />
          <span>{{ t(U + 'optPretty') }}</span>
        </label>
      </div>
    </ToolInput>

    <ToolOutput
      :title="t(U + 'outputTitle')"
      :description="output ? t(U + 'descResult', { inBytes: formatBytes(inputBytes), outBytes: formatBytes(outputBytes), pct: saved.toFixed(1) }) : t(U + 'descEmpty')"
      :copy-text="output"
      :copy-label="t(U + 'copySvg')"
    >
      <template #actions>
        <button
          type="button"
          class="qt-btn qt-btn--ghost qt-btn--sm svgo__btn--primary"
          :disabled="!input.trim()"
          @click="optimize"
        >
          <Zap :size="14" /> {{ t(U + 'optimize') }}
        </button>
        <button
          type="button"
          class="qt-btn qt-btn--ghost qt-btn--sm"
          :disabled="!output"
          :title="t(U + 'downloadTitle')"
          @click="download"
        >
          <Download :size="14" /> {{ t('common.download') }}
        </button>
        <button type="button" class="qt-btn qt-btn--ghost qt-btn--sm" :disabled="!input && !output" :title="t('common.clear')" @click="reset">
          <Trash2 :size="14" /> {{ t('common.clear') }}
        </button>
      </template>

      <div v-if="error" class="qt-banner qt-banner--warn">
        <AlertTriangle :size="16" />
        <span>{{ error }}</span>
      </div>

      <div v-if="output" class="qt-stack" style="--qt-stack-gap:12px">
        <div class="qt-row" style="justify-content:center">
          <div class="svgo__preview-frame" v-html="output" />
        </div>
        <pre class="qt-output svgo__code">{{ output }}</pre>
      </div>
      <div v-else-if="!error" class="svgo__placeholder">
        <FileCode :size="36" class="svgo__placeholder-icon" />
        <span>{{ t(U + 'empty') }}</span>
      </div>
    </ToolOutput>
  </div>
</template>

<style scoped>
/* Kept scoped: patterns unique to this tool (no generic utility). */

/* Input textarea floor (control + mono via .qt-input--mono). */
.svgo__textarea {
  font-size: 12px;
  min-height: 120px;
}
/* Optimize action (base via .qt-btn--ghost) — accent outline. */
.svgo__btn--primary {
  border-color: var(--qt-accent);
  color: var(--qt-accent);
}
/* SVG preview frame — checkerboard backdrop for transparency. */
.svgo__preview-frame {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  max-width: 240px;
  max-height: 240px;
  padding: 12px;
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius);
  background: repeating-conic-gradient(#80808022 0% 25%, transparent 0% 50%) 0 0 / 16px 16px;
}
.svgo__preview-frame :deep(svg) {
  max-width: 100%;
  max-height: 216px;
  width: auto;
  height: auto;
}
/* Optimized markup (base via .qt-output) — no-wrap, capped, scrollable. */
.svgo__code {
  margin: 0;
  font-size: 11.5px;
  white-space: pre;
  max-height: 320px;
  overflow: auto;
}
/* Centered empty state — big icon + prompt. */
.svgo__placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 32px 16px;
  color: var(--qt-muted);
  font-size: 13px;
  text-align: center;
}
.svgo__placeholder-icon {
  opacity: 0.4;
}
</style>
