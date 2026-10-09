<script setup lang="ts">
/**
 * DockerfileLinter - paste a Dockerfile and get best-practice lint results.
 */
import { useI18n } from 'vue-i18n';
import { RotateCcw, AlertCircle, AlertTriangle, Info, CheckCircle2 } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import ToolField from '@/components/ToolField.vue';
import ToolButton from '@/components/ToolButton.vue';
import ToolAlert from '@/components/ToolAlert.vue';
import {
  useDockerfileLinter,
  type LintSeverity,
} from './useDockerfileLinter';

const {
  input,
  result,
  reset,
} = useDockerfileLinter();

const { t } = useI18n();
const U = 'tools.dockerfile-linter.ui.';

const SAMPLE = `FROM node:18
WORKDIR /app
COPY package*.json ./
RUN apt-get update && apt-get install -y curl
RUN npm install
COPY . .
EXPOSE 3000
CMD ["node", "server.js"]`;

const PLACEHOLDER = 'FROM node:18-alpine\nWORKDIR /app\nCOPY . .\nCMD ["node", "server.js"]';

const SEVERITY_ICON: Record<LintSeverity, typeof AlertCircle> = {
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const SEVERITY_CLASS: Record<LintSeverity, string> = {
  error: 'dl__rule--error',
  warning: 'dl__rule--warning',
  info: 'dl__rule--info',
};
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

      <ToolButton style="align-self:flex-start" @click="input = SAMPLE">{{ t(U + 'loadSample') }}</ToolButton>

      <ToolField
        v-model="input"
        as="textarea"
        mono
        :label="t(U + 'inputLabel')"
        spellcheck="false"
        :placeholder="PLACEHOLDER"
        :rows="12"
      />
    </ToolInput>

    <ToolOutput
      :title="t(U + 'outTitle')"
      :hide-copy="true"
    >
      <template v-if="input.trim()">
        <div class="qt-panel qt-row qt-row--center" style="--qt-row-gap:16px;padding:10px 14px">
          <div class="qt-row qt-row--bottom" style="--qt-row-gap:2px;flex-wrap:nowrap">
            <span class="qt-value qt-value--lg">{{ result.score }}</span>
            <span class="qt-hint" style="font-size:14px">/100</span>
          </div>
          <div class="qt-stack" style="--qt-stack-gap:2px">
            <span class="qt-row qt-row--center" style="--qt-row-gap:4px;flex-wrap:nowrap;font-size:13px;font-weight:600;color:oklch(0.6 0.2 145)">
              <CheckCircle2 :size="14" />
              {{ t(U + 'checksPassed', { passed: result.passedChecks, total: result.totalChecks }) }}
            </span>
            <span class="qt-hint" style="font-size:12px" :style="result.rules.length > 0 ? 'color:var(--qt-warning, #e0a800)' : ''">
              {{ t(result.rules.length === 1 ? U + 'rulesTriggeredOne' : U + 'rulesTriggered', { n: result.rules.length }) }}
            </span>
          </div>
        </div>

        <div v-if="result.rules.length === 0" class="qt-banner qt-banner--success">
          <CheckCircle2 :size="20" />
          <span>{{ t(U + 'allPassed') }}</span>
        </div>

        <div class="qt-stack" style="--qt-stack-gap:6px">
          <div v-for="(rule, i) in result.rules" :key="i" class="dl__rule" :class="SEVERITY_CLASS[rule.severity]">
            <component :is="SEVERITY_ICON[rule.severity]" :size="14" class="dl__rule-icon" />
            <div class="qt-stack" style="--qt-stack-gap:2px">
              <div class="qt-row qt-row--center" style="--qt-row-gap:8px">
                <span class="qt-mono" style="font-size:11px;font-weight:700;color:var(--qt-muted)">{{ rule.id }}</span>
                <span v-if="rule.line > 0" class="qt-hint" style="font-size:11px">{{ t(U + 'lineLabel', { n: rule.line }) }}</span>
              </div>
              <p style="margin:0;font-size:13px;color:var(--qt-text);line-height:1.4">{{ rule.message }}</p>
            </div>
          </div>
        </div>
      </template>
      <ToolAlert v-else kind="empty">
        {{ t(U + 'alertEmpty') }}
      </ToolAlert>
    </ToolOutput>
  </div>
</template>

<style scoped>
/* Kept scoped: patterns unique to this tool (no generic utility). */

/* Severity-tinted rule rows + per-severity icon colors. */
.dl__rule {
  display: flex;
  gap: 8px;
  padding: 8px 12px;
  border-radius: var(--qt-radius-sm);
  border: 1px solid var(--qt-border);
}
.dl__rule--error {
  border-color: oklch(0.6 0.2 25 / 0.3);
  background: oklch(0.6 0.2 25 / 0.05);
}
.dl__rule--warning {
  border-color: oklch(0.7 0.2 85 / 0.3);
  background: oklch(0.7 0.2 85 / 0.05);
}
.dl__rule--info {
  border-color: oklch(0.6 0.2 230 / 0.2);
  background: oklch(0.6 0.2 230 / 0.03);
}
.dl__rule-icon {
  flex-shrink: 0;
  margin-top: 2px;
}
.dl__rule--error .dl__rule-icon { color: oklch(0.6 0.2 25); }
.dl__rule--warning .dl__rule-icon { color: oklch(0.7 0.2 85); }
.dl__rule--info .dl__rule-icon { color: oklch(0.6 0.2 230); }
</style>
