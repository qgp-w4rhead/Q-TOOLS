<script setup lang="ts">
/**
 * CronExpressionValidator - validate, explain, and preview cron expressions.
 */
import { useI18n } from 'vue-i18n';
import { RotateCcw, CheckCircle2, XCircle, Clock } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import ToolField from '@/components/ToolField.vue';
import ToolButton from '@/components/ToolButton.vue';
import ToolAlert from '@/components/ToolAlert.vue';
import {
  useCronExpressionValidator,
} from './useCronExpressionValidator';

const {
  expression,
  result,
  reset,
} = useCronExpressionValidator();

const { t, locale } = useI18n();
const U = 'tools.cron-expression-validator.ui.';

function formatDate(d: Date): string {
  return d.toLocaleString(locale.value, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short',
  });
}
</script>

<template>
  <div class="qt-tool">
    <ToolInput
      :title="t(U + 'inputTitle')"
      :description="t(U + 'desc')"
    >
      <template #actions>
        <ToolButton @click="reset">
          <RotateCcw :size="14" />
          <span>{{ t('common.reset') }}</span>
        </ToolButton>
      </template>

      <ToolField
        v-model="expression"
        :label="t(U + 'exprLabel')"
        mono
        spellcheck="false"
        placeholder="*/5 * * * *"
      />

      <div class="qt-row qt-row--center" style="--qt-row-gap:6px">
        <span class="qt-hint" style="font-size:12px">{{ t(U + 'examplesLabel') }}</span>
        <button v-for="ex in ['*/5 * * * *', '0 9 * * 1-5', '0 0 1 * *', '30 3 * * *', '0 */2 * * *']" :key="ex" type="button" class="qt-chip qt-mono" @click="expression = ex">{{ ex }}</button>
      </div>
    </ToolInput>

    <ToolOutput
      :title="t('common.result')"
      :hide-copy="true"
    >
      <div>
        <span class="qt-badge" :class="result.valid ? 'qt-badge--success' : 'qt-badge--error'" style="font-size:14px;padding:6px 12px">
          <CheckCircle2 v-if="result.valid" :size="16" />
          <XCircle v-else :size="16" />
          <span>{{ result.valid ? t(U + 'badgeValid') : t(U + 'badgeInvalid') }}</span>
        </span>
      </div>

      <ToolAlert v-if="!result.valid && result.error" kind="error">
        {{ result.error }}
      </ToolAlert>

      <template v-if="result.valid">
        <div class="qt-stack" style="--qt-stack-gap:4px">
          <span class="qt-label">{{ t(U + 'normLabel') }}</span>
          <code class="qt-mono" style="font-size:13.5px;background:var(--qt-bg);border:1px solid var(--qt-border);border-radius:var(--qt-radius-sm);padding:4px 8px;align-self:flex-start">{{ result.expression }}</code>
        </div>

        <div class="qt-stack" style="--qt-stack-gap:4px">
          <span class="qt-label">{{ t(U + 'descLabel') }}</span>
          <p style="margin:0;font-size:13.5px;color:var(--qt-text);line-height:1.5">{{ result.description }}</p>
        </div>

        <div class="qt-stack" style="--qt-stack-gap:4px">
          <span class="qt-label">
            <Clock :size="12" />
            {{ t(U + 'nextRunsLabel') }}
          </span>
          <ol class="qt-stack" style="--qt-stack-gap:4px;margin:0;padding-left:20px">
            <li v-for="(d, i) in result.nextRuns" :key="i" class="qt-mono" style="font-size:13px">{{ formatDate(d) }}</li>
          </ol>
        </div>
      </template>
    </ToolOutput>
  </div>
</template>
