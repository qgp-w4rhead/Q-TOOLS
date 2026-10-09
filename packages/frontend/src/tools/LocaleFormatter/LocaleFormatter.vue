<script setup lang="ts">
/**
 * LocaleFormatter - preview number/date/currency/list/relative-time formatting
 * across locales via Intl.
 */
import { RotateCcw } from 'lucide-vue-next';
import { useI18n } from 'vue-i18n';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import ToolField from '@/components/ToolField.vue';
import ToolButton from '@/components/ToolButton.vue';
import {
  useLocaleFormatter,
  FORMAT_TYPES,
  COMMON_CURRENCIES,
} from './useLocaleFormatter';

const {
  input,
  formatType,
  currencyCode,
  results,
  reset,
} = useLocaleFormatter();

const { t } = useI18n();
const U = 'tools.locale-formatter.ui.';

const FMT_KEYS: Record<string, string> = {
  number: 'fmtNumber',
  currency: 'fmtCurrency',
  date: 'fmtDate',
  time: 'fmtTime',
  list: 'fmtList',
  relative: 'fmtRelative',
};
function fmtLabel(v: string): string {
  const k = FMT_KEYS[v];
  return k ? t(U + k) : v;
}

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

      <div class="qt-row" style="--qt-row-gap:12px">
        <ToolField
          v-model="input"
          :label="t(U + 'value')"
          :placeholder="t(U + 'phValue')"
          grow
        />
        <label class="qt-field">
          <span class="qt-label">{{ t(U + 'formatType') }}</span>
          <select v-model="formatType" class="qt-input" style="width:auto;font-size:13px;padding:6px 10px">
            <option v-for="ft in FORMAT_TYPES" :key="ft.value" :value="ft.value">{{ fmtLabel(ft.value) }}</option>
          </select>
        </label>
        <label v-if="formatType === 'currency'" class="qt-field">
          <span class="qt-label">{{ t(U + 'currency') }}</span>
          <select v-model="currencyCode" class="qt-input" style="width:auto;font-size:13px;padding:6px 10px">
            <option v-for="c in COMMON_CURRENCIES" :key="c" :value="c">{{ c }}</option>
          </select>
        </label>
      </div>
    </ToolInput>

    <ToolOutput
      :title="t(U + 'outputTitle')"
      :description="t(U + 'descOut')"
      hide-copy
    >
      <div class="qt-stack" style="--qt-stack-gap:2px">
        <div v-for="r in results" :key="r.locale" class="lf__result-row qt-row qt-row--center qt-row--between">
          <span class="qt-mono" style="font-size:12px;font-weight:600;color:var(--qt-muted);min-width:80px">{{ r.locale }}</span>
          <span style="font-size:13px;color:var(--qt-text);text-align:right;flex:1;word-break:break-word">{{ r.output }}</span>
        </div>
      </div>
    </ToolOutput>
  </div>
</template>

<style scoped>
/* Kept scoped: zebra-striped result rows (unique pattern). */
.lf__result-row {
  padding: 6px 8px;
  border-radius: 4px;
}
.lf__result-row:nth-child(odd) {
  background: var(--qt-bg);
}
</style>
