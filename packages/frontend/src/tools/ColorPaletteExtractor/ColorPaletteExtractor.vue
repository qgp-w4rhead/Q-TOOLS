<script setup lang="ts">
/**
 * ColorPaletteExtractor - extract the dominant colors from an uploaded
 * image via median-cut quantization. Swatches show HEX/RGB/HSL with
 * per-color copy; the palette exports as HEX list, RGB list, CSS variables,
 * Tailwind config, or JSON. Everything runs locally in the browser.
 *
 * Embed mode: accepts `colorCount`/`exportFormat`/`action` inputs and sends
 * `{ colors, export }` outputs.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { Trash2, AlertTriangle, Palette, RefreshCw } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import FileDropZone from '@/components/FileDropZone.vue';
import CopyButton from '@/components/CopyButton.vue';
import {
  useColorPaletteExtractor,
  rgbToHex,
  rgbToCss,
  rgbToHsl,
  textOn,
  buildExport,
  EXPORT_FORMATS,
  DEFAULT_COLOR_COUNT,
  MIN_COLOR_COUNT,
  MAX_COLOR_COUNT,
  type ExportFormat,
} from './useColorPaletteExtractor';
import { formatBytes } from '@/utils/media';

const {
  fileName,
  fileSizeBytes,
  previewUrl,
  hasFile,
  colorCount,
  colors,
  exportFormat,
  isExtracting,
  error,
  setFile,
  extract,
  reset,
} = useColorPaletteExtractor();

const { t } = useI18n();
const U = 'tools.color-palette-extractor.ui.';

const exportText = computed(() => buildExport(colors.value, exportFormat.value));

const FORMAT_KEYS: Record<ExportFormat, string> = {
  hex: 'fmtHex',
  rgb: 'fmtRgb',
  css: 'fmtCss',
  tailwind: 'fmtTailwind',
  json: 'fmtJson',
};
function formatLabel(f: ExportFormat): string {
  return t(U + FORMAT_KEYS[f]);
}

function onFiles(files: File[]): void {
  const f = files[0];
  if (f) void setFile(f);
}

function onFormat(e: Event): void {
  exportFormat.value = (e.target as HTMLSelectElement).value as ExportFormat;
}

function resetOptions(): void {
  colorCount.value = DEFAULT_COLOR_COUNT;
  exportFormat.value = 'hex';
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

      <div v-if="hasFile" class="qt-grid" style="--qt-grid-min:180px;--qt-grid-gap:12px">
        <label class="qt-field">
          <span class="qt-label">{{ t(U + 'colors') }} · {{ colorCount }}</span>
          <input
            v-model.number="colorCount"
            class="qt-range"
            style="width:100%"
            type="range"
            :min="MIN_COLOR_COUNT"
            :max="MAX_COLOR_COUNT"
            step="1"
          />
        </label>
        <label class="qt-field">
          <span class="qt-label">{{ t(U + 'exportFormat') }}</span>
          <select class="qt-input" :value="exportFormat" @change="onFormat">
            <option v-for="f in EXPORT_FORMATS" :key="f" :value="f">{{ formatLabel(f) }}</option>
          </select>
        </label>
      </div>
    </ToolInput>

    <ToolOutput
      :title="t(U + 'outputTitle')"
      :description="hasFile ? t(U + 'descFile', { name: fileName, size: formatBytes(fileSizeBytes) }) : t('common.noImageLoaded')"
      :copy-text="exportText"
      :copy-label="t(U + 'copyExport')"
    >
      <template #actions>
        <button
          type="button"
          class="qt-btn qt-btn--ghost qt-btn--sm palette__btn--primary"
          :disabled="!hasFile || isExtracting"
          @click="extract"
        >
          <RefreshCw :size="14" /> {{ isExtracting ? t(U + 'extracting') : t(U + 'reextract') }}
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
        <img :src="previewUrl!" class="palette__preview" :alt="fileName" />

        <div v-if="colors.length" class="qt-grid" style="--qt-grid-min:120px;--qt-grid-gap:8px">
          <div
            v-for="(c, i) in colors"
            :key="i"
            class="palette__swatch"
            :style="{ background: rgbToHex(c), color: textOn(c) }"
          >
            <span class="qt-mono" style="font-size:13px;font-weight:700">{{ rgbToHex(c) }}</span>
            <span class="qt-mono" style="font-size:10px;opacity:0.85">{{ rgbToCss(c) }}</span>
            <span class="qt-mono" style="font-size:10px;opacity:0.85">{{ rgbToHsl(c) }}</span>
            <span style="font-size:10px;opacity:0.7;margin-top:auto">{{ (c.weight * 100).toFixed(1) }}%</span>
            <CopyButton :text="rgbToHex(c)" label="" style="position:absolute;top:6px;right:6px" />
          </div>
        </div>

        <div v-if="exportText">
          <pre class="qt-output palette__code">{{ exportText }}</pre>
        </div>
      </div>

      <div v-if="!hasFile" class="palette__placeholder">
        <Palette :size="36" class="palette__placeholder-icon" />
        <span>{{ t(U + 'empty') }}</span>
      </div>
    </ToolOutput>
  </div>
</template>

<style scoped>
/* Kept scoped: patterns unique to this tool (no generic utility). */

/* Re-extract action (base via .qt-btn--ghost) — accent outline. */
.palette__btn--primary {
  border-color: var(--qt-accent);
  color: var(--qt-accent);
}
/* Source-image preview — bordered, capped. */
.palette__preview {
  display: block;
  max-width: 100%;
  max-height: 240px;
  object-fit: contain;
  align-self: flex-start;
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius);
}
/* Swatch card — dynamic bg/text via inline style, min-height, copy overlay. */
.palette__swatch {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 10px;
  min-height: 76px;
  border-radius: var(--qt-radius);
  border: 1px solid var(--qt-border);
}
/* Export code (base via .qt-output) — no-wrap, scrollable. */
.palette__code {
  margin: 0;
  font-size: 11.5px;
  white-space: pre;
}
/* Centered empty state — big icon + prompt. */
.palette__placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 32px 16px;
  color: var(--qt-muted);
  font-size: 13px;
  text-align: center;
}
.palette__placeholder-icon {
  opacity: 0.4;
}
</style>
