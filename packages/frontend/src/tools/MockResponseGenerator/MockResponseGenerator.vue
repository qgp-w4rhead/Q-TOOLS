<script setup lang="ts">
/**
 * MockResponseGenerator — generate mock JSON from schema, template, or random.
 */
import { useI18n } from 'vue-i18n';
import { RotateCcw } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import ToolField from '@/components/ToolField.vue';
import ToolButton from '@/components/ToolButton.vue';
import ToolAlert from '@/components/ToolAlert.vue';
import {
  useMockResponseGenerator,
  type GenerationMode,
} from './useMockResponseGenerator';

const { config, output, error, reset } = useMockResponseGenerator();

const { t } = useI18n();
const U = 'tools.mock-response-generator.ui.';

const MODES: GenerationMode[] = ['random', 'schema', 'template'];

const SCHEMA_SAMPLE = `{
  "type": "object",
  "properties": {
    "id": { "type": "string", "faker": "uuid" },
    "name": { "type": "string", "faker": "name" },
    "email": { "type": "string", "faker": "email" },
    "age": { "type": "integer", "minimum": 18, "maximum": 99 },
    "active": { "type": "boolean" }
  }
}`;

const TEMPLATE_SAMPLE = `{
  "userId": "{{randomUuid}}",
  "username": "{{randomString(8)}}",
  "email": "{{randomEmail}}",
  "score": "{{randomInt(0, 100)}}",
  "verified": "{{randomBool}}"
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

      <div class="qt-row qt-row--center" style="--qt-row-gap:8px">
        <label class="qt-label">{{ t(U + 'mode') }}</label>
        <select class="qt-input" style="width:auto;font-size:13px;padding:6px 10px" v-model="config.mode">
          <option v-for="m in MODES" :key="m" :value="m">{{ m }}</option>
        </select>
      </div>

      <template v-if="config.mode !== 'random'">
        <div class="qt-row" style="--qt-row-gap:8px">
          <ToolButton v-if="config.mode === 'schema'" @click="config.input = SCHEMA_SAMPLE">{{ t(U + 'loadSchema') }}</ToolButton>
          <ToolButton v-else @click="config.input = TEMPLATE_SAMPLE">{{ t(U + 'loadTemplate') }}</ToolButton>
        </div>

        <ToolField
          v-model="config.input"
          :label="config.mode === 'schema' ? t(U + 'jsonSchema') : t(U + 'template')"
          as="textarea"
          mono
          :placeholder="t(U + 'phInput')"
          spellcheck="false"
          :rows="10"
        />
      </template>

      <template v-else>
        <label class="qt-row qt-row--center" style="--qt-row-gap:8px;flex-wrap:nowrap">
          <span class="qt-label">{{ t(U + 'count') }}</span>
          <input class="qt-input" style="width:auto;font-size:13px;padding:6px 10px" type="number" v-model.number="config.count" min="1" max="100" />
        </label>
      </template>

      <label class="qt-row qt-row--center" style="--qt-row-gap:8px;flex-wrap:nowrap">
        <span class="qt-label">{{ t(U + 'indent') }}</span>
        <select class="qt-input" style="width:auto;font-size:13px;padding:6px 10px" v-model.number="config.indent">
          <option :value="0">{{ t(U + 'indentMin') }}</option>
          <option :value="2">{{ t(U + 'indent2') }}</option>
          <option :value="4">{{ t(U + 'indent4') }}</option>
        </select>
      </label>
    </ToolInput>

    <ToolOutput :title="t(U + 'outTitle')" :copy-text="output">
      <ToolAlert v-if="error" kind="error">{{ error }}</ToolAlert>
      <pre v-else-if="output" class="qt-output" style="margin:0;font-size:13px;max-height:500px">{{ output }}</pre>
      <ToolAlert v-else kind="empty">{{ t(U + 'alertEmpty') }}</ToolAlert>
    </ToolOutput>
  </div>
</template>
