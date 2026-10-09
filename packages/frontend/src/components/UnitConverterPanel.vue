<script setup lang="ts">
/**
 * UnitConverterPanel - shared UI for the linear unit-converter tools.
 *
 * Renders optional mode tabs (when the converter exposes multiple unit
 * sets), a value + unit input row, and a results list with per-row copy.
 * Extra tool-specific controls (e.g. a DPI field) can be injected via the
 * `controls` slot.
 */
import { RotateCcw } from 'lucide-vue-next';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import ToolField from '@/components/ToolField.vue';
import ToolButton from '@/components/ToolButton.vue';
import SegmentedControl from '@/components/SegmentedControl.vue';
import CopyButton from '@/components/CopyButton.vue';
import type { UnitDef, UnitSet } from '@/composables/useUnitConverter';

const { t } = useI18n();

const props = withDefaults(
  defineProps<{
    /** Panel heading for the input section. */
    title: string;
    /** Helper text under the input heading. */
    description?: string;
    /** All unit sets (tabs shown when more than one). */
    sets?: UnitSet[];
    /** Units of the active set. */
    units: UnitDef[];
    /** Formatted result per unit id. */
    results: Record<string, string>;
    /** v-model: input value (string). */
    inputValue: string;
    /** v-model: active input unit id. */
    inputUnit: string;
    /** v-model: active set id. */
    activeSetId?: string;
    /** Placeholder for the value field. */
    valuePlaceholder?: string;
  }>(),
  {
    description: '',
    sets: () => [],
    activeSetId: '',
    valuePlaceholder: 'e.g. 100',
  },
);

const emit = defineEmits<{
  'update:inputValue': [value: string];
  'update:inputUnit': [value: string];
  'update:activeSetId': [value: string];
  reset: [];
}>();

const valueModel = computed<string | number>({
  get: () => props.inputValue,
  set: (v) => emit('update:inputValue', String(v)),
});
const setModel = computed<string>({
  get: () => props.activeSetId,
  set: (v) => emit('update:activeSetId', v),
});

function onUnit(e: Event): void {
  emit('update:inputUnit', (e.target as HTMLSelectElement).value);
}
</script>

<template>
  <div class="ucp">
    <ToolInput :title="title" :description="description">
      <template #actions>
        <ToolButton :title="t('common.resetDefaults')" @click="emit('reset')">
          <RotateCcw :size="14" />
          <span>{{ t('common.reset') }}</span>
        </ToolButton>
      </template>

      <SegmentedControl
        v-if="sets.length > 1"
        v-model="setModel"
        :options="sets"
      />

      <div class="ucp__row">
        <ToolField
          v-model="valueModel"
          :label="t('common.value')"
          type="number"
          step="any"
          :placeholder="valuePlaceholder"
          grow
        />
        <label class="ucp__field">
          <span class="ucp__label">{{ t('common.unit') }}</span>
          <select class="ucp__select" :value="inputUnit" @change="onUnit">
            <option v-for="u in units" :key="u.id" :value="u.id">
              {{ u.label }}{{ u.symbol ? ` (${u.symbol})` : '' }}
            </option>
          </select>
        </label>
      </div>

      <slot name="controls" />
    </ToolInput>

    <ToolOutput :title="t('common.convertedValues')" :description="t('common.allUnitsGlance')">
      <div class="ucp__results">
        <div
          v-for="u in units"
          :key="u.id"
          class="ucp__result-row"
          :class="{ 'ucp__result-row--active': u.id === inputUnit }"
        >
          <span class="ucp__result-unit">{{ u.label }}{{ u.symbol ? ` (${u.symbol})` : '' }}</span>
          <span class="ucp__result-value">{{ results[u.id] }}</span>
          <CopyButton
            v-if="results[u.id] && results[u.id] !== '-'"
            :text="results[u.id] ?? ''"
            :label="t('common.copy')"
            icon-only
          />
        </div>
      </div>
    </ToolOutput>
  </div>
</template>

<style scoped>
.ucp {
  display: flex;
  flex-direction: column;
  gap: var(--qt-gap);
  max-width: var(--qt-max-content);
  margin: 0 auto;
}
.ucp__row {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}
.ucp__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.ucp__label {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--qt-muted);
}
.ucp__select {
  width: 100%;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  color: var(--qt-text);
  font: inherit;
  font-size: 14px;
  padding: 8px 10px;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;
}
.ucp__select:focus {
  border-color: var(--qt-accent);
  outline: none;
  box-shadow: 0 0 0 2px oklch(from var(--qt-accent) 90% c h / 0.25);
}
.ucp__results {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.ucp__result-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  background: var(--qt-bg);
  transition: border-color 0.15s ease;
}
.ucp__result-row--active {
  border-color: var(--qt-accent);
}
.ucp__result-unit {
  flex: 1;
  font-size: 13px;
  font-weight: 600;
  color: var(--qt-muted);
}
.ucp__result-value {
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
  font-size: 14px;
  font-weight: 700;
  color: var(--qt-text);
}
</style>
