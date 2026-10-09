<script setup lang="ts">
/**
 * CspEvaluator - paste a Content-Security-Policy header and get analysis
 * of directives, missing protections, and unsafe-inline warnings.
 */
import { useI18n } from 'vue-i18n';
import { RotateCcw } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import ToolField from '@/components/ToolField.vue';
import ToolButton from '@/components/ToolButton.vue';
import ToolAlert from '@/components/ToolAlert.vue';
import {
  useCspEvaluator,
} from './useCspEvaluator';

const { t } = useI18n();
const U = 'tools.csp-evaluator.ui.';

const {
  cspInput,
  evaluation,
  reset,
} = useCspEvaluator();

const severityColor: Record<string, string> = {
  danger: 'var(--qt-danger)',
  warning: 'var(--qt-warning)',
  info: 'var(--qt-accent)',
  pass: 'var(--qt-success)',
};

const severityBg: Record<string, string> = {
  danger: 'oklch(from var(--qt-danger) 95% c h / 0.1)',
  warning: 'oklch(from var(--qt-warning) 95% c h / 0.1)',
  info: 'var(--qt-bg)',
  pass: 'oklch(from var(--qt-success) 95% c h / 0.1)',
};
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
        v-model="cspInput"
        :label="t(U + 'cspLabel')"
        as="textarea"
        mono
        :rows="4"
        :placeholder="t(U + 'phCsp')"
      />
    </ToolInput>

    <ToolOutput
      :title="t(U + 'outTitle')"
      :hide-copy="true"
    >
      <!-- Score + summary -->
      <div class="qt-result" style="flex-direction:row;align-items:center;gap:14px;padding:12px">
        <div class="qt-row" style="--qt-row-gap:2px;align-items:baseline;flex-shrink:0;flex-wrap:nowrap">
          <span class="qt-stat">{{ evaluation.score }}</span>
          <span class="qt-hint" style="font-size:16px">/ {{ evaluation.maxScore }}</span>
        </div>
        <div class="qt-stack" style="--qt-stack-gap:6px;flex:1">
          <p style="margin:0;font-size:13px;font-weight:600;color:var(--qt-text)">{{ evaluation.summary }}</p>
          <div class="csp__score-bar">
            <div
              class="csp__score-fill"
              :style="{ width: `${(evaluation.score / evaluation.maxScore) * 100}%` }"
            />
          </div>
        </div>
      </div>

      <!-- Directives -->
      <div v-if="evaluation.directives.length > 0" class="qt-stack" style="padding-top:10px;border-top:1px solid var(--qt-border)">
        <div style="font-size:13px;font-weight:700;color:var(--qt-text)">{{ t(U + 'directivesTitle', { n: evaluation.directives.length }) }}</div>
        <div class="qt-stack" style="--qt-stack-gap:4px">
          <div v-for="d in evaluation.directives" :key="d.name" class="qt-result-row" style="padding:6px 10px;align-items:flex-start">
            <code class="qt-mono" style="font-size:13px;font-weight:700;color:var(--qt-accent);min-width:120px;flex-shrink:0">{{ d.name }}</code>
            <div class="qt-row" style="--qt-row-gap:4px">
              <code v-for="v in d.values" :key="v" class="qt-mono" style="font-size:12px;padding:2px 6px;border-radius:4px;background:var(--qt-surface)">{{ v }}</code>
            </div>
          </div>
        </div>
      </div>

      <!-- Findings -->
      <div v-if="evaluation.findings.length > 0" class="qt-stack" style="padding-top:10px;border-top:1px solid var(--qt-border)">
        <div style="font-size:13px;font-weight:700;color:var(--qt-text)">{{ t(U + 'findingsTitle', { n: evaluation.findings.length }) }}</div>
        <div class="qt-stack" style="--qt-stack-gap:4px;max-height:400px;overflow-y:auto">
          <div
            v-for="(f, i) in evaluation.findings"
            :key="i"
            class="csp__finding"
            :style="{ background: severityBg[f.severity] }"
          >
            <span
              class="csp__finding-badge"
              :style="{ color: severityColor[f.severity] }"
            >{{ f.severity.toUpperCase() }}</span>
            <div class="qt-stack" style="--qt-stack-gap:2px;flex:1">
              <p style="margin:0;font-size:12.5px;color:var(--qt-text)">{{ f.message }}</p>
              <p v-if="f.recommendation" class="qt-hint">{{ f.recommendation }}</p>
            </div>
            <code v-if="f.directive" class="qt-mono" style="font-size:11px;color:var(--qt-muted);flex-shrink:0">{{ f.directive }}</code>
          </div>
        </div>
      </div>

      <ToolAlert v-if="!cspInput.trim()" kind="empty">{{ t(U + 'alertEmpty') }}</ToolAlert>
    </ToolOutput>
  </div>
</template>

<style scoped>
/* Kept scoped: patterns unique to this tool (no generic utility). */

/* Score progress bar. */
.csp__score-bar {
  height: 6px;
  background: var(--qt-border);
  border-radius: 3px;
  overflow: hidden;
}
.csp__score-fill {
  height: 100%;
  background: var(--qt-accent);
  border-radius: 3px;
  transition: width 0.3s ease;
}

/* Finding row — severity-tinted box (bg set inline per severity). */
.csp__finding {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 8px 10px;
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
}
.csp__finding-badge {
  font-size: 11px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 4px;
  background: var(--qt-surface);
  flex-shrink: 0;
}
</style>
