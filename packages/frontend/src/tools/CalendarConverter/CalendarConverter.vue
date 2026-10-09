<script setup lang="ts">
/**
 * CalendarConverter - calendar date conversions.
 *
 * Enter a Gregorian date to see its Julian Day Number, day of week, day of
 * year, ISO 8601 week number, equivalent Julian calendar date, and leap
 * year status. A reverse input converts a Julian Day Number back to
 * Gregorian + Julian dates.
 *
 * Works in embed mode: receives `input` PostMessages (date or jdn) and
 * sends `output` PostMessages with the computed result.
 */
import { useI18n } from 'vue-i18n';
import { RotateCcw } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import ToolField from '@/components/ToolField.vue';
import ToolButton from '@/components/ToolButton.vue';
import ToolAlert from '@/components/ToolAlert.vue';
import CopyButton from '@/components/CopyButton.vue';
import { useCalendarConverter } from './useCalendarConverter';

const { t } = useI18n();
const U = 'tools.calendar-converter.ui.';

const {
  dateInput,
  jdnInput,
  result,
  jdnResult,
  reset,
} = useCalendarConverter();

</script>

<template>
  <div class="qt-tool">
    <ToolInput
      :title="t(U + 'inputTitle')"
      :description="t(U + 'desc')"
    >
      <template #actions>
        <ToolButton :title="t('common.resetDefaults')" @click="reset">
          <RotateCcw :size="14" />
          <span>{{ t('common.reset') }}</span>
        </ToolButton>
      </template>

      <div class="qt-row">
        <ToolField
          v-model="dateInput"
          :label="t(U + 'dateLabel')"
          type="date"
          grow
        />
        <ToolField
          v-model="jdnInput"
          :label="t(U + 'jdnLabel')"
          type="number"
          step="1"
          min="0"
          :placeholder="t(U + 'phJdn')"
          grow
        />
      </div>
    </ToolInput>

    <ToolOutput
      :title="t('common.result')"
      :description="result ? t(U + 'descResult', { date: result.gregorian }) : t(U + 'descEmpty')"
    >
      <div v-if="result" class="qt-stack" style="--qt-stack-gap:8px">
        <div class="qt-result-row">
          <span class="qt-result-label">{{ t(U + 'rowGregorian') }}</span>
          <span class="qt-value" style="font-size:14px">{{ result.gregorian }}</span>
          <CopyButton :text="result.gregorian" :label="t('common.copy')" icon-only />
        </div>
        <div class="qt-result-row">
          <span class="qt-result-label">{{ t(U + 'rowJulian') }}</span>
          <span class="qt-value" style="font-size:14px">{{ result.julian }}</span>
          <CopyButton :text="result.julian" :label="t('common.copy')" icon-only />
        </div>
        <div class="qt-result-row">
          <span class="qt-result-label">{{ t(U + 'rowJdn') }}</span>
          <span class="qt-value" style="font-size:14px">{{ result.jdn }}</span>
          <CopyButton :text="String(result.jdn)" :label="t('common.copy')" icon-only />
        </div>
        <div class="qt-result-row">
          <span class="qt-result-label">{{ t(U + 'rowDow') }}</span>
          <span class="qt-value" style="font-size:14px">{{ result.dayOfWeek }}</span>
          <CopyButton :text="result.dayOfWeek" :label="t('common.copy')" icon-only />
        </div>
        <div class="qt-result-row">
          <span class="qt-result-label">{{ t(U + 'rowDoy') }}</span>
          <span class="qt-value" style="font-size:14px">{{ result.dayOfYear }}</span>
          <CopyButton :text="String(result.dayOfYear)" :label="t('common.copy')" icon-only />
        </div>
        <div class="qt-result-row">
          <span class="qt-result-label">{{ t(U + 'rowIsoWeek') }}</span>
          <span class="qt-value" style="font-size:14px">{{ result.isoYear }}-W{{ String(result.isoWeek).padStart(2, '0') }}</span>
          <CopyButton :text="`${result.isoYear}-W${String(result.isoWeek).padStart(2, '0')}`" :label="t('common.copy')" icon-only />
        </div>
        <div class="qt-result-row">
          <span class="qt-result-label">{{ t(U + 'rowLeap') }}</span>
          <span class="qt-value" style="font-size:14px">{{ result.isLeapYear ? t(U + 'yes') : t(U + 'no') }}</span>
          <CopyButton :text="result.isLeapYear ? t(U + 'yes') : t(U + 'no')" :label="t('common.copy')" icon-only />
        </div>
      </div>
      <ToolAlert v-else kind="empty">{{ t(U + 'alertEmpty') }}</ToolAlert>

      <div v-if="jdnResult" class="qt-stack" style="--qt-stack-gap:8px;border-top:1px solid var(--qt-border);padding-top:12px">
        <span style="font-size:12.5px;font-weight:700;color:var(--qt-text)">{{ t(U + 'jdnResolves', { jdn: jdnInput.trim() }) }}</span>
        <div class="qt-result-row">
          <span class="qt-result-label">{{ t(U + 'rowGregorianShort') }}</span>
          <span class="qt-value" style="font-size:14px">{{ jdnResult.gregorian }} ({{ jdnResult.dayOfWeek }})</span>
          <CopyButton :text="jdnResult.gregorian" :label="t('common.copy')" icon-only />
        </div>
        <div class="qt-result-row">
          <span class="qt-result-label">{{ t(U + 'rowJulianShort') }}</span>
          <span class="qt-value" style="font-size:14px">{{ jdnResult.julian }}</span>
          <CopyButton :text="jdnResult.julian" :label="t('common.copy')" icon-only />
        </div>
      </div>
    </ToolOutput>
  </div>
</template>
