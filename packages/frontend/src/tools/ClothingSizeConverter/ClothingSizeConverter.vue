<script setup lang="ts">
/**
 * ClothingSizeConverter - clothing and shoe size conversion tables.
 *
 * Pick a table (men's/women's/kids' shoes, men's/women's tops), then click
 * a size cell to highlight the equivalent sizes across US/UK/EU/JP systems.
 * Tables are approximate - sizing varies by brand.
 *
 * Works in embed mode: receives `input` PostMessages (table + size) and
 * sends `output` PostMessages with the equivalent sizes.
 */
import { useI18n } from 'vue-i18n';
import { RotateCcw } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import ToolButton from '@/components/ToolButton.vue';
import SegmentedControl from '@/components/SegmentedControl.vue';
import CopyButton from '@/components/CopyButton.vue';
import { useClothingSizeConverter } from './useClothingSizeConverter';

const { t } = useI18n();
const U = 'tools.clothing-size-converter.ui.';

const {
  activeTableId,
  tables,
  activeTable,
  selectedRow,
  selectedCol,
  selectCell,
  reset,
} = useClothingSizeConverter();

function selectedRowText(): string {
  const t = activeTable.value;
  const row = t?.rows[selectedRow.value];
  if (!t || !row) return '';
  return t.columns.map((c, i) => `${c}: ${row[i] ?? ''}`).join(' · ');
}
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

      <SegmentedControl v-model="activeTableId" :options="tables" />
    </ToolInput>

    <ToolOutput
      :title="activeTable?.label ?? t(U + 'outFallback')"
      :description="t(U + 'outDesc')"
    >
      <div v-if="activeTable" class="cs__table-wrap">
        <table class="cs__table">
          <thead>
            <tr>
              <th v-for="c in activeTable.columns" :key="c">{{ c }}</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(row, r) in activeTable.rows"
              :key="r"
              class="cs__tr"
              :class="{ 'cs__tr--active': r === selectedRow }"
            >
              <td
                v-for="(cell, c) in row"
                :key="c"
                class="cs__td"
                :class="{ 'cs__td--picked': r === selectedRow && c === selectedCol }"
                @click="selectCell(r, c)"
              >
                {{ cell }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="selectedRow >= 0" class="qt-result-row" style="margin-top:12px">
        <span class="qt-label" style="min-width:110px">{{ t(U + 'rowEquiv') }}</span>
        <span class="qt-value" style="font-size:13.5px;flex:1">{{ selectedRowText() }}</span>
        <CopyButton :text="selectedRowText()" :label="t('common.copy')" icon-only />
      </div>
    </ToolOutput>
  </div>
</template>

<style scoped>
/* Kept scoped: patterns unique to this tool (no generic utility). */

/* Scrollable size table — sticky header, clickable cells. */
.cs__table-wrap {
  max-height: 420px;
  overflow-y: auto;
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
}
.cs__table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.cs__table th {
  position: sticky;
  top: 0;
  background: var(--qt-surface);
  color: var(--qt-muted);
  font-weight: 700;
  text-align: left;
  padding: 8px 12px;
  border-bottom: 1px solid var(--qt-border);
}
.cs__td {
  padding: 7px 12px;
  border-bottom: 1px solid var(--qt-border);
  color: var(--qt-text);
  font-family: var(--qt-font-mono);
  font-size: 12.5px;
  cursor: pointer;
  transition: background 0.12s ease;
}
.cs__tr:hover .cs__td {
  background: oklch(from var(--qt-accent) 90% c h / 0.08);
}
.cs__tr--active .cs__td {
  background: oklch(from var(--qt-accent) 90% c h / 0.14);
}
.cs__td--picked {
  font-weight: 700;
  box-shadow: inset 0 0 0 1px var(--qt-accent);
}
</style>
