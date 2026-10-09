<script setup lang="ts">
/**
 * TimezoneDatabase - IANA timezone list with offsets, DST info, and search.
 */
import { RotateCcw } from 'lucide-vue-next';
import { useI18n } from 'vue-i18n';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import ToolField from '@/components/ToolField.vue';
import ToolButton from '@/components/ToolButton.vue';
import { useTimezoneDatabase } from './useTimezoneDatabase';

const { query, timezones, reset } = useTimezoneDatabase();

const { t } = useI18n();
const U = 'tools.timezone-database.ui.';
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
      :description="t(U + 'descCount', { n: timezones.length })"
      hide-copy
    >
      <div class="tz__table">
        <div class="tz__table-header">
          <span class="tz__col tz__col--id">{{ t(U + 'colId') }}</span>
          <span class="tz__col tz__col--region">{{ t(U + 'colRegion') }}</span>
          <span class="tz__col tz__col--city">{{ t(U + 'colCity') }}</span>
          <span class="tz__col tz__col--offset">{{ t(U + 'colOffset') }}</span>
          <span class="tz__col tz__col--dst">{{ t(U + 'colDst') }}</span>
        </div>
        <div v-for="tz in timezones" :key="tz.id" class="tz__table-row">
          <span class="tz__col tz__col--id">{{ tz.id }}</span>
          <span class="tz__col tz__col--region">{{ tz.region }}</span>
          <span class="tz__col tz__col--city">{{ tz.city }}</span>
          <span class="tz__col tz__col--offset">{{ tz.offset }}</span>
          <span class="tz__col tz__col--dst">
            <span class="qt-badge" :class="{ 'qt-badge--success': tz.isDST }" style="font-size:11px">
              {{ tz.isDST ? t(U + 'yes') : t(U + 'no') }}
            </span>
          </span>
        </div>
      </div>
    </ToolOutput>
  </div>
</template>

<style scoped>
/* Kept scoped: fixed-column grid table (unique layout). */
.tz__table {
  display: flex;
  flex-direction: column;
  gap: 1px;
  max-height: 600px;
  overflow-y: auto;
}
.tz__table-header,
.tz__table-row {
  display: grid;
  grid-template-columns: 1fr 100px 1fr 80px 50px;
  gap: 8px;
  padding: 6px 8px;
  align-items: center;
}
.tz__table-header {
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
.tz__table-row:nth-child(odd) {
  background: var(--qt-bg);
  border-radius: 4px;
}
.tz__col--id {
  font-family: var(--qt-mono, monospace);
  font-size: 12px;
  font-weight: 600;
}
.tz__col--offset {
  font-family: var(--qt-mono, monospace);
  font-size: 12px;
}
</style>
