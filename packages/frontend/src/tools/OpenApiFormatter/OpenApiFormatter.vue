<script setup lang="ts">
/**
 * OpenApiFormatter — pretty-print and validate OpenAPI 3.x JSON/YAML specs.
 */
import { useI18n } from 'vue-i18n';
import { RotateCcw, CheckCircle2, AlertTriangle, AlertCircle } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import ToolField from '@/components/ToolField.vue';
import ToolButton from '@/components/ToolButton.vue';
import ToolAlert from '@/components/ToolAlert.vue';
import {
  useOpenApiFormatter,
  type InputFormat,
} from './useOpenApiFormatter';

const { input, format, result, reset } = useOpenApiFormatter();

const { t } = useI18n();
const U = 'tools.openapi-spec-formatter.ui.';

const SAMPLE = `{
  "openapi": "3.0.3",
  "info": {
    "title": "Sample API",
    "version": "1.0.0"
  },
  "paths": {
    "/users": {
      "get": {
        "summary": "List users",
        "responses": {
          "200": { "description": "OK" }
        }
      }
    }
  }
}`;

const FORMATS: InputFormat[] = ['auto', 'json', 'yaml'];
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

      <div class="qt-row qt-row--center" style="--qt-row-gap:8px">
        <label class="qt-label">{{ t(U + 'format') }}</label>
        <select class="qt-input" style="width:auto;font-size:13px;padding:6px 10px" v-model="format">
          <option v-for="f in FORMATS" :key="f" :value="f">{{ f }}</option>
        </select>
      </div>

      <ToolButton @click="input = SAMPLE">{{ t(U + 'loadSample') }}</ToolButton>

      <ToolField
        v-model="input"
        :label="t(U + 'specContent')"
        as="textarea"
        mono
        :placeholder="t(U + 'phSpec')"
        spellcheck="false"
        :rows="12"
      />
    </ToolInput>

    <ToolOutput :title="t(U + 'outTitle')" :copy-text="result.formatted">
      <template v-if="input.trim()">
        <div class="qt-row qt-row--center" style="--qt-row-gap:6px;flex-wrap:nowrap;font-size:14px;font-weight:700">
          <component
            :is="result.valid ? CheckCircle2 : AlertCircle"
            :size="16"
            :style="{ color: result.valid ? 'oklch(0.6 0.2 145)' : 'oklch(0.6 0.2 25)' }"
          />
          <span>{{ result.valid ? t(U + 'valid') : t(U + 'invalid') }}</span>
        </div>

        <div v-if="result.openapiVersion || result.title || result.pathsCount" class="qt-panel qt-stack" style="--qt-stack-gap:4px;padding:8px 12px">
          <div v-if="result.openapiVersion" class="qt-row qt-row--between" style="font-size:13px"><span class="qt-hint" style="font-size:13px">{{ t(U + 'rVersion') }}</span><span style="color:var(--qt-text);font-weight:600">{{ result.openapiVersion }}</span></div>
          <div v-if="result.title" class="qt-row qt-row--between" style="font-size:13px"><span class="qt-hint" style="font-size:13px">{{ t(U + 'rTitle') }}</span><span style="color:var(--qt-text);font-weight:600">{{ result.title }}</span></div>
          <div class="qt-row qt-row--between" style="font-size:13px"><span class="qt-hint" style="font-size:13px">{{ t(U + 'rPaths') }}</span><span style="color:var(--qt-text);font-weight:600">{{ result.pathsCount }}</span></div>
        </div>

        <div v-if="result.errors.length" class="qt-stack" style="--qt-stack-gap:4px">
          <div v-for="(e, i) in result.errors" :key="i" class="qt-alert qt-alert--error" style="align-items:flex-start">
            <AlertCircle :size="14" style="flex-shrink:0;margin-top:1px" />
            <span>{{ e }}</span>
          </div>
        </div>
        <div v-if="result.warnings.length" class="qt-stack" style="--qt-stack-gap:4px">
          <div v-for="(w, i) in result.warnings" :key="i" class="qt-alert qt-alert--warn" style="align-items:flex-start">
            <AlertTriangle :size="14" style="flex-shrink:0;margin-top:1px" />
            <span>{{ w }}</span>
          </div>
        </div>

        <pre v-if="result.formatted" class="qt-output" style="margin:0;font-size:13px;max-height:500px">{{ result.formatted }}</pre>
      </template>
      <ToolAlert v-else kind="empty">{{ t(U + 'alertEmpty') }}</ToolAlert>
    </ToolOutput>
  </div>
</template>
