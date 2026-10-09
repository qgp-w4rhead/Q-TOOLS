<script setup lang="ts">
/**
 * TimezoneFromCoordinates - estimate timezone from lat/lon.
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
import { useTimezoneFromCoordinates } from './useTimezoneFromCoordinates';

const { latInput, lonInput, snapshot, reset } = useTimezoneFromCoordinates();

const { t } = useI18n();
const U = 'tools.timezone-from-coordinates.ui.';

const hasError = computed(() => snapshot.value !== null && !snapshot.value.ok);
const isEmpty = computed(() => snapshot.value === null);

const copyText = computed(() => {
  if (snapshot.value === null || !snapshot.value.ok) return '';
  return snapshot.value.utcOffsetLabel ?? '';
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
      </div>
    </ToolInput>

    <ToolOutput
      :title="t('common.result')"
      :description="isEmpty ? t(U + 'descEmpty') : (hasError ? t(U + 'descAdjust') : t(U + 'descDone'))"
      :copy-text="copyText"
      :copy-label="t(U + 'copyOffset')"
    >
      <ToolAlert v-if="hasError" kind="error">{{ snapshot?.message }}</ToolAlert>
      <ToolAlert v-else-if="isEmpty" kind="empty">
        {{ t(U + 'emptyAlert') }}
      </ToolAlert>
      <template v-else>
        <div class="qt-grid" style="--qt-grid-min:140px">
          <div class="tz__hero">
            <ResultRow :label="t(U + 'lblUtcOffset')" :value="snapshot!.utcOffsetLabel!" size="sm" />
          </div>
          <ResultRow :label="t(U + 'lblTimezone')" :value="snapshot!.estimatedTimezone!" size="sm" />
          <ResultRow :label="t(U + 'lblOffsetHours')" :value="String(snapshot!.utcOffsetHours)" size="sm" />
          <ResultRow :label="t(U + 'lblLocalTime')" :value="snapshot!.localTime!" size="sm" />
        </div>
      </template>
    </ToolOutput>
  </div>
</template>

<style scoped>
/* Kept scoped: hero accent border reaches into ResultRow via :deep. */
.tz__hero :deep(.rr) { border-width: 2px; border-color: var(--qt-accent); }
</style>
