<script setup lang="ts">
/**
 * OhmsLawCalculator - solve any two of V / I / R / P.
 *
 * Enter any two electrical quantities (with optional SI prefixes) and the
 * remaining two are derived via V = I·R and P = V·I. Solved fields are
 * highlighted; clear a field to make it an unknown again.
 *
 * Works in embed mode: receives `input` PostMessages (v/i/r/p) and sends
 * `output` PostMessages with the solved values.
 */
import { useI18n } from 'vue-i18n';
import { RotateCcw, X } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import ToolButton from '@/components/ToolButton.vue';
import CopyButton from '@/components/CopyButton.vue';
import {
  useOhmsLawCalculator,
  SI_PREFIXES,
  QUANTITY_LABELS,
  QUANTITY_SYMBOLS,
  type OhmsQuantity,
} from './useOhmsLawCalculator';

const { t } = useI18n();
const U = 'tools.ohms-law-calculator.ui.';

const {
  inputs,
  prefixes,
  solved,
  formatted,
  clear,
  reset,
} = useOhmsLawCalculator();

const ORDER: OhmsQuantity[] = ['v', 'i', 'r', 'p'];

function onInput(q: OhmsQuantity, e: Event): void {
  inputs[q].value = (e.target as HTMLInputElement).value;
}
function onPrefix(q: OhmsQuantity, e: Event): void {
  prefixes[q].value = Number((e.target as HTMLSelectElement).value);
}
function isSolved(q: OhmsQuantity): boolean {
  return !solved.value.given.includes(q) && solved.value[q] !== null;
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

      <div class="qt-grid" style="--qt-grid-min:220px;--qt-grid-gap:12px">
        <div v-for="q in ORDER" :key="q" class="qt-field">
          <span class="qt-label">{{ QUANTITY_LABELS[q] }} ({{ QUANTITY_SYMBOLS[q] }})</span>
          <div class="qt-row qt-row--center" style="--qt-row-gap:6px;flex-wrap:nowrap">
            <input
              type="number"
              class="qt-input"
              style="flex:1;min-width:0"
              step="any"
              :placeholder="t(U + 'phEg', { n: q === 'v' ? '12' : q === 'i' ? '0.5' : q === 'r' ? '24' : '6' })"
              :value="inputs[q].value"
              @input="onInput(q, $event)"
            />
            <select
              class="qt-input"
              style="width:auto;font-size:13px"
              :value="prefixes[q].value"
              @change="onPrefix(q, $event)"
            >
              <option v-for="p in SI_PREFIXES" :key="p.id" :value="p.factor">
                {{ p.label }}{{ QUANTITY_SYMBOLS[q] }}
              </option>
            </select>
            <button
              v-if="inputs[q].value"
              type="button"
              class="qt-btn qt-btn--ghost qt-btn--icon"
              :title="t(U + 'clearTitle')"
              @click="clear(q)"
            >
              <X :size="13" />
            </button>
          </div>
        </div>
      </div>
    </ToolInput>

    <ToolOutput
      :title="t(U + 'outTitle')"
      :description="solved.given.length >= 2 ? t(U + 'descOk') : t(U + 'descEmpty')"
    >
      <div class="qt-stack" style="--qt-stack-gap:8px">
        <div
          v-for="q in ORDER"
          :key="q"
          class="qt-result-row"
          :class="{ 'qt-result-row--active': isSolved(q) }"
        >
          <span class="qt-result-label">{{ QUANTITY_LABELS[q] }}</span>
          <span class="qt-value" style="font-size:14px">{{ formatted[q] }}</span>
          <CopyButton
            v-if="formatted[q] !== '-'"
            :text="formatted[q]"
            :label="t('common.copy')"
            icon-only
          />
        </div>
      </div>
    </ToolOutput>
  </div>
</template>
