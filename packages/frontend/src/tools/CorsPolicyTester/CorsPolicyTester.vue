<script setup lang="ts">
/**
 * CorsPolicyTester - validate and test CORS configurations; generate
 * Access-Control-* headers.
 */
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { RotateCcw } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import ToolField from '@/components/ToolField.vue';
import ToolButton from '@/components/ToolButton.vue';
import SegmentedControl from '@/components/SegmentedControl.vue';
import CopyButton from '@/components/CopyButton.vue';
import {
  useCorsPolicyTester,
  ALL_METHODS,
  COMMON_HEADERS,
} from './useCorsPolicyTester';

const { t } = useI18n();
const U = 'tools.cors-policy-tester.ui.';

const {
  config,
  analysis,
  reset,
} = useCorsPolicyTester();

type OutputMode = 'headers' | 'nginx';
const outputMode = ref<OutputMode>('headers');
const outputModeOptions = computed<Array<{ id: OutputMode; label: string }>>(() => [
  { id: 'headers', label: t(U + 'modeHeaders') },
  { id: 'nginx', label: t(U + 'modeNginx') },
]);

function toggleMethod(method: string): void {
  const idx = config.value.allowedMethods.indexOf(method as typeof config.value.allowedMethods[number]);
  if (idx >= 0) {
    config.value.allowedMethods.splice(idx, 1);
  } else {
    config.value.allowedMethods.push(method as typeof config.value.allowedMethods[number]);
  }
}

function toggleHeader(header: string): void {
  const idx = config.value.allowedHeaders.indexOf(header);
  if (idx >= 0) {
    config.value.allowedHeaders.splice(idx, 1);
  } else {
    config.value.allowedHeaders.push(header);
  }
}

function toggleExposedHeader(header: string): void {
  const idx = config.value.exposedHeaders.indexOf(header);
  if (idx >= 0) {
    config.value.exposedHeaders.splice(idx, 1);
  } else {
    config.value.exposedHeaders.push(header);
  }
}

