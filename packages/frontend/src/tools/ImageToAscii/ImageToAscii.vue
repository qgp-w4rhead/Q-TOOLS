<script setup lang="ts">
/**
 * ImageToAscii - render an uploaded image as ASCII text by sampling it onto
 * a character grid and mapping each cell's luminance to a character ramp.
 * Controls: output width (chars), charset preset (or custom ramp), and an
 * invert toggle. Everything runs locally in the browser.
 *
 * Embed mode: accepts `width`/`charset`/`customCharset`/`invert`/`action`
 * inputs and sends `{ ascii }` outputs.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { Download, Trash2, AlertTriangle, Type, RefreshCw } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import FileDropZone from '@/components/FileDropZone.vue';
import {
  useImageToAscii,
  CHARSET_LABELS,
  DEFAULT_WIDTH,
  DEFAULT_CHARSET,
  DEFAULT_CUSTOM_CHARSET,
  MIN_WIDTH,
  MAX_WIDTH,
  type CharsetPreset,
} from './useImageToAscii';
import { formatBytes } from '@/utils/media';

const {
  fileName,
  fileSizeBytes,
  previewUrl,
  hasFile,
  width,
  charset,
  customCharset,
  invert,
  ascii,
  isRendering,
  error,
  setFile,
  render,
  download,
  reset,
} = useImageToAscii();

const { t } = useI18n();
const U = 'tools.image-to-ascii.ui.';

const CHARSET_KEYS: Record<CharsetPreset, string> = {
  standard: 'charsetStandard',
  blocks: 'charsetBlocks',
  simple: 'charsetSimple',
  custom: 'charsetCustom',
};
const charsetOptions = computed(() =>
  (Object.keys(CHARSET_LABELS) as CharsetPreset[]).map((k) => ({ value: k, label: t(U + CHARSET_KEYS[k]) })),
);

function onFiles(files: File[]): void {
  const f = files[0];
  if (f) void setFile(f);
}

function onCharset(e: Event): void {
  charset.value = (e.target as HTMLSelectElement).value as CharsetPreset;
}

function resetOptions(): void {
  width.value = DEFAULT_WIDTH;
  charset.value = DEFAULT_CHARSET;
  customCharset.value = DEFAULT_CUSTOM_CHARSET;
  invert.value = false;
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
        accept="image/*"
        :title="t(U + 'dropTitle')"
        :hint="t(U + 'dropHint')"
        @files="onFiles"
      />

      <div v-if="hasFile" class="qt-grid" style="--qt-grid-min:180px;--qt-grid-gap:12px;align-items:end">
        <label class="qt-field">
          <span class="qt-label">{{ t('common.width') }} · {{ t('common.chars', width) }}</span>
          <input
            v-model.number="width"
            class="qt-range"
            style="width:100%"
            type="range"
            :min="MIN_WIDTH"
            :max="MAX_WIDTH"
            step="1"
          />
        </label>

        <label class="qt-field">
          <span class="qt-label">{{ t(U + 'charset') }}</span>
          <select class="qt-input" :value="charset" @change="onCharset">
            <option v-for="o in charsetOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
          </select>
        </label>

        <label v-if="charset === 'custom'" class="qt-field">
          <span class="qt-label">{{ t(U + 'customRamp') }}</span>
          <input v-model="customCharset" class="qt-input" type="text" :placeholder="t(U + 'customRampPlaceholder')" />
        </label>

        <label class="qt-check" style="padding-bottom:8px">
          <input v-model="invert" type="checkbox" />
          <span class="qt-label">{{ t(U + 'invert') }}</span>
        </label>
      </div>
    </ToolInput>

    <ToolOutput
      :title="t(U + 'outputTitle')"
      :description="hasFile ? t(U + 'descFile', { name: fileName, size: formatBytes(fileSizeBytes) }) : t('common.noImageLoaded')"
      :copy-text="ascii"
      :copy-label="t(U + 'copyText')"
    >
      <template #actions>
        <button
          type="button"
          class="qt-btn qt-btn--ghost qt-btn--sm ascii__btn--primary"
          :disabled="!hasFile || isRendering"
          @click="render"
        >
          <RefreshCw :size="14" /> {{ isRendering ? t(U + 'rendering') : t(U + 'rerender') }}
        </button>
        <button
          type="button"
          class="qt-btn qt-btn--ghost qt-btn--sm"
          :disabled="!ascii"
          :title="t(U + 'downloadTitle')"
          @click="download"
        >
          <Download :size="14" /> {{ t('common.download') }}
        </button>
        <button type="button" class="qt-btn qt-btn--ghost qt-btn--sm" :disabled="!hasFile" :title="t('common.clear')" @click="reset">
          <Trash2 :size="14" /> {{ t('common.clear') }}
        </button>
      </template>

      <div v-if="error" class="qt-banner qt-banner--warn">
        <AlertTriangle :size="16" />
        <span>{{ error }}</span>
      </div>

      <div v-if="hasFile" class="qt-stack" style="--qt-stack-gap:12px">
        <img :src="previewUrl!" class="ascii__preview" :alt="fileName" />
        <pre v-if="ascii" class="qt-output ascii__art">{{ ascii }}</pre>
      </div>

      <div v-if="!hasFile" class="ascii__placeholder">
        <Type :size="36" class="ascii__placeholder-icon" />
        <span>{{ t(U + 'empty') }}</span>
      </div>
    </ToolOutput>
  </div>
</template>

<style scoped>
/* Kept scoped: patterns unique to this tool (no generic utility). */

/* Re-render action (base via .qt-btn--ghost) — accent outline. */
.ascii__btn--primary {
  border-color: var(--qt-accent);
  color: var(--qt-accent);
}
/* Source-image preview — bordered, capped. */
.ascii__preview {
  display: block;
  max-width: 100%;
  max-height: 200px;
  object-fit: contain;
  align-self: flex-start;
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius);
}
/* ASCII art (base via .qt-output) — tiny mono, no-wrap, scrollable. */
.ascii__art {
  margin: 0;
  font-size: 8px;
  line-height: 1.1;
  white-space: pre;
  overflow: auto;
  max-height: 480px;
}
/* Centered empty state — big icon + prompt. */
.ascii__placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 32px 16px;
  color: var(--qt-muted);
  font-size: 13px;
  text-align: center;
}
.ascii__placeholder-icon {
  opacity: 0.4;
}
</style>
