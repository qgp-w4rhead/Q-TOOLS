<script setup lang="ts">
/**
 * TabOrderVisualizer - paste HTML to see tab navigation order.
 *
 * Analyzes focusable elements and their tabindex values, showing the
 * keyboard navigation order and potential issues.
 */
import { useI18n } from 'vue-i18n';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import ToolField from '@/components/ToolField.vue';
import ToolAlert from '@/components/ToolAlert.vue';
import {
  useTabOrderVisualizer,
} from './useTabOrderVisualizer';

const { htmlInput, result, error } = useTabOrderVisualizer();

const { t } = useI18n();
const U = 'tools.tab-order-visualizer.ui.';
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
      :description="t(U + 'descCount', { n: result.totalFocusable })"
    >
      <div v-if="result.warnings.length > 0" class="qt-stack" style="--qt-stack-gap:6px;margin-bottom:12px">
        <div v-for="(w, i) in result.warnings" :key="i" class="qt-alert qt-alert--warning">
          {{ w }}
        </div>
      </div>

      <div v-if="result.elements.length > 0" class="qt-stack" style="--qt-stack-gap:4px">
        <div
          v-for="(el, i) in result.elements"
          :key="i"
          class="qt-panel qt-row qt-row--center tov__item"
          :class="{
            'tov__item--removed': el.hasNegativeTabindex,
            'tov__item--positive': el.hasPositiveTabindex,
            'tov__item--disabled': el.isDisabled,
          }"
        >
          <span style="display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:50%;background:var(--qt-accent-soft);color:var(--qt-accent);font-weight:700;font-size:12px;flex-shrink:0">{{ el.isFocusable ? i + 1 : '-' }}</span>
          <span class="qt-mono" style="font-weight:600;color:var(--qt-accent);flex-shrink:0">{{ el.tag }}</span>
          <span style="color:var(--qt-text);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{{ el.label }}</span>
          <span v-if="el.tabindex !== null" class="qt-mono" style="font-size:12px;color:var(--qt-muted);flex-shrink:0">
            tabindex={{ el.tabindex }}
          </span>
          <span v-if="el.isDisabled" class="qt-badge tov__badge--disabled" style="flex-shrink:0">{{ t(U + 'badgeDisabled') }}</span>
          <span v-if="el.hasNegativeTabindex" class="qt-badge tov__badge--removed" style="flex-shrink:0">{{ t(U + 'badgeRemoved') }}</span>
          <span v-if="el.hasPositiveTabindex" class="qt-badge tov__badge--positive" style="flex-shrink:0">{{ t(U + 'badgePositive') }}</span>
        </div>
      </div>

      <ToolAlert v-else kind="empty">
        {{ t(U + 'emptyAlert') }}
      </ToolAlert>
    </ToolOutput>
  </div>
</template>

<style scoped>
/* Kept scoped: item state variants + badge tints. */
.tov__item {
  --qt-row-gap: 8px;
  flex-wrap: nowrap;
  padding: 8px 12px;
  font-size: 13px;
}
.tov__item--removed {
  opacity: 0.5;
}
.tov__item--positive {
  border-color: color-mix(in srgb, var(--qt-warning) 40%, var(--qt-border));
}
.tov__item--disabled {
  opacity: 0.4;
}
.tov__badge--disabled {
  background: color-mix(in srgb, var(--qt-muted) 20%, transparent);
  color: var(--qt-muted);
}
.tov__badge--removed {
  background: color-mix(in srgb, var(--qt-danger) 20%, transparent);
  color: var(--qt-danger);
}
.tov__badge--positive {
  background: color-mix(in srgb, var(--qt-warning) 20%, transparent);
  color: var(--qt-warning);
}
</style>
