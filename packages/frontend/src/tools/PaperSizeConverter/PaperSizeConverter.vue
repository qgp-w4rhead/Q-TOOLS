<script setup lang="ts">
/**
 * PaperSizeConverter - paper size reference table.
 *
 * Searchable table of ISO 216 A/B/C series and common North American paper
 * sizes with millimetre and inch dimensions. Selecting a row shows its
 * closest ISO A-series equivalent by area.
 *
 * Works in embed mode: receives `input` PostMessages (query/series) and
 * sends `output` PostMessages with the selected size details.
 */
import { useI18n } from 'vue-i18n';
import { RotateCcw } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import ToolField from '@/components/ToolField.vue';
import ToolButton from '@/components/ToolButton.vue';
import CopyButton from '@/components/CopyButton.vue';
import {
  usePaperSizeConverter,
  PAPER_SERIES,
  mmToInches,
  type PaperSize,
} from './usePaperSizeConverter';

const { t } = useI18n();
const U = 'tools.paper-size-converter.ui.';

const {
  query,
  seriesFilter,
  filtered,
  selected,
  closestIsoA,
  select,
  reset,
} = usePaperSizeConverter();

function onSeries(e: Event): void {
  seriesFilter.value = (e.target as HTMLSelectElement).value;
}
function dims(size: PaperSize): string {
  return `${size.widthMm} × ${size.heightMm} mm`;
}
function dimsIn(size: PaperSize): string {
  return `${mmToInches(size.widthMm)} × ${mmToInches(size.heightMm)} in`;
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

      <div class="qt-row">
        <ToolField
          v-model="query"
          :label="t('common.search')"
          type="text"
          :placeholder="t(U + 'phSearch')"
          grow
        />
        <label class="qt-field">
          <span class="qt-label">{{ t(U + 'seriesLabel') }}</span>
          <select class="qt-input" :value="seriesFilter" @change="onSeries">
            <option v-for="s in PAPER_SERIES" :key="s" :value="s">{{ s }}</option>
          </select>
        </label>
      </div>
    </ToolInput>

    <ToolOutput
      :title="t(U + 'outTitle')"
      :description="t(filtered.length === 1 ? U + 'descSizesOne' : U + 'descSizes', { n: filtered.length })"
    >
      <div class="ps__table-wrap">
        <table class="ps__table">
          <thead>
            <tr>
              <th>{{ t('common.name') }}</th>
              <th>{{ t(U + 'seriesLabel') }}</th>
              <th>{{ t(U + 'colMm') }}</th>
              <th>{{ t(U + 'colIn') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="s in filtered"
              :key="s.series + s.name"
              class="ps__tr"
              :class="{ 'ps__tr--active': selected === s }"
              @click="select(s)"
            >
              <td style="font-weight:700">{{ s.name }}</td>
              <td>{{ s.series }}</td>
              <td class="qt-mono" style="font-size:12.5px">{{ s.widthMm }} × {{ s.heightMm }}</td>
              <td class="qt-mono" style="font-size:12.5px">{{ mmToInches(s.widthMm) }} × {{ mmToInches(s.heightMm) }}</td>
            </tr>
            <tr v-if="filtered.length === 0">
              <td colspan="4" style="text-align:center;color:var(--qt-muted);padding:16px">{{ t(U + 'noMatch') }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="selected" class="qt-stack" style="--qt-stack-gap:8px;margin-top:12px">
        <div class="qt-result-row">
          <span class="qt-label" style="min-width:110px">{{ t(U + 'rowSelected') }}</span>
          <span class="qt-value" style="font-size:13.5px;flex:1">{{ selected.name }} ({{ selected.series }})</span>
          <CopyButton :text="`${selected.name}: ${dims(selected)} / ${dimsIn(selected)}`" :label="t('common.copy')" icon-only />
        </div>
        <div class="qt-result-row">
          <span class="qt-label" style="min-width:110px">{{ t(U + 'rowDims') }}</span>
          <span class="qt-value" style="font-size:13.5px;flex:1">{{ dims(selected) }} · {{ dimsIn(selected) }}</span>
          <CopyButton :text="dims(selected)" :label="t('common.copy')" icon-only />
        </div>
        <div v-if="closestIsoA" class="qt-result-row">
          <span class="qt-label" style="min-width:110px">{{ t(U + 'rowClosest') }}</span>
          <span class="qt-value" style="font-size:13.5px;flex:1">{{ closestIsoA.name }} ({{ dims(closestIsoA) }})</span>
          <CopyButton :text="closestIsoA.name" :label="t('common.copy')" icon-only />
        </div>
      </div>
    </ToolOutput>
  </div>
</template>

<style scoped>
/* Kept scoped: patterns unique to this tool (no generic utility). */

/* Scrollable data table — sticky header, clickable rows. */
.ps__table-wrap {
  max-height: 380px;
  overflow-y: auto;
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
}
.ps__table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.ps__table th {
  position: sticky;
  top: 0;
  background: var(--qt-surface);
  color: var(--qt-muted);
  font-weight: 700;
  text-align: left;
  padding: 8px 12px;
  border-bottom: 1px solid var(--qt-border);
}
.ps__table td {
  padding: 7px 12px;
  border-bottom: 1px solid var(--qt-border);
  color: var(--qt-text);
}
.ps__tr {
  cursor: pointer;
  transition: background 0.12s ease;
}
.ps__tr:hover {
  background: oklch(from var(--qt-accent) 90% c h / 0.08);
}
.ps__tr--active {
  background: oklch(from var(--qt-accent) 90% c h / 0.14);
}
</style>
