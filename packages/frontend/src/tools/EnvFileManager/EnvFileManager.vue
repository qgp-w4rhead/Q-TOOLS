<script setup lang="ts">
/**
 * EnvFileManager - .env ↔ JSON conversion, diff, and merge.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { RotateCcw, AlertTriangle } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import ToolField from '@/components/ToolField.vue';
import ToolButton from '@/components/ToolButton.vue';
import ToolAlert from '@/components/ToolAlert.vue';
import {
  useEnvFileManager,
  type EnvMode,
} from './useEnvFileManager';

const {
  mode,
  inputA,
  inputB,
  output,
  duplicates,
  errors,
  reset,
} = useEnvFileManager();

const { t } = useI18n();
const U = 'tools.env-file-manager.ui.';

const MODES = computed<{ value: EnvMode; label: string }[]>(() => [
  { value: 'env-to-json', label: t(U + 'modeEnvToJson') },
  { value: 'json-to-env', label: t(U + 'modeJsonToEnv') },
  { value: 'diff', label: t(U + 'modeDiff') },
  { value: 'merge', label: t(U + 'modeMerge') },
]);

const inputALabel = computed(() =>
  mode.value === 'diff' || mode.value === 'merge'
    ? t(U + 'fileALabel')
    : mode.value === 'json-to-env'
      ? t(U + 'jsonInputLabel')
      : t(U + 'envInputLabel'),
);

const outTitle = computed(() =>
  mode.value === 'env-to-json'
    ? t(U + 'outJson')
    : mode.value === 'json-to-env'
      ? t(U + 'outEnv')
      : mode.value === 'diff'
        ? t(U + 'outDiff')
        : t(U + 'outMerged'),
);

const jsonPlaceholder = '{\n  "KEY": "value"\n}';
const envPlaceholder = 'KEY=value\n# comment';
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

      <label class="qt-field">
        <span class="qt-label">{{ t('common.mode') }}</span>
        <select class="qt-input" style="max-width:200px" :value="mode" @change="mode = (($event.target as HTMLSelectElement).value as EnvMode)">
          <option v-for="m in MODES" :key="m.value" :value="m.value">{{ m.label }}</option>
        </select>
      </label>

      <div class="qt-row" style="--qt-row-gap:10px">
        <ToolField
          v-model="inputA"
          as="textarea"
          mono
          grow
          :label="inputALabel"
          spellcheck="false"
          :placeholder="mode === 'json-to-env' ? jsonPlaceholder : envPlaceholder"
          :rows="10"
        />

        <ToolField
          v-if="mode === 'diff' || mode === 'merge'"
          v-model="inputB"
          as="textarea"
          mono
          grow
          :label="t(U + 'fileBLabel')"
          spellcheck="false"
          placeholder="KEY=value"
          :rows="10"
        />
      </div>

      <div v-if="duplicates.length > 0" class="qt-alert qt-alert--warn">
        <AlertTriangle :size="14" />
        <span>{{ t(U + 'dupWarn', { keys: duplicates.join(', ') }) }}</span>
      </div>
      <div v-if="errors.length > 0" class="qt-stack" style="--qt-stack-gap:4px">
        <ToolAlert v-for="e in errors" :key="e" kind="error">{{ e }}</ToolAlert>
      </div>
    </ToolInput>

    <ToolOutput
      :title="outTitle"
      :copy-text="output"
      :copy-label="t('common.copy')"
    >
      <pre class="qt-output" style="margin:0;max-height:60vh"><code>{{ output }}</code></pre>
    </ToolOutput>
  </div>
</template>
