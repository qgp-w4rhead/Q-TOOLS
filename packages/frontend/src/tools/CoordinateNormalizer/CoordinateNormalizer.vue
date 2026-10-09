<script setup lang="ts">
/**
 * CoordinateNormalizer - parse various formats → standard decimal degrees.
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
import { useCoordinateNormalizer } from './useCoordinateNormalizer';

const { input, snapshot, reset } = useCoordinateNormalizer();

const { t } = useI18n();
const U = 'tools.coordinate-normalizer.ui.';

const hasError = computed(() => snapshot.value !== null && !snapshot.value.ok);
const isEmpty = computed(() => snapshot.value === null);

const copyText = computed(() => {
  if (snapshot.value === null || !snapshot.value.ok) return '';
  return snapshot.value.formatted ?? '';
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
          v-model="input"
          as="textarea"
          mono
          grow
          :label="t(U + 'inputCoords')"
          :placeholder="t(U + 'placeholder')"
          :rows="3"
        />
      </div>
    </ToolInput>

    <ToolOutput
      :title="t(U + 'outputTitle')"
      :description="isEmpty ? t(U + 'descEmpty') : (hasError ? t(U + 'descError') : t(U + 'descDone'))"
      :copy-text="copyText"
      :copy-label="t(U + 'copyDecimal')"
    >
      <ToolAlert v-if="hasError" kind="error">{{ snapshot?.message }}</ToolAlert>
      <ToolAlert v-else-if="isEmpty" kind="empty">
        {{ t(U + 'emptyAlert') }}
      </ToolAlert>
      <template v-else>
        <div class="qt-grid" style="--qt-grid-min:140px">
          <div class="cn__hero">
            <ResultRow :label="t(U + 'lblDecimal')" :value="snapshot!.formatted!" size="sm" />
          </div>
          <ResultRow :label="t(U + 'lblDms')" :value="snapshot!.dmsFormatted!" size="sm" />
          <ResultRow :label="t(U + 'lblDetected')" :value="snapshot!.detectedFormat!" size="sm" />
          <ResultRow :label="t(U + 'lblLat')" :value="String(snapshot!.normalized!.lat)" size="sm" />
          <ResultRow :label="t(U + 'lblLon')" :value="String(snapshot!.normalized!.lon)" size="sm" />
        </div>
      </template>
    </ToolOutput>
  </div>
</template>

<style scoped>
/* Kept scoped: hero accent border reaches into ResultRow via :deep. */
.cn__hero :deep(.rr) { border-width: 2px; border-color: var(--qt-accent); }
</style>
