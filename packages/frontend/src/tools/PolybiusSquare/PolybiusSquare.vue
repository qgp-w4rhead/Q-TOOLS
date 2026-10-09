<script setup lang="ts">
/**
 * PolybiusSquare - coordinate-based substitution cipher.
 *
 * Each letter is mapped to a two-digit coordinate (row, column) in a grid.
 * The standard 5×5 grid merges I and J. The 6×6 grid includes digits 0–9.
 *
 * No external dependencies.
 *
 * Works in embed mode: receives `input` PostMessages to pre-fill the text,
 * select the mode, and set the grid size; sends `output` PostMessages
 * whenever the computed output changes.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { ArrowLeftRight, RefreshCw } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import ToolField from '@/components/ToolField.vue';
import ToolButton from '@/components/ToolButton.vue';
import SegmentedControl from '@/components/SegmentedControl.vue';
import OutputTextarea from '@/components/OutputTextarea.vue';
import ToolAlert from '@/components/ToolAlert.vue';
import {
  usePolybiusSquare,
  type PolybiusMode,
  type GridSize,
} from './usePolybiusSquare';

const {
  input,
  mode,
  gridSize,
  output,
  grid,
  recompute,
  swap,
} = usePolybiusSquare();

const { t } = useI18n();
const U = 'tools.polybius-square.ui.';

const placeholder = computed(() =>
  mode.value === 'encode'
    ? t(U + 'phEncode')
    : t(U + 'phDecode'),
);

const inputLabel = computed(() => (mode.value === 'encode' ? t(U + 'text') : t(U + 'coordinates')));
const outputLabel = computed(() => (mode.value === 'encode' ? t(U + 'coordinates') : t(U + 'text')));

const modeOptions = computed<Array<{ id: PolybiusMode; label: string }>>(() => [
  { id: 'encode', label: t('common.encode') },
  { id: 'decode', label: t('common.decode') },
]);

const gridSuffix = computed(() => t(gridSize.value === 5 ? U + 'suffix5' : U + 'suffix6'));

function onGridSizeChange(s: GridSize): void {
  gridSize.value = s;
}

/** Render the grid as a visual table. */
const gridRows = computed(() => {
  const size = gridSize.value;
  const rows: string[][] = [];
  for (let r = 0; r < size; r++) {
    const row: string[] = [];
    for (let c = 0; c < size; c++) {
      const idx = r * size + c;
      row.push(grid.value[idx] ?? '');
    }
    rows.push(row);
  }
  return rows;
});
</script>

<template>
  <div class="qt-tool">
    <ToolInput :title="t('common.input')" :description="t(U + 'desc', { size: gridSize, suffix: gridSuffix })">
      <template #actions>
        <ToolButton :title="t('common.swapTitle')" @click="swap">
          <ArrowLeftRight :size="14" />
          <span>{{ t('common.swap') }}</span>
        </ToolButton>
        <ToolButton variant="primary" :disabled="input.trim().length === 0" @click="recompute">
          <RefreshCw :size="14" />
          <span>{{ t('common.convert') }}</span>
        </ToolButton>
      </template>

      <SegmentedControl v-model="mode" :options="modeOptions" />

      <div class="qt-row qt-row--center" style="--qt-row-gap:10px">
        <span class="qt-label">{{ t(U + 'grid') }}</span>
        <div class="qt-seg">
          <button
            type="button"
            class="qt-seg__btn"
            :class="{ 'qt-seg__btn--active': gridSize === 5 }"
            :aria-pressed="gridSize === 5"
            @click="onGridSizeChange(5)"
          >
            5×5
          </button>
          <button
            type="button"
            class="qt-seg__btn"
            :class="{ 'qt-seg__btn--active': gridSize === 6 }"
            :aria-pressed="gridSize === 6"
            @click="onGridSizeChange(6)"
          >
            6×6
          </button>
        </div>
      </div>

      <ToolField
        v-model="input"
        as="textarea"
        mono
        :label="inputLabel"
        :placeholder="placeholder"
        :rows="5"
      />
    </ToolInput>

    <ToolOutput
      :title="outputLabel"
      :description="output ? t(U + 'descOut', { size: gridSize }) : t(U + 'descEmpty')"
    >
      <ToolAlert v-if="!output">{{ t(U + 'alertEmpty') }}</ToolAlert>
      <OutputTextarea v-else :value="output" :aria-label="t(U + 'ariaResult')" />
    </ToolOutput>

    <ToolOutput
      v-if="grid.length > 0"
      :title="t(U + 'gridTitle')"
      :description="t(U + 'gridDesc', { size: gridSize })"
    >
      <div style="overflow-x:auto">
        <table class="poly__table">
          <thead>
            <tr>
              <th class="poly__th"></th>
              <th v-for="c in gridSize" :key="c" class="poly__th">{{ c }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, r) in gridRows" :key="r">
              <td class="poly__td poly__td--row">{{ r + 1 }}</td>
              <td v-for="(cell, c) in row" :key="c" class="poly__td">{{ cell || '-' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </ToolOutput>
  </div>
</template>

<style scoped>
/* Kept scoped: patterns unique to this tool (no generic utility). */

/* Bordered mono grid table. */
.poly__table {
  border-collapse: collapse;
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
  font-size: 13.5px;
}
.poly__th {
  border: 1px solid var(--qt-border);
  padding: 6px 12px;
  font-weight: 600;
  color: var(--qt-muted);
  background: var(--qt-surface);
  text-align: center;
}
.poly__td {
  border: 1px solid var(--qt-border);
  padding: 6px 12px;
  text-align: center;
  color: var(--qt-text);
}
.poly__td--row {
  font-weight: 600;
  color: var(--qt-muted);
  background: var(--qt-surface);
}
</style>
