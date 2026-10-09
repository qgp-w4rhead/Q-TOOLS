<script setup lang="ts">
/**
 * HeadingStructureAnalyzer - paste HTML to see heading hierarchy tree.
 *
 * Analyzes h1-h6 elements and builds a visual tree, highlighting skipped
 * levels and other heading-related accessibility issues.
 */
import { useI18n } from 'vue-i18n';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import ToolField from '@/components/ToolField.vue';
import ToolAlert from '@/components/ToolAlert.vue';
import {
  useHeadingStructureAnalyzer,
} from './useHeadingStructureAnalyzer';

const { htmlInput, result, error } = useHeadingStructureAnalyzer();

const { t } = useI18n();
const U = 'tools.heading-structure-analyzer.ui.';
</script>

<template>
  <div class="qt-tool">
    <ToolInput
      :title="t(U + 'inputTitle')"
      :description="t(U + 'desc')"
    >
      <ToolField
        v-model="htmlInput"
        as="textarea"
        mono
        :rows="8"
        :placeholder="t(U + 'placeholder')"
        :aria-label="t(U + 'ariaInput')"
      />
    </ToolInput>

    <ToolOutput
      v-if="error"
      :title="t('common.error')"
      :hide-copy="true"
    >
      <ToolAlert kind="error">{{ error }}</ToolAlert>
    </ToolOutput>

    <ToolOutput
      v-else-if="result"
      :title="t(U + 'outputTitle')"
      :description="t(U + 'descCount', { n: result.totalHeadings })"
      :hide-copy="true"
    >
      <div v-if="result.warnings.length > 0" class="qt-stack" style="--qt-stack-gap:6px;margin-bottom:12px">
        <div v-for="(w, i) in result.warnings" :key="i" class="qt-alert qt-alert--warning">
          {{ w }}
        </div>
      </div>

      <div v-if="result.flatList.length > 0" class="qt-stack" style="--qt-stack-gap:2px">
        <div
          v-for="h in result.flatList"
          :key="h.index"
          class="qt-row qt-row--center hsa__item"
          :class="{ 'hsa__item--warning': h.warning }"
          :style="{ paddingLeft: `${(h.level - 1) * 20 + 12}px` }"
        >
          <span class="qt-mono" style="font-weight:700;color:var(--qt-accent);flex-shrink:0;min-width:28px">h{{ h.level }}</span>
          <span style="color:var(--qt-text);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{{ h.text || t(U + 'emptyHeading') }}</span>
          <span v-if="h.warning" class="qt-hint" style="font-size:11px;color:var(--qt-warning);flex-shrink:0">{{ h.warning }}</span>
        </div>
      </div>

      <ToolAlert v-else kind="empty">
        {{ t(U + 'emptyAlert') }}
      </ToolAlert>
    </ToolOutput>
  </div>
</template>

<style scoped>
/* Kept scoped: warning-tinted heading item + base item padding/radius. */
.hsa__item {
  padding-top: 6px;
  padding-bottom: 6px;
  padding-right: 12px;
  border-radius: var(--qt-radius-sm);
  font-size: 13px;
}
.hsa__item--warning {
  border: 1px solid color-mix(in srgb, var(--qt-warning) 30%, transparent);
  background: color-mix(in srgb, var(--qt-warning) 5%, transparent);
}
</style>
