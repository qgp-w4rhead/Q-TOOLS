<script setup lang="ts">
/**
 * ImageResizer - scale one or more images by pixels or percent with an
 * aspect-ratio lock, then re-encode via Canvas and download individually
 * or all at once. Everything runs locally in the browser.
 *
 * Embed mode: accepts `mode`/`percent`/`width`/`height`/`lockAspect`/
 * `format`/`action` inputs and sends status outputs.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { Download, Trash2, AlertTriangle, Scaling, X } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import FileDropZone from '@/components/FileDropZone.vue';
import {
  useImageResizer,
  DEFAULT_MODE,
  DEFAULT_PERCENT,
  DEFAULT_WIDTH,
  DEFAULT_HEIGHT,
  type ResizeMode,
} from './useImageResizer';
import { formatSupportsAlpha, formatSupportsQuality, type RasterFormat } from '@/utils/image';
import { formatBytes } from '@/utils/media';

const {
  items,
  mode,
  percent,
  width,
  height,
  lockAspect,
  format,
  quality,
  background,
  encodableFormats,
  isResizing,
  error,
  addFiles,
  removeItem,
  resizeAll,
  downloadItem,
  downloadAll,
  reset,
} = useImageResizer();

const qualityPct = computed({
  get: () => Math.round(quality.value * 100),
  set: (v: number) => {
    quality.value = Math.min(100, Math.max(1, v)) / 100;
  },
});

const showQuality = computed(() => formatSupportsQuality(format.value));
const showBackground = computed(() => !formatSupportsAlpha(format.value));
const resizedCount = computed(() => items.value.filter((i) => i.blob !== null).length);
const { t } = useI18n();
const U = 'tools.image-resizer.ui.';

const formatOptions: RasterFormat[] = ['png', 'jpeg', 'webp', 'avif'];

function onFiles(files: File[]): void {
  void addFiles(files);
}

function onMode(e: Event): void {
  mode.value = (e.target as HTMLSelectElement).value as ResizeMode;
}
function onFormat(e: Event): void {
  format.value = (e.target as HTMLSelectElement).value as RasterFormat;
}

function resetOptions(): void {
  mode.value = DEFAULT_MODE;
  percent.value = DEFAULT_PERCENT;
  width.value = DEFAULT_WIDTH;
  height.value = DEFAULT_HEIGHT;
  lockAspect.value = true;
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
        multiple
        :title="t(U + 'dropTitle')"
        :hint="t(U + 'dropHint')"
        @files="onFiles"
      />

      <div class="qt-grid" style="--qt-grid-min:160px;--qt-grid-gap:12px;align-items:end">
        <label class="qt-field">
          <span class="qt-label">{{ t(U + 'scaleBy') }}</span>
          <select class="qt-input" :value="mode" @change="onMode">
            <option value="percent">{{ t(U + 'modePercent') }}</option>
            <option value="pixels">{{ t(U + 'modePixels') }}</option>
          </select>
        </label>

        <label v-if="mode === 'percent'" class="qt-field">
          <span class="qt-label">{{ t(U + 'percent') }} · {{ percent }}%</span>
          <input v-model.number="percent" class="qt-range" style="width:100%" type="range" min="1" max="400" step="1" />
        </label>

        <template v-else>
          <label class="qt-field">
            <span class="qt-label">{{ t(U + 'widthPx') }}</span>
            <input v-model.number="width" class="qt-input" type="number" min="1" max="16384" />
          </label>
          <label class="qt-field">
            <span class="qt-label">{{ t(U + 'heightPx') }}</span>
            <input
              v-model.number="height"
              class="qt-input"
              type="number"
              min="1"
              max="16384"
              :disabled="lockAspect"
            />
          </label>
          <label class="qt-check" style="padding-bottom:8px">
            <input v-model="lockAspect" type="checkbox" />
            <span class="qt-label">{{ t(U + 'lockAspect') }}</span>
          </label>
        </template>

        <label class="qt-field">
          <span class="qt-label">{{ t('common.outputFormat') }}</span>
          <select class="qt-input" :value="format" @change="onFormat">
            <option
              v-for="f in formatOptions"
              :key="f"
              :value="f"
              :disabled="!encodableFormats.includes(f)"
            >
              {{ f === 'jpeg' ? 'JPEG' : f.toUpperCase() }}{{ encodableFormats.includes(f) ? '' : ` (${t('common.unsupported')})` }}
            </option>
          </select>
        </label>

        <label v-if="showQuality" class="qt-field">
          <span class="qt-label">{{ t('common.quality') }} · {{ qualityPct }}%</span>
          <input v-model.number="qualityPct" class="qt-range" style="width:100%" type="range" min="1" max="100" step="1" />
        </label>

        <label v-if="showBackground" class="qt-field">
          <span class="qt-label">{{ t('common.background') }}</span>
          <input v-model="background" class="imgres__color" type="color" />
        </label>
      </div>
    </ToolInput>

    <ToolOutput
      :title="t(U + 'outputTitle')"
      :description="items.length ? t(U + 'descImages', { count: items.length, resized: resizedCount }) : t(U + 'descEmpty')"
      hide-copy
    >
      <template #actions>
        <button
          type="button"
          class="qt-btn qt-btn--ghost qt-btn--sm imgres__btn--primary"
          :disabled="items.length === 0 || isResizing"
          @click="resizeAll"
        >
          <Scaling :size="14" /> {{ isResizing ? t(U + 'resizing') : t(U + 'resizeAll') }}
        </button>
        <button
          type="button"
          class="qt-btn qt-btn--ghost qt-btn--sm"
          :disabled="resizedCount === 0"
          :title="t(U + 'downloadAllTitle')"
          @click="downloadAll"
        >
          <Download :size="14" /> {{ t(U + 'downloadAll') }}
        </button>
        <button type="button" class="qt-btn qt-btn--ghost qt-btn--sm" :disabled="items.length === 0" :title="t('common.clear')" @click="reset">
          <Trash2 :size="14" /> {{ t('common.clear') }}
        </button>
      </template>

      <div v-if="error" class="qt-banner qt-banner--warn">
        <AlertTriangle :size="16" />
        <span>{{ error }}</span>
      </div>

      <ul v-if="items.length" class="qt-list qt-stack" style="--qt-stack-gap:8px">
        <li v-for="item in items" :key="item.id" class="qt-panel qt-row qt-row--center qt-row--nowrap" style="--qt-row-gap:12px;padding:8px">
          <img :src="item.outputUrl ?? item.sourceUrl" class="imgres__thumb" :alt="item.name" />
          <div class="qt-stack" style="--qt-stack-gap:2px;min-width:0;flex:1">
            <span class="imgres__name" :title="item.name">{{ item.name }}</span>
            <span class="qt-hint" style="font-variant-numeric:tabular-nums">
              {{ item.srcWidth }}×{{ item.srcHeight }} · {{ formatBytes(item.inputSizeBytes) }}
              <template v-if="item.blob">
                → {{ item.outWidth }}×{{ item.outHeight }} · {{ formatBytes(item.outputSizeBytes) }}
              </template>
            </span>
            <span v-if="item.error" class="imgres__row-error">{{ item.error }}</span>
          </div>
          <div class="qt-row qt-row--nowrap" style="--qt-row-gap:6px;flex-shrink:0">
            <button
              type="button"
              class="qt-btn qt-btn--ghost qt-btn--icon"
              :disabled="!item.blob"
              :title="t(U + 'downloadItemTitle')"
              @click="downloadItem(item.id)"
            >
              <Download :size="14" />
            </button>
            <button
              type="button"
              class="qt-btn qt-btn--ghost qt-btn--icon"
              :title="t('common.remove')"
              @click="removeItem(item.id)"
            >
              <X :size="14" />
            </button>
          </div>
        </li>
      </ul>
      <div v-else class="imgres__placeholder">
        <Scaling :size="36" class="imgres__placeholder-icon" />
        <span>{{ t(U + 'empty') }}</span>
      </div>
    </ToolOutput>
  </div>
</template>

<style scoped>
/* Kept scoped: patterns unique to this tool (no generic utility). */

/* Background colour swatch — small 48×32 picker. */
.imgres__color {
  width: 48px;
  height: 32px;
  padding: 2px;
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  background: var(--qt-bg);
  cursor: pointer;
}
/* Resize action (base via .qt-btn--ghost) — accent outline. */
.imgres__btn--primary {
  border-color: var(--qt-accent);
  color: var(--qt-accent);
}
/* Row thumbnail — fixed 48px square, cropped. */
.imgres__thumb {
  width: 48px;
  height: 48px;
  object-fit: cover;
  border-radius: var(--qt-radius-sm);
  border: 1px solid var(--qt-border);
  flex-shrink: 0;
}
/* Filename — single-line ellipsis. */
.imgres__name {
  font-size: 13px;
  font-weight: 600;
  color: var(--qt-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
/* Per-row error — small danger text. */
.imgres__row-error {
  font-size: 11px;
  color: var(--qt-danger, #ef4444);
}
/* Centered empty state — big icon + prompt. */
.imgres__placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 32px 16px;
  color: var(--qt-muted);
  font-size: 13px;
  text-align: center;
}
.imgres__placeholder-icon {
  opacity: 0.4;
}
</style>
