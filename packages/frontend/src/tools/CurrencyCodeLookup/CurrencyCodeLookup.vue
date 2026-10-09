<script setup lang="ts">
/**
 * CurrencyCodeLookup - ISO 4217 code ↔ currency name, symbol, decimal places.
 */
import { RotateCcw } from 'lucide-vue-next';
import { useI18n } from 'vue-i18n';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import ToolField from '@/components/ToolField.vue';
import ToolButton from '@/components/ToolButton.vue';
import { useCurrencyCodeLookup } from './useCurrencyCodeLookup';

const { query, results, reset } = useCurrencyCodeLookup();

const { t } = useI18n();
const U = 'tools.currency-code-lookup.ui.';
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

      <ToolField
        v-model="query"
        :label="t(U + 'search')"
        :placeholder="t(U + 'placeholder')"
      />
    </ToolInput>

    <ToolOutput
      :title="t(U + 'outputTitle')"
      :description="t(U + 'descCount', { n: results.length })"
      hide-copy
    >
      <div class="cur__table">
        <div class="cur__table-header">
          <span class="cur__col cur__col--code">{{ t(U + 'colCode') }}</span>
          <span class="cur__col cur__col--num">{{ t(U + 'colNumber') }}</span>
          <span class="cur__col cur__col--name">{{ t(U + 'colName') }}</span>
          <span class="cur__col cur__col--sym">{{ t(U + 'colSymbol') }}</span>
          <span class="cur__col cur__col--dec">{{ t(U + 'colDecimals') }}</span>
        </div>
        <div v-for="c in results" :key="c.code" class="cur__table-row">
          <span class="cur__col cur__col--code">{{ c.code }}</span>
          <span class="cur__col cur__col--num">{{ c.number }}</span>
          <span class="cur__col cur__col--name">{{ c.name }}</span>
          <span class="cur__col cur__col--sym">{{ c.symbol }}</span>
          <span class="cur__col cur__col--dec">{{ c.decimalPlaces }}</span>
        </div>
      </div>
    </ToolOutput>
  </div>
</template>

<style scoped>
/* Kept scoped: fixed-column grid table (unique layout). */
.cur__table {
  display: flex;
  flex-direction: column;
  gap: 1px;
  max-height: 600px;
  overflow-y: auto;
}
.cur__table-header,
.cur__table-row {
  display: grid;
  grid-template-columns: 70px 90px 1fr 70px 60px;
  gap: 8px;
  padding: 6px 8px;
  align-items: center;
}
.cur__table-header {
  font-size: 11px;
  font-weight: 700;
  color: var(--qt-muted);
  text-transform: uppercase;
  border-bottom: 1px solid var(--qt-border);
  padding-bottom: 8px;
  position: sticky;
  top: 0;
  background: var(--qt-surface);
  z-index: 1;
}
.cur__table-row:nth-child(odd) {
  background: var(--qt-bg);
  border-radius: 4px;
}
.cur__col--code {
  font-family: var(--qt-mono, monospace);
  font-size: 12px;
  font-weight: 700;
}
.cur__col--num {
  font-family: var(--qt-mono, monospace);
  font-size: 12px;
  color: var(--qt-muted);
}
.cur__col--name {
  font-size: 13px;
}
.cur__col--sym {
  font-size: 14px;
}
.cur__col--dec {
  font-size: 12px;
  color: var(--qt-muted);
  text-align: center;
}
</style>
