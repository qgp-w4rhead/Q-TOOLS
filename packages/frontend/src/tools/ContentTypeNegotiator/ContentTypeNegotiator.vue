<script setup lang="ts">
/**
 * ContentTypeNegotiator — parse Accept headers and show quality factors.
 */
import { useI18n } from 'vue-i18n';
import { RotateCcw } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import ToolField from '@/components/ToolField.vue';
import ToolButton from '@/components/ToolButton.vue';
import ToolAlert from '@/components/ToolAlert.vue';
import { useContentTypeNegotiator } from './useContentTypeNegotiator';

const { input, result, reset } = useContentTypeNegotiator();

const { t } = useI18n();
const U = 'tools.content-type-negotiator.ui.';

const SAMPLE = 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8';
</script>

<template>
  <div class="qt-tool">
    <ToolInput :title="t(U + 'inputTitle')" :description="t(U + 'desc')">
      <template #actions>
        <ToolButton @click="reset">
          <RotateCcw :size="14" />
          <span>{{ t('common.reset') }}</span>
        </ToolButton>
      </template>

      <ToolButton @click="input = SAMPLE">{{ t(U + 'loadSample') }}</ToolButton>

      <ToolField
        v-model="input"
        :label="t(U + 'acceptHeader')"
        as="textarea"
        mono
        :placeholder="t(U + 'phAccept')"
        spellcheck="false"
        :rows="3"
      />
    </ToolInput>

    <ToolOutput :title="t(U + 'outTitle')" :hide-copy="true">
      <template v-if="input.trim()">
        <template v-if="result.errors.length">
          <ToolAlert v-for="(e, i) in result.errors" :key="i" kind="error">{{ e }}</ToolAlert>
        </template>

        <div v-if="result.sorted.length" class="qt-stack" style="--qt-stack-gap:6px">
          <div v-for="(entry, i) in result.sorted" :key="i" class="qt-panel qt-row qt-row--center" style="--qt-row-gap:10px;flex-wrap:nowrap;padding:6px 10px">
            <span class="qt-mono" style="font-size:13px;font-weight:600;color:var(--qt-text);min-width:180px">{{ entry.type }}/{{ entry.subtype }}</span>
            <div class="ctn__q-bar">
              <div class="ctn__q-fill" :style="{ width: `${entry.quality * 100}%` }" />
            </div>
            <span class="qt-mono" style="font-size:12px;color:var(--qt-muted);min-width:50px;text-align:right">q={{ entry.quality }}</span>
            <span v-if="Object.keys(entry.params).length" class="qt-hint" style="font-size:11px">{{ JSON.stringify(entry.params) }}</span>
          </div>
        </div>
      </template>
      <ToolAlert v-else kind="empty">{{ t(U + 'alertEmpty') }}</ToolAlert>
    </ToolOutput>
  </div>
</template>

<style scoped>
/* Kept scoped: patterns unique to this tool (no generic utility). */

/* Quality-factor bar. */
.ctn__q-bar { flex: 1; height: 6px; border-radius: 3px; background: var(--qt-surface); overflow: hidden; }
.ctn__q-fill { height: 100%; background: var(--qt-accent); border-radius: 3px; }
</style>
