<script setup lang="ts">
/**
 * CollationComparator - compare string sort order across locales via Intl.Collator.
 */
import { RotateCcw } from 'lucide-vue-next';
import { useI18n } from 'vue-i18n';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import ToolField from '@/components/ToolField.vue';
import ToolButton from '@/components/ToolButton.vue';
import {
  useCollationComparator,
  COMMON_LOCALES,
} from './useCollationComparator';

const {
  input,
  locale,
  sensitivity,
  usage,
  ignorePunctuation,
  numeric,
  caseFirst,
  result,
  reset,
} = useCollationComparator();

const { t } = useI18n();
const U = 'tools.collation-comparator.ui.';

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
        v-model="input"
        :label="t(U + 'strings')"
        as="textarea"
        mono
        :rows="6"
        spellcheck="false"
        :placeholder="t(U + 'placeholder')"
      />

      <div class="qt-row" style="--qt-row-gap:12px">
        <label class="qt-field">
          <span class="qt-label">{{ t(U + 'locale') }}</span>
          <select v-model="locale" class="qt-input" style="width:auto;font-size:13px;padding:6px 10px">
            <option v-for="l in COMMON_LOCALES" :key="l" :value="l">{{ l }}</option>
          </select>
        </label>
        <label class="qt-field">
          <span class="qt-label">{{ t(U + 'sensitivity') }}</span>
          <select v-model="sensitivity" class="qt-input" style="width:auto;font-size:13px;padding:6px 10px">
            <option value="base">{{ t(U + 'sensBase') }}</option>
            <option value="accent">{{ t(U + 'sensAccent') }}</option>
            <option value="case">{{ t(U + 'sensCase') }}</option>
            <option value="variant">{{ t(U + 'sensVariant') }}</option>
          </select>
        </label>
        <label class="qt-field">
          <span class="qt-label">{{ t(U + 'usage') }}</span>
          <select v-model="usage" class="qt-input" style="width:auto;font-size:13px;padding:6px 10px">
            <option value="sort">{{ t(U + 'usageSort') }}</option>
            <option value="search">{{ t(U + 'usageSearch') }}</option>
          </select>
        </label>
      </div>

      <div class="qt-row" style="--qt-row-gap:16px">
        <label class="qt-check" style="font-size:12.5px">
          <input v-model="ignorePunctuation" type="checkbox" />
          <span>{{ t(U + 'ignorePunctuation') }}</span>
        </label>
        <label class="qt-check" style="font-size:12.5px">
          <input v-model="numeric" type="checkbox" />
          <span>{{ t(U + 'numericSorting') }}</span>
        </label>
        <label class="qt-check" style="font-size:12.5px">
          <input v-model="caseFirst" type="checkbox" />
          <span>{{ t(U + 'uppercaseFirst') }}</span>
        </label>
      </div>
    </ToolInput>

    <ToolOutput
      v-if="result"
      :title="t(U + 'outputTitle')"
      :description="t(U + 'descCollation', { locale: result.locale })"
      :copy-text="result.sorted.join('\n')"
    >
      <div class="qt-stack" style="--qt-stack-gap:2px">
        <div v-for="(s, i) in result.sorted" :key="i" class="col__sorted-item qt-row qt-row--center" style="--qt-row-gap:10px;flex-wrap:nowrap">
          <span style="font-size:11px;font-weight:700;color:var(--qt-muted);min-width:24px">{{ i + 1 }}</span>
          <span class="qt-mono" style="font-size:13px">{{ s }}</span>
        </div>
      </div>
    </ToolOutput>

    <ToolOutput
      v-if="result && result.comparisons.length"
      :title="t(U + 'pairwiseTitle')"
      :description="t(U + 'pairwiseDesc')"
      hide-copy
    >
      <div class="qt-stack" style="--qt-stack-gap:2px">
        <div v-for="(c, i) in result.comparisons" :key="i" class="col__cmp-row">
          <span class="qt-mono" style="font-size:12px;color:var(--qt-text)">{{ c.label }}</span>
        </div>
      </div>
    </ToolOutput>
  </div>
</template>

<style scoped>
/* Kept scoped: zebra-striped rows (unique pattern). */
.col__sorted-item {
  padding: 6px 8px;
  border-radius: 4px;
}
.col__sorted-item:nth-child(odd) {
  background: var(--qt-bg);
}
.col__cmp-row {
  padding: 4px 8px;
  border-radius: 4px;
}
.col__cmp-row:nth-child(odd) {
  background: var(--qt-bg);
}
</style>