const customHeader = ref('');
function addCustomHeader(): void {
  const h = customHeader.value.trim();
  if (h && !config.value.allowedHeaders.includes(h)) {
    config.value.allowedHeaders.push(h);
  }
  customHeader.value = '';
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
        v-model="config.allowedOrigins"
        :label="t(U + 'originsLabel')"
        :placeholder="t(U + 'phOrigins')"
      />

      <div class="qt-field">
        <span class="qt-label">{{ t(U + 'methodsLabel') }}</span>
        <div class="qt-row" style="--qt-row-gap:6px">
          <button
            v-for="m in ALL_METHODS"
            :key="m"
            type="button"
            class="qt-chip"
            :class="{ 'qt-chip--active': config.allowedMethods.includes(m) }"
            @click="toggleMethod(m)"
          >{{ m }}</button>
        </div>
      </div>

      <div class="qt-field">
        <span class="qt-label">{{ t(U + 'headersLabel') }}</span>
        <div class="qt-row" style="--qt-row-gap:6px">
          <button
            v-for="h in COMMON_HEADERS"
            :key="h"
            type="button"
            class="qt-chip"
            :class="{ 'qt-chip--active': config.allowedHeaders.includes(h) }"
            @click="toggleHeader(h)"
          >{{ h }}</button>
        </div>
        <div class="qt-row" style="--qt-row-gap:6px;flex-wrap:nowrap">
          <input
            type="text"
            class="qt-input"
            style="padding:7px 10px;font-size:13px"
            :placeholder="t(U + 'phCustomHeader')"
            v-model="customHeader"
            @keydown.enter="addCustomHeader"
          />
          <button type="button" class="qt-btn qt-btn--ghost" style="padding:7px 12px" @click="addCustomHeader">{{ t('common.add') }}</button>
        </div>
      </div>

      <div class="qt-field">
        <span class="qt-label">{{ t(U + 'exposedLabel') }}</span>
        <div class="qt-row" style="--qt-row-gap:6px">
          <button
            v-for="h in COMMON_HEADERS"
            :key="'exp-' + h"
            type="button"
            class="qt-chip"
            :class="{ 'qt-chip--active': config.exposedHeaders.includes(h) }"
            @click="toggleExposedHeader(h)"
          >{{ h }}</button>
        </div>
      </div>

      <div class="qt-row qt-row--bottom" style="--qt-row-gap:14px">
        <label class="qt-check" style="font-size:13px">
          <input type="checkbox" v-model="config.allowCredentials" />
          <span>{{ t(U + 'credLabel') }}</span>
        </label>
        <ToolField v-model.number="config.maxAge" :label="t(U + 'maxAgeLabel')" type="number" min="0" />
      </div>
    </ToolInput>

    <ToolOutput
      :title="t(U + 'outTitle')"
      :description="t(analysis.headers.length === 1 ? U + 'descHeadersOne' : U + 'descHeaders', { n: analysis.headers.length })"
      :copy-text="outputMode === 'headers' ? analysis.configText : analysis.nginxText"
    >
      <template #actions>
        <SegmentedControl v-model="outputMode" :options="outputModeOptions" />
      </template>

      <pre class="qt-output" style="margin:0;max-height:300px">{{ outputMode === 'headers' ? analysis.configText : analysis.nginxText }}</pre>

      <div v-if="analysis.issues.length > 0" class="qt-stack" style="--qt-stack-gap:4px;padding-top:8px;border-top:1px solid var(--qt-border)">
        <div style="font-size:13px;font-weight:700;color:var(--qt-text)">{{ t(U + 'issuesTitle') }}</div>
        <div v-for="(issue, i) in analysis.issues" :key="i" class="cpt__issue cpt__issue--error">
          {{ issue }}
        </div>
      </div>

      <div v-if="analysis.warnings.length > 0" class="qt-stack" style="--qt-stack-gap:4px;padding-top:8px;border-top:1px solid var(--qt-border)">
        <div style="font-size:13px;font-weight:700;color:var(--qt-text)">{{ t(U + 'warningsTitle') }}</div>
        <div v-for="(w, i) in analysis.warnings" :key="i" class="cpt__issue cpt__issue--warning">
          {{ w }}
        </div>
      </div>

      <div class="qt-stack" style="--qt-stack-gap:6px">
        <div v-for="h in analysis.headers" :key="h.name" class="cpt__header-row">
          <div class="qt-stack" style="--qt-stack-gap:2px;flex:1;min-width:0">
            <code class="qt-mono" style="font-size:13px;font-weight:700;color:var(--qt-accent)">{{ h.name }}</code>
            <span class="qt-hint">{{ h.description }}</span>
          </div>
          <code class="qt-mono" style="font-size:12px;max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{{ h.value }}</code>
          <CopyButton :text="`${h.name}: ${h.value}`" icon-only :label="t('common.copy')" />
        </div>
      </div>
    </ToolOutput>
  </div>
</template>

<style scoped>
/* Kept scoped: patterns unique to this tool (no generic utility). */

/* Issue line — severity-tinted box. */
.cpt__issue {
  padding: 6px 10px;
  border-radius: var(--qt-radius-sm);
  font-size: 12.5px;
}
.cpt__issue--error {
  background: oklch(from var(--qt-danger) 95% c h / 0.1);
  color: var(--qt-danger);
  border: 1px solid oklch(from var(--qt-danger) 80% c h / 0.3);
}
.cpt__issue--warning {
  background: oklch(from var(--qt-warning) 95% c h / 0.1);
  color: var(--qt-warning);
  border: 1px solid oklch(from var(--qt-warning) 80% c h / 0.3);
}

/* Header row — info stack + value + copy. */
.cpt__header-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  background: var(--qt-bg);
}
</style>
