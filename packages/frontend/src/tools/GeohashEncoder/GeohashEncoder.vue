<script setup lang="ts">
/**
 * GeohashEncoder - encode/decode lat/lon ↔ geohash.
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
import { useGeohashEncoder } from './useGeohashEncoder';

const { mode, latInput, lonInput, geohashInput, precision, snapshot, reset } = useGeohashEncoder();

const { t } = useI18n();
const U = 'tools.geohash-encoder.ui.';

const hasError = computed(() => snapshot.value !== null && !snapshot.value.ok);
const isEmpty = computed(() => snapshot.value === null);

const copyText = computed(() => {
  if (snapshot.value === null || !snapshot.value.ok) return '';
  const s = snapshot.value;
  if (mode.value === 'encode') return s.geohash ?? '';
  return `${s.lat}, ${s.lon}`;
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
        <label class="qt-field qt-field--grow">
          <span class="qt-label">{{ t(U + 'mode') }}</span>
          <select v-model="mode" class="qt-input" style="font-size:14px;padding:8px 10px">
            <option value="encode">{{ t(U + 'modeEncode') }}</option>
            <option value="decode">{{ t(U + 'modeDecode') }}</option>
          </select>
        </label>
      </div>

      <template v-if="mode === 'encode'">
        <div class="qt-row" style="--qt-row-gap:10px">
          <ToolField
            v-model="latInput"
            :label="t(U + 'latitude')"
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
            :label="t(U + 'longitude')"
            type="number"
            :placeholder="t(U + 'phLon')"
            step="any"
            min="-180"
            max="180"
            inputmode="decimal"
            grow
          />
          <label class="qt-field qt-field--grow">
            <span class="qt-label">{{ t(U + 'precision') }}</span>
            <select v-model.number="precision" class="qt-input" style="font-size:14px;padding:8px 10px">
              <option v-for="p in 12" :key="p" :value="p">{{ t(U + 'precisionChars', { n: p }) }}</option>
            </select>
          </label>
        </div>
      </template>
      <template v-else>
        <div class="qt-row" style="--qt-row-gap:10px">
          <ToolField
            v-model="geohashInput"
            :label="t(U + 'geohash')"
            :placeholder="t(U + 'phGeohash')"
            grow
          />
        </div>
      </template>
    </ToolInput>

    <ToolOutput
      :title="t('common.result')"
      :description="isEmpty ? t(U + 'descEmpty') : (hasError ? t(U + 'descAdjust') : t(U + 'descDone'))"
      :copy-text="copyText"
      :copy-label="mode === 'encode' ? t(U + 'copyGeohash') : t(U + 'copyCoords')"
    >
      <ToolAlert v-if="hasError" kind="error">{{ snapshot?.message }}</ToolAlert>
      <ToolAlert v-else-if="isEmpty" kind="empty">{{ t(U + 'descEmpty') }}</ToolAlert>
      <template v-else>
        <div class="qt-stack" style="--qt-stack-gap:8px">
          <div class="gh__hero">
            <ResultRow
              :label="mode === 'encode' ? t(U + 'lblGeohash') : t(U + 'lblCoords')"
              :value="mode === 'encode' ? snapshot!.geohash! : `${snapshot!.lat}, ${snapshot!.lon}`"
              size="sm"
            />
          </div>
          <ResultRow :label="t(U + 'precision')" :value="t(U + 'precisionChars', { n: snapshot!.precision })" size="sm" />
          <ResultRow
            :label="t(U + 'bbox')"
            :value="`${snapshot!.bbox!.minLat.toFixed(4)}, ${snapshot!.bbox!.minLon.toFixed(4)} → ${snapshot!.bbox!.maxLat.toFixed(4)}, ${snapshot!.bbox!.maxLon.toFixed(4)}`"
            size="sm"
          />
        </div>
      </template>
    </ToolOutput>
  </div>
</template>

<style scoped>
/* Kept scoped: hero accent border reaches into ResultRow via :deep. */
.gh__hero :deep(.rr) { border-width: 2px; border-color: var(--qt-accent); }
</style>
