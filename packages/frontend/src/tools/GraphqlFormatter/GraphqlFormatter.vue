<script setup lang="ts">
/**
 * GraphqlFormatter — prettify and validate GraphQL queries.
 */
import { useI18n } from 'vue-i18n';
import { RotateCcw, CheckCircle2, AlertCircle } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import ToolField from '@/components/ToolField.vue';
import ToolButton from '@/components/ToolButton.vue';
import ToolAlert from '@/components/ToolAlert.vue';
import { useGraphqlFormatter } from './useGraphqlFormatter';

const { input, result, reset } = useGraphqlFormatter();

const { t } = useI18n();
const U = 'tools.graphql-query-formatter.ui.';

const SAMPLE = `query GetUser($id:ID!){user(id:$id){id name email posts{title comments{author body}}}}`;
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
        :label="t(U + 'query')"
        as="textarea"
        mono
        :placeholder="t(U + 'phQuery')"
        spellcheck="false"
        :rows="8"
      />
    </ToolInput>

    <ToolOutput :title="t(U + 'outTitle')" :copy-text="result.formatted">
      <template v-if="input.trim()">
        <div class="qt-row qt-row--center" style="--qt-row-gap:6px;flex-wrap:nowrap;font-size:14px;font-weight:700">
          <component
            :is="result.errors.length === 0 ? CheckCircle2 : AlertCircle"
            :size="16"
            :style="{ color: result.errors.length === 0 ? 'oklch(0.6 0.2 145)' : 'oklch(0.6 0.2 25)' }"
          />
          <span>{{ result.errors.length === 0 ? t(U + 'valid') : t(U + 'issues') }}</span>
        </div>

        <div v-if="result.operationType || result.operationName" class="qt-panel qt-stack" style="--qt-stack-gap:4px;padding:8px 12px">
          <div v-if="result.operationType" class="qt-row qt-row--between" style="font-size:13px"><span class="qt-hint" style="font-size:13px">{{ t(U + 'rType') }}</span><span style="color:var(--qt-text);font-weight:600">{{ result.operationType }}</span></div>
          <div v-if="result.operationName" class="qt-row qt-row--between" style="font-size:13px"><span class="qt-hint" style="font-size:13px">{{ t(U + 'rName') }}</span><span style="color:var(--qt-text);font-weight:600">{{ result.operationName }}</span></div>
          <div class="qt-row qt-row--between" style="font-size:13px"><span class="qt-hint" style="font-size:13px">{{ t(U + 'rFields') }}</span><span style="color:var(--qt-text);font-weight:600">{{ result.fieldsCount }}</span></div>
        </div>

        <div v-if="result.errors.length" class="qt-stack" style="--qt-stack-gap:4px">
          <div v-for="(e, i) in result.errors" :key="i" class="qt-alert qt-alert--error" style="align-items:flex-start">
            <AlertCircle :size="14" style="flex-shrink:0;margin-top:1px" />
            <span>{{ e }}</span>
          </div>
        </div>

        <pre v-if="result.formatted" class="qt-output" style="margin:0;font-size:13px">{{ result.formatted }}</pre>
      </template>
      <ToolAlert v-else kind="empty">{{ t(U + 'alertEmpty') }}</ToolAlert>
    </ToolOutput>
  </div>
</template>
