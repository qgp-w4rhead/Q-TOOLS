<script setup lang="ts">
/**
 * CountryCodeLookup - ISO 3166-1 code ↔ country name and flag emoji.
 */
import { RotateCcw } from 'lucide-vue-next';
import { useI18n } from 'vue-i18n';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import ToolField from '@/components/ToolField.vue';
import ToolButton from '@/components/ToolButton.vue';
import { useCountryCodeLookup } from './useCountryCodeLookup';

const { query, results, reset } = useCountryCodeLookup();

const { t } = useI18n();
const U = 'tools.country-code-lookup.ui.';
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
      <div class="cc__table">
        <div class="cc__table-header">
          <span class="cc__col cc__col--flag"></span>
          <span class="cc__col cc__col--a2">{{ t(U + 'colA2') }}</span>
          <span class="cc__col cc__col--a3">{{ t(U + 'colA3') }}</span>
          <span class="cc__col cc__col--num">{{ t(U + 'colNumeric') }}</span>
          <span class="cc__col cc__col--name">{{ t(U + 'colName') }}</span>
        </div>
        <div v-for="c in results" :key="c.alpha3" class="cc__table-row">
          <span class="cc__col cc__col--flag">{{ c.flag }}</span>
          <span class="cc__col cc__col--a2">{{ c.alpha2 }}</span>
          <span class="cc__col cc__col--a3">{{ c.alpha3 }}</span>
          <span class="cc__col cc__col--num">{{ c.numeric }}</span>
          <span class="cc__col cc__col--name">{{ c.name }}</span>
        </div>
      </div>
    </ToolOutput>
  </div>
</template>

<style scoped>
/* Kept scoped: fixed-column grid table (unique layout). */
.cc__table {
  display: flex;
  flex-direction: column;
  gap: 1px;
  max-height: 600px;
  overflow-y: auto;
}
.cc__table-header,
.cc__table-row {
  display: grid;
  grid-template-columns: 40px 70px 70px 70px 1fr;
  gap: 8px;
  padding: 6px 8px;
  align-items: center;
}
.cc__table-header {
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
.cc__table-row:nth-child(odd) {
  background: var(--qt-bg);
  border-radius: 4px;
}
.cc__col--flag {
  font-size: 20px;
}
.cc__col--a2,
.cc__col--a3,
.cc__col--num {
  font-family: var(--qt-mono, monospace);
  font-size: 12px;
  font-weight: 600;
}
.cc__col--name {
  font-size: 13px;
}
</style>
