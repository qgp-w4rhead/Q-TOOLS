<script setup lang="ts">
/**
 * PluralRulesExplorer - show pluralization categories per locale.
 */
import { RotateCcw } from 'lucide-vue-next';
import { useI18n } from 'vue-i18n';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import ToolField from '@/components/ToolField.vue';
import ToolButton from '@/components/ToolButton.vue';
import {
  usePluralRulesExplorer,
} from './usePluralRulesExplorer';

const {
  locale,
  pluralType,
  numbers,
  allLocales,
  currentInfo,
  reset,
} = usePluralRulesExplorer();

const { t } = useI18n();
const U = 'tools.plural-rules-explorer.ui.';

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

      <div class="qt-row" style="--qt-row-gap:12px">
        <label class="qt-field">
          <span class="qt-label">{{ t(U + 'locale') }}</span>
          <select v-model="locale" class="qt-input" style="width:auto;font-size:13px;padding:6px 10px">
            <option v-for="l in allLocales" :key="l" :value="l">{{ l }}</option>
          </select>
        </label>
        <label class="qt-field">
          <span class="qt-label">{{ t(U + 'type') }}</span>
          <select v-model="pluralType" class="qt-input" style="width:auto;font-size:13px;padding:6px 10px">
            <option value="cardinal">{{ t(U + 'typeCardinal') }}</option>
            <option value="ordinal">{{ t(U + 'typeOrdinal') }}</option>
          </select>
        </label>
        <ToolField
          v-model="numbers"
          :label="t(U + 'numbers')"
          :placeholder="t(U + 'phNumbers')"
          grow
        />
      </div>
    </ToolInput>

    <ToolOutput
      v-if="currentInfo"
      :title="t(U + 'outputTitle')"
      :description="t(U + 'descCats', { locale: currentInfo.locale, cats: currentInfo.categories.join(', ') })"
      hide-copy
    >
      <div class="qt-row" style="--qt-row-gap:8px">
        <span
          v-for="cat in currentInfo.categories"
          :key="cat"
          class="qt-badge"
          style="font-size:12px;padding:4px 12px"
        >{{ cat }}</span>
      </div>
    </ToolOutput>

    <ToolOutput
      v-if="currentInfo"
      :title="t(U + 'resultsTitle')"
      :description="t(U + 'descResults')"
      hide-copy
    >
      <div class="qt-stack" style="--qt-stack-gap:2px">
        <div v-for="r in currentInfo.results" :key="r.number" class="pre__result-row qt-row qt-row--center qt-row--between">
          <span class="qt-mono" style="font-size:13px;font-weight:600;color:var(--qt-text)">{{ r.number }}</span>
          <span class="qt-badge" style="font-size:12px;padding:2px 10px">{{ r.category }}</span>
        </div>
      </div>
    </ToolOutput>
  </div>
</template>

<style scoped>
/* Kept scoped: zebra-striped result rows (unique pattern). */
.pre__result-row {
  padding: 6px 8px;
  border-radius: 4px;
}
.pre__result-row:nth-child(odd) {
  background: var(--qt-bg);
}
</style>
