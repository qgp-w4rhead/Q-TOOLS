<script setup lang="ts">
/**
 * PiiRedactor - mask emails, phone numbers, SSNs, credit cards, and other
 * sensitive data in text.
 *
 * Paste or type text, toggle which PII types to detect, and see the redacted
 * output with a summary of what was found.
 */
import { useI18n } from 'vue-i18n';
import { RotateCcw } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import ToolField from '@/components/ToolField.vue';
import ToolButton from '@/components/ToolButton.vue';
import ToolAlert from '@/components/ToolAlert.vue';
import {
  usePiiRedactor,
  PII_TYPE_LABELS,
  type PiiType,
} from './usePiiRedactor';

const { t } = useI18n();
const U = 'tools.pii-redactor.ui.';

const {
  inputText,
  options,
  result,
  reset,
} = usePiiRedactor();

const piiTypes: PiiType[] = ['email', 'phone', 'ssn', 'creditCard', 'ipv4', 'ipv6', 'apiKey'];

function toggleType(type: PiiType): void {
  options.value[type] = !options.value[type];
}
</script>

<template>
  <div class="qt-tool">
    <ToolInput
      :title="t(U + 'inputTitle')"
      :description="t(U + 'desc')"
    >
      <template #actions>
        <ToolButton :title="t('common.resetDefaults')" @click="reset">
          <RotateCcw :size="14" />
          <span>{{ t('common.reset') }}</span>
        </ToolButton>
      </template>

      <ToolField
        v-model="inputText"
        :label="t(U + 'inputLabel')"
        as="textarea"
        mono
        :rows="6"
        :placeholder="t(U + 'phInput')"
      />

      <div class="qt-row" style="--qt-row-gap:6px">
        <button
          v-for="t in piiTypes"
          :key="t"
          type="button"
          class="qt-chip"
          :class="{ 'qt-chip--active': options[t] }"
          @click="toggleType(t)"
        >
          {{ PII_TYPE_LABELS[t] }}
        </button>
      </div>

      <ToolField
        v-model="options.maskToken"
        :label="t(U + 'maskLabel')"
      />
    </ToolInput>

    <ToolOutput
      :title="t(U + 'outTitle')"
      :description="t(U + 'outDesc')"
      :copy-text="result.redacted"
    >
      <pre v-if="result.redacted" class="qt-output" style="margin:0;max-height:400px">{{ result.redacted }}</pre>
      <ToolAlert v-else kind="empty">{{ t(U + 'alertEmpty') }}</ToolAlert>

      <div v-if="result.totalCount > 0" class="qt-stack" style="--qt-stack-gap:10px;padding-top:10px;border-top:1px solid var(--qt-border)">
        <div style="font-size:13px;font-weight:700;color:var(--qt-text)">{{ t(U + 'detectedTitle', { n: result.totalCount }) }}</div>
        <div class="qt-row" style="--qt-row-gap:8px">
          <div
            v-for="t in piiTypes"
            :key="t"
            v-show="result.counts[t] > 0"
            class="qt-badge"
          >
            <span class="qt-label">{{ PII_TYPE_LABELS[t] }}</span>
            <span class="qt-stat">{{ result.counts[t] }}</span>
          </div>
        </div>

        <div class="qt-stack" style="--qt-stack-gap:4px;max-height:300px;overflow-y:auto">
          <div
            v-for="(m, i) in result.matches"
            :key="i"
            class="qt-result-row"
            style="padding:6px 10px;font-size:12.5px;flex-wrap:nowrap"
          >
            <span style="font-weight:600;color:var(--qt-accent);white-space:nowrap;min-width:80px">{{ PII_TYPE_LABELS[m.type] }}</span>
            <code class="qt-mono" style="color:var(--qt-danger);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{{ m.original.length > 60 ? m.original.slice(0, 60) + '…' : m.original }}</code>
            <span style="color:var(--qt-muted)">→</span>
            <code class="qt-mono" style="color:var(--qt-success)">{{ m.masked }}</code>
          </div>
        </div>
      </div>
    </ToolOutput>
  </div>
</template>

