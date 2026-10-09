<script setup lang="ts">
/**
 * LogFormatter - parse and prettify common log formats.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { RotateCcw, AlertTriangle } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import ToolField from '@/components/ToolField.vue';
import ToolButton from '@/components/ToolButton.vue';
import {
  useLogFormatter,
  type LogFormat,
} from './useLogFormatter';

const {
  input,
  format,
  output,
  detectedFormat,
  errors,
  entryCount,
  reset,
} = useLogFormatter();

const { t } = useI18n();
const U = 'tools.log-formatter.ui.';

const FORMATS = computed<{ value: LogFormat; label: string }[]>(() => [
  { value: 'auto', label: t(U + 'fmtAuto') },
  { value: 'nginx', label: t(U + 'fmtNginx') },
  { value: 'apache', label: t(U + 'fmtApache') },
  { value: 'syslog', label: t(U + 'fmtSyslog') },
  { value: 'json', label: 'JSON' },
]);

const SAMPLE_NGINX = `192.168.1.1 - - [10/Oct/2023:13:55:36 +0000] "GET /api/users HTTP/1.1" 200 1234 "https://example.com/" "Mozilla/5.0"
10.0.0.5 - - [10/Oct/2023:13:55:37 +0000] "POST /api/login HTTP/1.1" 401 89 "-" "curl/8.0"`;
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

      <div class="qt-row qt-row--bottom" style="--qt-row-gap:10px">
        <label class="qt-field">
          <span class="qt-label">{{ t('common.format') }}</span>
          <select class="qt-input" style="width:200px" v-model="format">
            <option v-for="f in FORMATS" :key="f.value" :value="f.value">{{ f.label }}</option>
          </select>
        </label>
        <ToolButton @click="input = SAMPLE_NGINX">{{ t(U + 'loadSample') }}</ToolButton>
      </div>

      <ToolField
        v-model="input"
        as="textarea"
        mono
        :label="t(U + 'inputLabel')"
        spellcheck="false"
        :placeholder="t(U + 'phInput')"
        :rows="12"
      />

      <div v-if="entryCount > 0" class="qt-hint" style="font-size:13px">
        {{ t(U + 'detectedLabel') }} <strong style="color:var(--qt-text)">{{ detectedFormat }}</strong> - {{ t(entryCount === 1 ? U + 'entriesOne' : U + 'entries', { n: entryCount }) }}
      </div>
      <div v-if="errors.length > 0" class="qt-alert qt-alert--warn">
        <AlertTriangle :size="14" />
        <span>{{ t(errors.length === 1 ? U + 'parseErrorsOne' : U + 'parseErrors', { n: errors.length }) }}</span>
      </div>
    </ToolInput>

    <ToolOutput
      :title="t(U + 'outTitle')"
      :copy-text="output"
      :copy-label="t('common.copy')"
    >
      <pre class="qt-output" style="margin:0;max-height:60vh"><code>{{ output || t(U + 'emptyOut') }}</code></pre>
    </ToolOutput>
  </div>
</template>
