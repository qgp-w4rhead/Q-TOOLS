<script setup lang="ts">
/**
 * HashIdentifier - paste a hash string to identify the likely algorithm
 * (MD5, SHA-1, SHA-256, bcrypt, etc.) by length and format.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { RotateCcw } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import ToolField from '@/components/ToolField.vue';
import ToolButton from '@/components/ToolButton.vue';
import ToolAlert from '@/components/ToolAlert.vue';
import {
  useHashIdentifier,
} from './useHashIdentifier';

const { t } = useI18n();
const U = 'tools.hash-identifier.ui.';

const {
  hashInput,
  matches,
  reset,
} = useHashIdentifier();

const confidenceColor: Record<string, string> = {
  high: 'var(--qt-success)',
  medium: 'var(--qt-warning)',
  low: 'var(--qt-muted)',
};

const confidenceLabel = computed<Record<string, string>>(() => ({
  high: t(U + 'confHigh'),
  medium: t(U + 'confMedium'),
  low: t(U + 'confLow'),
}));
</script>

<template>
  <div class="qt-tool">
    <ToolInput
      :title="t(U + 'inputTitle')"
      :description="t(U + 'desc')"
    >
      <template #actions>
        <ToolButton :title="t('common.reset')" @click="reset">
          <RotateCcw :size="14" />
          <span>{{ t('common.reset') }}</span>
        </ToolButton>
      </template>

      <ToolField
        v-model="hashInput"
        :label="t(U + 'hashLabel')"
        mono
        :placeholder="t(U + 'phHash')"
        spellcheck="false"
        autocomplete="off"
      />
    </ToolInput>

    <ToolOutput
      :title="t(U + 'outTitle')"
      :description="t(matches.length === 1 ? U + 'descMatchesOne' : U + 'descMatches', { n: matches.length })"
      :hide-copy="true"
    >
      <ToolAlert v-if="matches.length === 0 && hashInput.trim()" kind="error">
        {{ t(U + 'alertNoMatch') }}
      </ToolAlert>

      <ToolAlert v-else-if="matches.length === 0" kind="empty">
        {{ t(U + 'alertEmpty') }}
      </ToolAlert>

      <div v-else class="qt-stack">
        <div
          v-for="(m, i) in matches"
          :key="i"
          class="qt-result"
        >
          <div class="qt-row qt-row--center qt-row--between" style="--qt-row-gap:8px;flex-wrap:nowrap">
            <span style="font-size:14px;font-weight:700;color:var(--qt-accent)">{{ m.algorithm }}</span>
            <span
              style="font-size:11.5px;font-weight:600;text-transform:capitalize"
              :style="{ color: confidenceColor[m.confidence] }"
            >{{ confidenceLabel[m.confidence] ?? m.confidence }} {{ t(U + 'confSuffix') }}</span>
          </div>
          <p style="margin:4px 0 0;font-size:12.5px;color:var(--qt-muted)">{{ m.description }}</p>
          <div class="qt-row" style="--qt-row-gap:10px;margin-top:6px">
            <span v-if="m.bitLength > 0" class="qt-badge">{{ t(U + 'bitsBadge', { n: m.bitLength }) }}</span>
            <span class="qt-badge">{{ t(U + 'hexBadge', { n: m.hexLength }) }}</span>
          </div>
        </div>
      </div>
    </ToolOutput>
  </div>
</template>

