<script setup lang="ts">
/**
 * CoordinateConverter - convert between decimal, DMS, UTM, and MGRS.
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
  useCoordinateConverter,
  formatDMS,
  formatUTM,
  formatMGRS,
} from './useCoordinateConverter';

const { input, format, snapshot, reset } = useCoordinateConverter();

const { t } = useI18n();
const U = 'tools.coordinate-converter.ui.';

const hasError = computed(() => snapshot.value !== null && !snapshot.value.ok);
const isEmpty = computed(() => snapshot.value === null);

const copyText = computed(() => {
  if (snapshot.value === null || !snapshot.value.ok) return '';
  const s = snapshot.value;
  return [
    `${t(U + 'lblDecimal')}: ${s.decimal!.lat}, ${s.decimal!.lon}`,
    `${t(U + 'lblDms')}: ${formatDMS(s.dms!)}`,
    `${t(U + 'lblUtm')}: ${formatUTM(s.utm!)}`,
    `${t(U + 'lblMgrs')}: ${formatMGRS(s.mgrs!)}`,
  ].join('\n');
});

const placeholder = computed(() => {
  switch (format.value) {
    case 'decimal': return t(U + 'phDecimal');
    case 'dms': return t(U + 'phDms');
    case 'utm': return t(U + 'phUtm');
    case 'mgrs': return t(U + 'phMgrs');
  }
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
          <span class="qt-label">{{ t(U + 'inputFormat') }}</span>
          <select v-model="format" class="qt-input" style="font-size:14px;padding:8px 10px">
            <option value="decimal">{{ t(U + 'fmtDecimal') }}</option>
            <option value="dms">{{ t(U + 'fmtDms') }}</option>
            <option value="utm">{{ t(U + 'fmtUtm') }}</option>
            <option value="mgrs">{{ t(U + 'fmtMgrs') }}</option>
          </select>
        </label>
      </div>
      <div class="qt-row" style="--qt-row-gap:10px">
        <ToolField
          v-model="input"
          as="textarea"
          mono
          grow
          :label="t(U + 'coordinates')"
          :placeholder="placeholder"
          :rows="2"
        />
      </div>
    </ToolInput>

    <ToolOutput
      :title="t(U + 'outputTitle')"
      :description="isEmpty ? t(U + 'descEmpty') : (hasError ? t(U + 'descAdjust') : t(U + 'descDone'))"
      :copy-text="copyText"
      :copy-label="t('common.copyAll')"
    >
      <ToolAlert v-if="hasError" kind="error">{{ snapshot?.message }}</ToolAlert>
      <ToolAlert v-else-if="isEmpty" kind="empty">
        {{ t(U + 'emptyAlert') }}
      </ToolAlert>
      <template v-else>
        <div class="qt-stack" style="--qt-stack-gap:8px">
          <ResultRow
            :label="t(U + 'lblDecimal')"
            :value="`${snapshot!.decimal!.lat}, ${snapshot!.decimal!.lon}`"
            size="sm"
          />
          <ResultRow :label="t(U + 'lblDms')" :value="formatDMS(snapshot!.dms!)" size="sm" />
          <ResultRow :label="t(U + 'lblUtm')" :value="formatUTM(snapshot!.utm!)" size="sm" />
          <ResultRow :label="t(U + 'lblMgrs')" :value="formatMGRS(snapshot!.mgrs!)" size="sm" />
        </div>
      </template>
    </ToolOutput>
  </div>
</template>
