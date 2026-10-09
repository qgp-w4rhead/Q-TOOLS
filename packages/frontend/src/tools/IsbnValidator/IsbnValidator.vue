<script setup lang="ts">
/**
 * IsbnValidator - validate ISBN-10 and ISBN-13 numbers.
 *
 * Enter an ISBN to check its type, verify the checksum, and see the
 * formatted version.
 *
 * Works in embed mode: receives `input` PostMessages to set the ISBN
 * and sends `output` PostMessages with the validation result.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { RotateCcw, CheckCircle2, XCircle } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import CopyButton from '@/components/CopyButton.vue';
import { useIsbnValidator, type IsbnType } from './useIsbnValidator';

const {
  input,
  type,
  isValid,
  formatted,
  reset,
} = useIsbnValidator();

function onInput(e: Event): void {
  input.value = (e.target as HTMLInputElement).value;
}

const { t } = useI18n();
const U = 'tools.isbn-validator.ui.';

const typeLabels = computed<Record<IsbnType, string>>(() => ({
  isbn10: t(U + 'typeIsbn10'),
  isbn13: t(U + 'typeIsbn13'),
  unknown: t(U + 'typeUnknown'),
}));
</script>

<template>
  <div class="qt-tool">
    <ToolInput
      :title="t(U + 'inputTitle')"
      :description="t(U + 'desc')"
    >
      <template #actions>
        <button
          type="button"
          class="qt-btn qt-btn--ghost"
          :title="t(U + 'resetTitle')"
          @click="reset"
        >
          <RotateCcw :size="14" />
          <span>{{ t('common.reset') }}</span>
        </button>
      </template>

      <label class="qt-field">
        <span class="qt-label">{{ t(U + 'isbnLabel') }}</span>
        <input
          type="text"
          class="qt-input qt-input--mono"
          :placeholder="t(U + 'placeholder')"
          :value="input"
          @input="onInput"
        />
      </label>
    </ToolInput>

    <ToolOutput
      :title="t(U + 'outputTitle')"
      :description="isValid === null ? t(U + 'descEmpty') : (isValid ? t(U + 'descValid') : t(U + 'descInvalid'))"
    >
      <div v-if="isValid === null" class="qt-alert qt-alert--empty">
        {{ t(U + 'descEmpty') }}
      </div>
      <div v-else class="qt-stack" style="--qt-stack-gap:16px">
        <div class="iv__status" :class="isValid ? 'iv__status--valid' : 'iv__status--invalid'">
          <component :is="isValid ? CheckCircle2 : XCircle" :size="20" />
          <span>{{ isValid ? t(U + 'valid') : t(U + 'invalid') }}</span>
        </div>
        <div class="qt-stack">
          <div class="qt-result-row">
            <span class="qt-label" style="min-width:80px">{{ t(U + 'type') }}</span>
            <span class="qt-value qt-value--sm" style="flex:1">{{ typeLabels[type] }}</span>
          </div>
          <div class="qt-result-row">
            <span class="qt-label" style="min-width:80px">{{ t(U + 'formatted') }}</span>
            <span class="qt-value qt-value--sm" style="flex:1">{{ formatted }}</span>
            <CopyButton
              v-if="formatted"
              :text="formatted"
              :label="t('common.copy')"
              icon-only
            />
          </div>
        </div>
      </div>
    </ToolOutput>
  </div>
</template>

<style scoped>
/* Kept scoped: patterns unique to this tool (no generic utility). */

/* Valid/invalid status banner — large icon + colored verdict text. */
.iv__status {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 18px;
  font-weight: 700;
}
.iv__status--valid {
  color: oklch(0.62 0.17 150);
}
.iv__status--invalid {
  color: var(--qt-danger);
}
</style>
