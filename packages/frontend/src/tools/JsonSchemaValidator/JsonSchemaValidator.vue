<script setup lang="ts">
/**
 * JsonSchemaValidator — validate JSON instances against JSON Schema.
 */
import { useI18n } from 'vue-i18n';
import { RotateCcw, CheckCircle2, AlertCircle, AlertTriangle } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import ToolField from '@/components/ToolField.vue';
import ToolButton from '@/components/ToolButton.vue';
import ToolAlert from '@/components/ToolAlert.vue';
import { useJsonSchemaValidator } from './useJsonSchemaValidator';

const { instanceInput, schemaInput, result, reset } = useJsonSchemaValidator();

const { t } = useI18n();
const U = 'tools.json-schema-validator.ui.';

const SCHEMA_SAMPLE = `{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "required": ["name", "age"],
  "properties": {
    "name": { "type": "string", "minLength": 1 },
    "age": { "type": "integer", "minimum": 0, "maximum": 150 },
    "email": { "type": "string", "format": "email" }
  },
  "additionalProperties": false
}`;

const INSTANCE_SAMPLE = `{
  "name": "Alice",
  "age": 30,
  "email": "alice@example.com"
}`;
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

      <div class="qt-row" style="--qt-row-gap:8px">
        <ToolButton @click="schemaInput = SCHEMA_SAMPLE">{{ t(U + 'loadSchema') }}</ToolButton>
        <ToolButton @click="instanceInput = INSTANCE_SAMPLE">{{ t(U + 'loadInstance') }}</ToolButton>
      </div>

      <ToolField
        v-model="schemaInput"
        :label="t(U + 'jsonSchema')"
        as="textarea"
        mono
        :placeholder="t(U + 'phSchema')"
        spellcheck="false"
        :rows="8"
      />

      <ToolField
        v-model="instanceInput"
        :label="t(U + 'jsonInstance')"
        as="textarea"
        mono
        :placeholder="t(U + 'phInstance')"
        spellcheck="false"
        :rows="8"
      />
    </ToolInput>

    <ToolOutput :title="t(U + 'outTitle')" :hide-copy="true">
      <template v-if="instanceInput.trim() && schemaInput.trim()">
        <div v-if="!result.schemaValid" class="qt-alert qt-alert--warn" style="flex-wrap:wrap">
          <AlertTriangle :size="16" />
          <span>{{ t(U + 'schemaInvalid') }}</span>
          <span v-for="(e, i) in result.schemaErrors" :key="i">{{ e }}</span>
        </div>
        <template v-else>
          <div class="qt-row qt-row--center" style="--qt-row-gap:6px;flex-wrap:nowrap;font-size:14px;font-weight:700">
            <component
              :is="result.valid ? CheckCircle2 : AlertCircle"
              :size="16"
              :style="{ color: result.valid ? 'oklch(0.6 0.2 145)' : 'oklch(0.6 0.2 25)' }"
            />
            <span>{{ result.valid ? t(U + 'valid') : t(U + 'invalid') }}</span>
            <span class="qt-hint" style="font-size:12px;font-weight:400;margin-left:8px">{{ result.draft }}</span>
          </div>

          <div v-if="!result.valid && result.errors.length" class="qt-stack" style="--qt-stack-gap:4px">
            <div v-for="(err, i) in result.errors" :key="i" class="qt-alert qt-alert--error" style="align-items:flex-start">
              <AlertCircle :size="14" style="flex-shrink:0;margin-top:1px" />
              <span class="qt-mono" style="font-weight:700;flex-shrink:0">{{ err.path }}</span>
              <span style="flex:1">{{ err.message }}</span>
            </div>
          </div>
        </template>
      </template>
      <ToolAlert v-else kind="empty">{{ t(U + 'alertEmpty') }}</ToolAlert>
    </ToolOutput>
  </div>
</template>
