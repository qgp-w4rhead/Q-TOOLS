<script setup lang="ts">
/**
 * PlusCodeEncoder - encode/decode lat/lon ↔ Open Location Code (Plus Code).
 */
import { RotateCcw } from 'lucide-vue-next';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import ToolField from '@/components/ToolField.vue';
import ToolButton from '@/components/ToolButton.vue';
import ToolAlert from '@/components/ToolAlert.vue';
import ResultRow from '@/components/ResultRow.vue';
import { usePlusCodeEncoder } from './usePlusCodeEncoder';

const { mode, latInput, lonInput, codeInput, codeLength, snapshot, reset } = usePlusCodeEncoder();

const { t } = useI18n();
const U = 'tools.plus-code-encoder.ui.';

const hasError = computed(() => snapshot.value !== null && !snapshot.value.ok);
const isEmpty = computed(() => snapshot.value === null);

const copyText = computed(() => {
  if (snapshot.value === null || !snapshot.value.ok) return '';
  return mode.value === 'encode' ? (snapshot.value.code ?? '') : `${snapshot.value.lat}, ${snapshot.value.lon}`;
});

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

      <div class="qt-row" style="--qt-row-gap:10px">
        <label class="qt-field qt-field--grow">
          <span class="qt-label">{{ t(U + 'mode') }}</span>
          <select v-model="mode" class="qt-input" style="font-size:14px;padding:8px 10px">
            <option value="encode">{{ t(U + 'modeEncode') }}</option>
            <option value="decode">{{ t(U + 'modeDecode') }}</option>
          </select>
        </label>
      </div>

      <template v-if="mode === 'encode'">
        <div class="qt-row" style="--qt-row-gap:10px">
          <ToolField
            v-model="latInput"
            :label="t(U + 'latitude')"
            type="number"
            :placeholder="t(U + 'phLat')"
            step="any"
            min="-90"
            max="90"
            inputmode="decimal"
            grow
          />
          <ToolField
            v-model="lonInput"
            :label="t(U + 'longitude')"
            type="number"
            :placeholder="t(U + 'phLon')"
            step="any"
            min="-180"
            max="180"
            inputmode="decimal"
            grow
          />
          <label class="qt-field qt-field--grow">
            <span class="qt-label">{{ t(U + 'codeLength') }}</span>
            <select v-model.number="codeLength" class="qt-input" style="font-size:14px;padding:8px 10px">
              <option :value="8">{{ t(U + 'opt8') }}</option>
              <option :value="10">{{ t(U + 'opt10') }}</option>
              <option :value="11">{{ t(U + 'opt11') }}</option>
              <option :value="12">{{ t(U + 'opt12') }}</option>
              <option :value="15">{{ t(U + 'opt15') }}</option>
            </select>
          </label>
        </div>
      </template>
      <template v-else>
        <div class="qt-row" style="--qt-row-gap:10px">
          <ToolField
            v-model="codeInput"
            :label="t(U + 'plusCode')"
            :placeholder="t(U + 'phCode')"
            grow
          />
        </div>
      </template>
    </ToolInput>

    <ToolOutput
      :title="t('common.result')"
      :description="isEmpty ? t(U + 'descEmpty') : (hasError ? t(U + 'descAdjust') : t(U + 'descDone'))"
      :copy-text="copyText"
      :copy-label="mode === 'encode' ? t(U + 'copyCode') : t(U + 'copyCoords')"
    >
      <ToolAlert v-if="hasError" kind="error">{{ snapshot?.message }}</ToolAlert>
      <ToolAlert v-else-if="isEmpty" kind="empty">{{ t(U + 'descEmpty') }}</ToolAlert>
      <template v-else>
        <div class="qt-stack" style="--qt-stack-gap:8px">
          <div class="pc__hero">
            <ResultRow
              :label="mode === 'encode' ? t(U + 'lblCode') : t(U + 'lblCoords')"
              :value="mode === 'encode' ? snapshot!.code! : `${snapshot!.lat}, ${snapshot!.lon}`"
              size="sm"
            />
          </div>
          <ResultRow :label="t(U + 'codeLength')" :value="t(U + 'charsCount', { n: snapshot!.codeLength })" size="sm" />
          <ResultRow
            :label="t(U + 'bbox')"
            :value="`${snapshot!.bbox!.minLat.toFixed(6)}, ${snapshot!.bbox!.minLon.toFixed(6)} → ${snapshot!.bbox!.maxLat.toFixed(6)}, ${snapshot!.bbox!.maxLon.toFixed(6)}`"
            size="sm"
          />
        </div>
      </template>
    </ToolOutput>
  </div>
</template>

<style scoped>
/* Kept scoped: hero accent border reaches into ResultRow via :deep. */
.pc__hero :deep(.rr) { border-width: 2px; border-color: var(--qt-accent); }
</style>
