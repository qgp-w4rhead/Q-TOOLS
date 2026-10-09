<script setup lang="ts">
/**
 * DistanceCalculator - Haversine / Vincenty great-circle distance.
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
  useDistanceCalculator,
  formatDistance,
  formatBearing,
} from './useDistanceCalculator';

const { lat1, lon1, lat2, lon2, formula, unit, snapshot, reset } = useDistanceCalculator();

const { t } = useI18n();
const U = 'tools.distance-calculator.ui.';

const hasError = computed(() => snapshot.value !== null && !snapshot.value.ok);
const isEmpty = computed(() => snapshot.value === null);

const copyText = computed(() => {
  if (snapshot.value === null || !snapshot.value.ok) return '';
  return formatDistance(snapshot.value.distance!, snapshot.value.unit!);
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

      <div class="qt-stack" style="--qt-stack-gap:6px">
        <span class="qt-label" style="font-size:13px;font-weight:700;color:var(--qt-text)">{{ t(U + 'pointA') }}</span>
        <div class="qt-row" style="--qt-row-gap:10px">
          <ToolField
            v-model="lat1"
            :label="t(U + 'latitude')"
            type="number"
            :placeholder="t(U + 'phLat1')"
            step="any"
            min="-90"
            max="90"
            inputmode="decimal"
            grow
          />
          <ToolField
            v-model="lon1"
            :label="t(U + 'longitude')"
            type="number"
            :placeholder="t(U + 'phLon1')"
            step="any"
            min="-180"
            max="180"
            inputmode="decimal"
            grow
          />
        </div>
      </div>

      <div class="qt-stack" style="--qt-stack-gap:6px">
        <span class="qt-label" style="font-size:13px;font-weight:700;color:var(--qt-text)">{{ t(U + 'pointB') }}</span>
        <div class="qt-row" style="--qt-row-gap:10px">
          <ToolField
            v-model="lat2"
            :label="t(U + 'latitude')"
            type="number"
            :placeholder="t(U + 'phLat2')"
            step="any"
            min="-90"
            max="90"
            inputmode="decimal"
            grow
          />
          <ToolField
            v-model="lon2"
            :label="t(U + 'longitude')"
            type="number"
            :placeholder="t(U + 'phLon2')"
            step="any"
            min="-180"
            max="180"
            inputmode="decimal"
            grow
          />
        </div>
      </div>

      <div class="qt-row" style="--qt-row-gap:10px">
        <label class="qt-field qt-field--grow">
          <span class="qt-label">{{ t(U + 'formula') }}</span>
          <select v-model="formula" class="qt-input" style="font-size:14px;padding:8px 10px">
            <option value="haversine">{{ t(U + 'formulaHaversine') }}</option>
            <option value="vincenty">{{ t(U + 'formulaVincenty') }}</option>
          </select>
        </label>
        <label class="qt-field qt-field--grow">
          <span class="qt-label">{{ t(U + 'unit') }}</span>
          <select v-model="unit" class="qt-input" style="font-size:14px;padding:8px 10px">
            <option value="km">{{ t(U + 'unitKm') }}</option>
            <option value="mi">{{ t(U + 'unitMi') }}</option>
            <option value="m">{{ t(U + 'unitM') }}</option>
            <option value="ft">{{ t(U + 'unitFt') }}</option>
            <option value="nmi">{{ t(U + 'unitNmi') }}</option>
          </select>
        </label>
      </div>
    </ToolInput>

    <ToolOutput
      :title="t('common.result')"
      :description="isEmpty ? t(U + 'descEmpty') : (hasError ? t(U + 'descAdjust') : t(U + 'descDone'))"
      :copy-text="copyText"
      :copy-label="t(U + 'copyDistance')"
    >
      <ToolAlert v-if="hasError" kind="error">{{ snapshot?.message }}</ToolAlert>
      <ToolAlert v-else-if="isEmpty" kind="empty">
        {{ t(U + 'emptyAlert') }}
      </ToolAlert>
      <template v-else>
        <div class="qt-grid" style="--qt-grid-min:140px">
          <div class="dc__hero">
            <ResultRow
              :label="t(U + 'lblDistance')"
              :value="formatDistance(snapshot!.distance!, snapshot!.unit!)"
              size="sm"
            />
          </div>
          <ResultRow
            :label="t(U + 'lblDistanceM')"
            :value="`${snapshot!.distanceM!.toLocaleString('en-US', { maximumFractionDigits: 1 })} m`"
            size="sm"
          />
          <ResultRow
            :label="t(U + 'lblBearing')"
            :value="formatBearing(snapshot!.bearing!)"
            size="sm"
          />
          <ResultRow
            :label="t(U + 'lblFormula')"
            :value="snapshot!.formula === 'haversine' ? 'Haversine' : 'Vincenty'"
            size="sm"
          />
        </div>
      </template>
    </ToolOutput>
  </div>
</template>

<style scoped>
/* Kept scoped: hero accent border reaches into ResultRow via :deep. */
.dc__hero :deep(.rr) { border-width: 2px; border-color: var(--qt-accent); }
</style>
