<script setup lang="ts">
/**
 * BarcodeGenerator - generate barcodes with SVG preview.
 *
 * Supports CODE128, EAN-13, EAN-8, and UPC-A. Enter text or digits,
 * select the barcode type, and see the rendered barcode with the
 * encoded text below.
 *
 * Works in embed mode: receives `input` PostMessages to set the value
 * and sends `output` PostMessages with the encoded result.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { RotateCcw } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import { useBarcodeGenerator, type BarcodeType } from './useBarcodeGenerator';

const {
  input,
  type,
  result,
  reset,
} = useBarcodeGenerator();

function onInput(e: Event): void {
  input.value = (e.target as HTMLInputElement).value;
}

function onTypeChange(e: Event): void {
  type.value = (e.target as HTMLSelectElement).value as BarcodeType;
}

const { t } = useI18n();
const U = 'tools.barcode-generator.ui.';

const typeOptions: { value: BarcodeType; label: string }[] = [
  { value: 'code128', label: 'CODE128' },
  { value: 'ean13', label: 'EAN-13' },
  { value: 'ean8', label: 'EAN-8' },
  { value: 'upca', label: 'UPC-A' },
];

const MODULE_WIDTH = 2;
const BAR_HEIGHT = 100;
const TEXT_HEIGHT = 20;
const QUIET_ZONE = 10;

const totalWidth = computed(() => {
  if (!result.value || !result.value.valid) return 0;
  const moduleCount = result.value.bars.reduce((a, b) => a + b, 0);
  return moduleCount * MODULE_WIDTH + QUIET_ZONE * 2;
});

const svgHeight = computed(() => BAR_HEIGHT + TEXT_HEIGHT);

interface BarRect {
  x: number;
  width: number;
}

const barRects = computed<BarRect[]>(() => {
  if (!result.value || !result.value.valid) return [];
  const rects: BarRect[] = [];
  let x = QUIET_ZONE;
  let isBar = true;
  for (const width of result.value.bars) {
    if (isBar) {
      rects.push({ x, width: width * MODULE_WIDTH });
    }
    x += width * MODULE_WIDTH;
    isBar = !isBar;
  }
  return rects;
});
</script>

<template>
  <div class="qt-tool">
    <ToolInput
      :title="t(U + 'inputTitle')"
      :description="t(U + 'desc')"
    >
      <template #actions>
        <button
          type="button"
          class="qt-btn qt-btn--ghost"
          :title="t(U + 'resetTitle')"
          @click="reset"
        >
          <RotateCcw :size="14" />
          <span>{{ t('common.reset') }}</span>
        </button>
      </template>

      <label class="qt-field">
        <span class="qt-label">{{ t(U + 'typeLabel') }}</span>
        <select
          class="qt-input qt-input--mono"
          :value="type"
          @change="onTypeChange"
        >
          <option v-for="opt in typeOptions" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </option>
        </select>
      </label>

      <label class="qt-field">
        <span class="qt-label">{{ type === 'code128' ? t(U + 'labelText') : t(U + 'labelDigits') }}</span>
        <input
          type="text"
          class="qt-input qt-input--mono"
          :placeholder="type === 'code128' ? t(U + 'phCode128') : type === 'ean13' ? t(U + 'phEan13') : type === 'ean8' ? t(U + 'phEan8') : t(U + 'phUpca')"
          :value="input"
          @input="onInput"
        />
      </label>
    </ToolInput>

    <ToolOutput
      :title="t(U + 'outputTitle')"
      :description="result ? (result.valid ? t(U + 'descDone') : t(U + 'descInvalid')) : t(U + 'descEmpty')"
      hide-copy
    >
      <div v-if="!result" class="qt-alert qt-alert--empty">
        {{ t(U + 'descEmpty') }}
      </div>
      <div v-else class="qt-stack" style="--qt-stack-gap:16px">
        <div v-if="result.errors.length > 0" class="qt-stack" style="--qt-stack-gap:4px">
          <div v-for="(err, i) in result.errors" :key="i" class="bc__error">
            {{ err }}
          </div>
        </div>

        <div v-if="result.valid && barRects.length > 0" class="bc__preview">
          <svg
            :width="totalWidth"
            :height="svgHeight"
            :viewBox="`0 0 ${totalWidth} ${svgHeight}`"
            xmlns="http://www.w3.org/2000/svg"
            class="bc__svg"
          >
            <rect :width="totalWidth" :height="svgHeight" fill="var(--qt-bg)" />
            <g v-for="(rect, i) in barRects" :key="i">
              <rect
                :x="rect.x"
                :y="0"
                :width="rect.width"
                :height="BAR_HEIGHT"
                fill="var(--qt-text)"
              />
            </g>
            <text
              :x="totalWidth / 2"
              :y="BAR_HEIGHT + 14"
              text-anchor="middle"
              class="bc__svg-text"
              fill="var(--qt-text)"
            >{{ result.text }}</text>
          </svg>
        </div>

        <div v-if="result.valid" class="qt-stack">
          <div class="qt-result-row">
            <span class="qt-label" style="min-width:100px">{{ t(U + 'encodedText') }}</span>
            <span class="qt-value qt-value--sm" style="flex:1">{{ result.text }}</span>
          </div>
          <div class="qt-result-row">
            <span class="qt-label" style="min-width:100px">{{ t(U + 'modules') }}</span>
            <span class="qt-value qt-value--sm" style="flex:1">{{ result.bars.reduce((a, b) => a + b, 0) }}</span>
          </div>
        </div>
      </div>
    </ToolOutput>
  </div>
</template>

<style scoped>
/* Kept scoped: patterns unique to this tool (no generic utility). */

/* Per-error item — compact danger-tinted box. */
.bc__error {
  font-size: 13px;
  color: var(--qt-danger);
  padding: 6px 10px;
  border: 1px solid var(--qt-danger);
  border-radius: var(--qt-radius-sm);
  background: oklch(from var(--qt-danger) 40% c h / 0.08);
}

/* Barcode SVG preview — scrollable bordered box, centered svg. */
.bc__preview {
  overflow-x: auto;
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  background: var(--qt-bg);
  padding: 12px;
}
.bc__svg {
  display: block;
  margin: 0 auto;
  max-width: 100%;
}
.bc__svg-text {
  font-family: var(--qt-font-mono);
  font-size: 13px;
  font-weight: 600;
}
</style>
