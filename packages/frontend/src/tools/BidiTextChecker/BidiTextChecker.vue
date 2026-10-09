<script setup lang="ts">
/**
 * BidiTextChecker - detect and visualize RTL/LTR directionality and BiDi control characters.
 */
import { RotateCcw } from 'lucide-vue-next';
import { useI18n } from 'vue-i18n';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import ToolField from '@/components/ToolField.vue';
import ToolButton from '@/components/ToolButton.vue';
import ToolAlert from '@/components/ToolAlert.vue';
import { useBidiTextChecker } from './useBidiTextChecker';

const { input, result, reset } = useBidiTextChecker();

const { t } = useI18n();
const U = 'tools.bidi-text-checker.ui.';
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
        :label="t(U + 'inputText')"
        as="textarea"
        mono
        :rows="4"
        spellcheck="false"
        :placeholder="t(U + 'placeholder')"
      />
    </ToolInput>

    <ToolOutput
      v-if="result"
      :title="t(U + 'summaryTitle')"
      :description="t(U + 'summaryDesc')"
      hide-copy
    >
      <div class="qt-row" style="--qt-row-gap:20px;margin-bottom:8px">
        <div class="qt-stack" style="--qt-stack-gap:2px">
          <span class="qt-label" style="font-size:11px;text-transform:uppercase">{{ t(U + 'overallDir') }}</span>
          <span style="font-size:16px;font-weight:700" :class="`bidi__dir--${result.overallDirection.toLowerCase()}`">
            {{ result.overallDirection }}
          </span>
        </div>
        <div class="qt-stack" style="--qt-stack-gap:2px">
          <span class="qt-label" style="font-size:11px;text-transform:uppercase">{{ t(U + 'ltrChars') }}</span>
          <span style="font-size:16px;font-weight:700">{{ result.ltrCount }}</span>
        </div>
        <div class="qt-stack" style="--qt-stack-gap:2px">
          <span class="qt-label" style="font-size:11px;text-transform:uppercase">{{ t(U + 'rtlChars') }}</span>
          <span style="font-size:16px;font-weight:700">{{ result.rtlCount }}</span>
        </div>
        <div class="qt-stack" style="--qt-stack-gap:2px">
          <span class="qt-label" style="font-size:11px;text-transform:uppercase">{{ t(U + 'neutralChars') }}</span>
          <span style="font-size:16px;font-weight:700">{{ result.neutralCount }}</span>
        </div>
        <div class="qt-stack" v-if="result.hasBiDiControls" style="--qt-stack-gap:2px">
          <span class="qt-label" style="font-size:11px;text-transform:uppercase">{{ t(U + 'bidiControls') }}</span>
          <span style="font-size:16px;font-weight:700;color:var(--qt-danger, #e5484d)">{{ result.controlCount }}</span>
        </div>
      </div>
      <ToolAlert v-if="result.hasBiDiControls" kind="error">
        {{ t(U + 'controlsDetected', { n: result.controlCount }) }}
      </ToolAlert>
    </ToolOutput>

    <ToolOutput
      v-if="result && result.visualized"
      :title="t(U + 'visualizedTitle')"
      :description="t(U + 'visualizedDesc')"
      :copy-text="result.visualized"
    >
      <div class="qt-panel qt-mono" dir="auto" style="font-size:14px;padding:12px;word-break:break-all;line-height:1.6">{{ result.visualized }}</div>
    </ToolOutput>

    <ToolOutput
      v-if="result && result.chars.length"
      :title="t(U + 'breakdownTitle')"
      :description="t(U + 'breakdownDesc')"
      hide-copy
    >
      <div class="qt-row" style="--qt-row-gap:6px">
        <div v-for="(c, i) in result.chars" :key="i" class="bidi__char-card qt-panel qt-stack" :class="`bidi__char-card--${c.direction.toLowerCase()}`" style="--qt-stack-gap:2px;align-items:center;padding:6px 8px;min-width:60px">
          <span style="font-size:18px;line-height:1">{{ c.char === ' ' || c.char === '\n' || c.char === '\t' ? '·' : c.char }}</span>
          <span class="qt-mono" style="font-size:10px;color:var(--qt-muted)">{{ c.hex }}</span>
          <span class="bidi__char-dir">{{ c.direction }}</span>
          <span v-if="c.isControl" style="font-size:9px;color:var(--qt-danger, #e5484d);font-weight:600">{{ c.controlName }}</span>
          <span v-if="c.isMirrored" class="qt-hint" style="font-size:9px">{{ t(U + 'mirrored') }}</span>
        </div>
      </div>
    </ToolOutput>
  </div>
</template>

<style scoped>
/* Kept scoped: direction-tinted colors (unique to this tool). */
.bidi__dir--ltr { color: #2ea043; }
.bidi__dir--rtl { color: #d29922; }
.bidi__dir--neutral { color: var(--qt-muted); }

/* Direction-tinted card borders. */
.bidi__char-card--ltr {
  border-color: rgba(46, 160, 67, 0.3);
}
.bidi__char-card--rtl {
  border-color: rgba(210, 153, 34, 0.3);
}

/* Direction pill inside each card. */
.bidi__char-dir {
  font-size: 10px;
  font-weight: 700;
  padding: 1px 4px;
  border-radius: 999px;
}
.bidi__char-card--ltr .bidi__char-dir { background: rgba(46, 160, 67, 0.15); color: #2ea043; }
.bidi__char-card--rtl .bidi__char-dir { background: rgba(210, 153, 34, 0.15); color: #d29922; }
.bidi__char-card--neutral .bidi__char-dir { background: var(--qt-bg); color: var(--qt-muted); }
</style>
