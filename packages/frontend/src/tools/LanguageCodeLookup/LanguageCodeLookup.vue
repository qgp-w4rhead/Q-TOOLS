<script setup lang="ts">
/**
 * LanguageCodeLookup - ISO 639 code ↔ language name, bidirectional search.
 */
import { RotateCcw } from 'lucide-vue-next';
import { useI18n } from 'vue-i18n';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import ToolField from '@/components/ToolField.vue';
import ToolButton from '@/components/ToolButton.vue';
import { useLanguageCodeLookup } from './useLanguageCodeLookup';

const { query, results, reset } = useLanguageCodeLookup();

const { t } = useI18n();
const U = 'tools.language-code-lookup.ui.';
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
      <div class="lcl__table">
        <div class="lcl__table-header">
          <span class="lcl__col lcl__col--code">{{ t(U + 'colIso1') }}</span>
          <span class="lcl__col lcl__col--code">{{ t(U + 'colIso2') }}</span>
          <span class="lcl__col lcl__col--code">{{ t(U + 'colIso3') }}</span>
          <span class="lcl__col lcl__col--name">{{ t(U + 'colName') }}</span>
          <span class="lcl__col lcl__col--native">{{ t(U + 'colNative') }}</span>
        </div>
        <div v-for="l in results" :key="l.iso6393" class="lcl__table-row">
          <span class="lcl__col lcl__col--code">{{ l.iso6391 || '—' }}</span>
          <span class="lcl__col lcl__col--code">{{ l.iso6392 }}</span>
          <span class="lcl__col lcl__col--code">{{ l.iso6393 }}</span>
          <span class="lcl__col lcl__col--name">{{ l.name }}</span>
          <span class="lcl__col lcl__col--native">{{ l.nativeName || '—' }}</span>
        </div>
      </div>
    </ToolOutput>
  </div>
</template>

<style scoped>
/* Kept scoped: fixed-column grid table (unique layout). */
.lcl__table {
  display: flex;
  flex-direction: column;
  gap: 1px;
  overflow-x: auto;
}
.lcl__table-header,
.lcl__table-row {
  display: grid;
  grid-template-columns: 80px 80px 80px 1fr 1fr;
  gap: 8px;
  padding: 6px 8px;
  align-items: center;
}
.lcl__table-header {
  font-size: 11px;
  font-weight: 700;
  color: var(--qt-muted);
  text-transform: uppercase;
  border-bottom: 1px solid var(--qt-border);
  padding-bottom: 8px;
}
.lcl__table-row:nth-child(odd) {
  background: var(--qt-bg);
  border-radius: 4px;
}
.lcl__col--code {
  font-family: var(--qt-mono, monospace);
  font-size: 12px;
  font-weight: 600;
}
.lcl__col--name {
  font-size: 13px;
}
.lcl__col--native {
  font-size: 13px;
  color: var(--qt-muted);
}
</style>
