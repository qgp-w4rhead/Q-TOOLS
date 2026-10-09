<script setup lang="ts">
/**
 * BoundingBoxCalculator - center + radius → bounding box.
 */
import { RotateCcw } from 'lucide-vue-next';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import ToolField from '@/components/ToolField.vue';
import ToolButton from '@/components/ToolButton.vue';
import ToolAlert from '@/components/ToolAlert.vue';
import ResultRow from '@/components/ResultRow.vue';
import {
  useBoundingBoxCalculator,
  formatBBox,
  formatGeoJSONBBox,
} from './useBoundingBoxCalculator';

const { latInput, lonInput, radiusInput, unit, snapshot, reset } = useBoundingBoxCalculator();

const { t } = useI18n();
const U = 'tools.bounding-box-calculator.ui.';

const hasError = computed(() => snapshot.value !== null && !snapshot.value.ok);
const isEmpty = computed(() => snapshot.value === null);

const copyText = computed(() => {
  if (snapshot.value === null || !snapshot.value.ok) return '';
  return formatGeoJSONBBox(snapshot.value);
});

</script>

<template>
  <div class="qt-tool">
    <ToolInput
      :title="t(U + 'inputTitle')"
      :description="t(U + 'desc')"
    >
      <template #actions>
        <ToolButton :title="t(U + 'resetTitle')" @click="reset">
          <RotateCcw :size="14" />
          <span>{{ t('common.reset') }}</span>
        </ToolButton>
      </template>

      <div class="qt-row" style="--qt-row-gap:10px">
        <ToolField
          v-model="latInput"
          :label="t(U + 'centerLat')"
          type="number"
          :placeholder="t(U + 'phLat')"
          step="any"
          min="-90"
          max="90"
          inputmode="decimal"
          grow
        />
        <ToolField
          v-model="lonInput"
          :label="t(U + 'centerLon')"
          type="number"
          :placeholder="t(U + 'phLon')"
          step="any"
          min="-180"
          max="180"
          inputmode="decimal"
          grow
        />
        <ToolField
          v-model="radiusInput"
          :label="t(U + 'radius')"
          type="number"
          :placeholder="t(U + 'phRadius')"
          step="any"
          min="0"
          inputmode="decimal"
          grow
        />
        <label class="qt-field qt-field--grow">
          <span class="qt-label">{{ t(U + 'unit') }}</span>
          <select v-model="unit" class="qt-input" style="font-size:14px;padding:8px 10px">
            <option value="km">{{ t(U + 'unitKm') }}</option>
            <option value="mi">{{ t(U + 'unitMi') }}</option>
            <option value="m">{{ t(U + 'unitM') }}</option>
            <option value="nmi">{{ t(U + 'unitNmi') }}</option>
          </select>
        </label>
      </div>
    </ToolInput>

    <ToolOutput
      :title="t('common.result')"
      :description="isEmpty ? t(U + 'descEmpty') : (hasError ? t(U + 'descAdjust') : t(U + 'descDone'))"
      :copy-text="copyText"
      :copy-label="t(U + 'copyGeojson')"
    >
      <ToolAlert v-if="hasError" kind="error">{{ snapshot?.message }}</ToolAlert>
      <ToolAlert v-else-if="isEmpty" kind="empty">
        {{ t(U + 'emptyAlert') }}
      </ToolAlert>
      <template v-else>
        <div class="qt-grid" style="--qt-grid-min:140px">
          <div class="bb__hero">
            <ResultRow :label="t(U + 'lblBbox')" :value="formatBBox(snapshot!)" size="sm" />
          </div>
          <ResultRow :label="t(U + 'lblGeojson')" :value="formatGeoJSONBBox(snapshot!)" size="sm" />
          <ResultRow
            :label="t(U + 'lblMin')"
            :value="`${snapshot!.minLat}, ${snapshot!.minLon}`"
            size="sm"
          />
          <ResultRow
            :label="t(U + 'lblMax')"
            :value="`${snapshot!.maxLat}, ${snapshot!.maxLon}`"
            size="sm"
          />
          <ResultRow
            :label="t(U + 'lblWidthHeight')"
            :value="`${snapshot!.width}° × ${snapshot!.height}°`"
            size="sm"
          />
        </div>
      </template>
    </ToolOutput>
  </div>
</template>

<style scoped>
/* Kept scoped: hero accent border reaches into ResultRow via :deep. */
.bb__hero :deep(.rr) { border-width: 2px; border-color: var(--qt-accent); }
</style>
