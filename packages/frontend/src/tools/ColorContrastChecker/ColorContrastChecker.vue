<script setup lang="ts">
/**
 * ColorContrastChecker - WCAG color contrast ratio checker.
 *
 * Enter foreground and background colors to compute the WCAG contrast
 * ratio and see pass/fail badges for AA and AAA conformance levels.
 *
 * Works in embed mode: receives `input` PostMessages to set colors
 * and sends `output` PostMessages with the contrast result.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { ArrowLeftRight } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import ToolField from '@/components/ToolField.vue';
import ToolButton from '@/components/ToolButton.vue';
import ResultRow from '@/components/ResultRow.vue';
import ToolAlert from '@/components/ToolAlert.vue';
import {
  useColorContrastChecker,
  rgbToCss,
} from './useColorContrastChecker';

const {
  foreground,
  background,
  result,
  foregroundRgb,
  backgroundRgb,
  swap,
} = useColorContrastChecker();

function onFg(e: Event): void {
  foreground.value = (e.target as HTMLInputElement).value;
}
function onBg(e: Event): void {
  background.value = (e.target as HTMLInputElement).value;
}

function formatRatio(r: number): string {
  return r.toFixed(2) + ':1';
}

function badgeClass(pass: boolean): string {
  return pass ? 'ccc__badge--pass' : 'ccc__badge--fail';
}

const { t } = useI18n();
const U = 'tools.color-contrast-checker.ui.';

function badgeText(pass: boolean): string {
  return pass ? t(U + 'pass') : t(U + 'fail');
}

const previewStyle = computed(() => {
  const fg = foregroundRgb.value;
  const bg = backgroundRgb.value;
  if (!fg || !bg) return {};
  return {
    color: rgbToCss(fg),
    backgroundColor: rgbToCss(bg),
  };
});

</script>

<template>
  <div class="qt-tool">
    <ToolInput
      :title="t(U + 'inputTitle')"
      :description="t(U + 'desc')"
    >
      <template #actions>
        <ToolButton :title="t(U + 'swapTitle')" @click="swap">
          <ArrowLeftRight :size="14" />
          <span>{{ t(U + 'swap') }}</span>
        </ToolButton>
      </template>

      <div class="qt-row" style="--qt-row-gap:12px">
        <div class="qt-field qt-field--grow" style="min-width:200px">
          <span class="qt-label">{{ t(U + 'foreground') }}</span>
          <div class="qt-row qt-row--center" style="--qt-row-gap:8px;flex-wrap:nowrap">
            <input
              type="color"
              class="ccc__picker"
              :aria-label="t(U + 'ariaFgPicker')"
              :value="foregroundRgb ? rgbToCss(foregroundRgb) : '#000000'"
              @input="onFg"
            />
            <ToolField
              v-model="foreground"
              placeholder="#000000"
              mono
              grow
              :aria-label="t(U + 'ariaFgValue')"
            />
          </div>
        </div>
        <div class="qt-field qt-field--grow" style="min-width:200px">
          <span class="qt-label">{{ t(U + 'background') }}</span>
          <div class="qt-row qt-row--center" style="--qt-row-gap:8px;flex-wrap:nowrap">
            <input
              type="color"
              class="ccc__picker"
              :aria-label="t(U + 'ariaBgPicker')"
              :value="backgroundRgb ? rgbToCss(backgroundRgb) : '#ffffff'"
              @input="onBg"
            />
            <ToolField
              v-model="background"
              placeholder="#ffffff"
              mono
              grow
              :aria-label="t(U + 'ariaBgValue')"
            />
          </div>
        </div>
      </div>
    </ToolInput>

    <ToolOutput
      v-if="result"
      :title="t(U + 'outputTitle')"
      :copy-text="formatRatio(result.ratio)"
      :copy-label="t(U + 'copyRatio')"
    >
      <div class="qt-panel" style="padding:16px;font-size:16px;line-height:1.5" :style="previewStyle">
        <span style="font-family:system-ui,sans-serif">{{ t(U + 'previewText') }}</span>
      </div>

      <ResultRow :label="t(U + 'lblRatio')" :value="formatRatio(result.ratio)" size="lg" />

      <div class="qt-grid" style="--qt-grid-min:180px">
        <div class="qt-panel qt-row qt-row--center qt-row--between" style="--qt-row-gap:8px;flex-wrap:nowrap;padding:8px 12px">
          <span class="qt-hint" style="font-size:12.5px">{{ t(U + 'critAaNormal') }}</span>
          <span class="qt-badge" :class="badgeClass(result.aaNormal)">{{ badgeText(result.aaNormal) }}</span>
        </div>
        <div class="qt-panel qt-row qt-row--center qt-row--between" style="--qt-row-gap:8px;flex-wrap:nowrap;padding:8px 12px">
          <span class="qt-hint" style="font-size:12.5px">{{ t(U + 'critAaLarge') }}</span>
          <span class="qt-badge" :class="badgeClass(result.aaLarge)">{{ badgeText(result.aaLarge) }}</span>
        </div>
        <div class="qt-panel qt-row qt-row--center qt-row--between" style="--qt-row-gap:8px;flex-wrap:nowrap;padding:8px 12px">
          <span class="qt-hint" style="font-size:12.5px">{{ t(U + 'critAaaNormal') }}</span>
          <span class="qt-badge" :class="badgeClass(result.aaaNormal)">{{ badgeText(result.aaaNormal) }}</span>
        </div>
        <div class="qt-panel qt-row qt-row--center qt-row--between" style="--qt-row-gap:8px;flex-wrap:nowrap;padding:8px 12px">
          <span class="qt-hint" style="font-size:12.5px">{{ t(U + 'critAaaLarge') }}</span>
          <span class="qt-badge" :class="badgeClass(result.aaaLarge)">{{ badgeText(result.aaaLarge) }}</span>
        </div>
      </div>
    </ToolOutput>

    <ToolOutput
      v-else
      :title="t(U + 'outputTitle')"
      :description="t(U + 'descEmpty')"
    >
      <ToolAlert kind="empty">
        {{ t(U + 'invalidAlert') }}
      </ToolAlert>
    </ToolOutput>
  </div>
</template>

<style scoped>
/* Kept scoped: color picker control + pass/fail badge tints. */
.ccc__picker {
  width: 40px;
  height: 40px;
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  cursor: pointer;
  background: none;
  padding: 2px;
  flex-shrink: 0;
}
.ccc__badge--pass {
  background: color-mix(in srgb, var(--qt-success) 20%, transparent);
  color: var(--qt-success);
}
.ccc__badge--fail {
  background: color-mix(in srgb, var(--qt-danger) 20%, transparent);
  color: var(--qt-danger);
}
</style>
