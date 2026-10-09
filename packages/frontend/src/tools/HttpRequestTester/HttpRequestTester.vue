<script setup lang="ts">
/**
 * HttpRequestTester — send HTTP requests and inspect the response.
 */
import { useI18n } from 'vue-i18n';
import { RotateCcw, Plus, Trash2, Send, Loader2 } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import ToolField from '@/components/ToolField.vue';
import ToolButton from '@/components/ToolButton.vue';
import ToolAlert from '@/components/ToolAlert.vue';
import {
  useHttpRequestTester,
  type HttpMethod,
} from './useHttpRequestTester';

const {
  config,
  response,
  loading,
  error,
  addHeader,
  removeHeader,
  send,
  reset,
} = useHttpRequestTester();

const { t } = useI18n();
const U = 'tools.http-request-tester.ui.';

const METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

function statusClass(status: number): string {
  if (status >= 200 && status < 300) return 'qt-badge--success';
  if (status >= 300 && status < 400) return 'qt-badge--info';
  if (status >= 400 && status < 500) return 'qt-badge--warn';
  if (status >= 500) return 'qt-badge--error';
  return '';
}
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

      <div class="qt-row" style="--qt-row-gap:10px">
        <label class="qt-field" style="flex:0 0 120px">
          <span class="qt-label">{{ t(U + 'method') }}</span>
          <select class="qt-input" style="font-size:13px;padding:8px 10px" v-model="config.method">
            <option v-for="m in METHODS" :key="m" :value="m">{{ m }}</option>
          </select>
        </label>
        <ToolField
          v-model="config.url"
          :label="t(U + 'url')"
          :placeholder="t(U + 'phUrl')"
          spellcheck="false"
          grow
        />
      </div>

      <div class="qt-stack" style="--qt-stack-gap:6px">
        <div class="qt-row qt-row--center qt-row--between">
          <span class="qt-label">{{ t(U + 'headers') }}</span>
          <ToolButton @click="addHeader">
            <Plus :size="14" />
            <span>{{ t(U + 'add') }}</span>
          </ToolButton>
        </div>
        <div v-for="(h, i) in config.headers" :key="i" class="qt-row qt-row--center" style="--qt-row-gap:6px;flex-wrap:nowrap">
          <input class="qt-input" style="flex:0 0 40%;font-size:13px;padding:8px 10px" v-model="h.key" :placeholder="t(U + 'phHeaderName')" spellcheck="false" />
          <input class="qt-input" style="flex:1;font-size:13px;padding:8px 10px" v-model="h.value" :placeholder="t(U + 'phHeaderValue')" spellcheck="false" />
          <button type="button" class="qt-btn qt-btn--ghost" style="padding:4px;color:var(--qt-muted)" @click="removeHeader(i)">
            <Trash2 :size="14" />
          </button>
        </div>
      </div>

      <ToolField
        v-model="config.body"
        :label="t(U + 'body')"
        as="textarea"
        mono
        :placeholder="t(U + 'phBody')"
        spellcheck="false"
        :rows="4"
      />

      <ToolButton variant="primary" :disabled="loading" @click="send">
        <Loader2 v-if="loading" :size="14" class="qt-spin" />
        <Send v-else :size="14" />
        <span>{{ loading ? t(U + 'sending') : t(U + 'send') }}</span>
      </ToolButton>
    </ToolInput>

    <ToolOutput :title="t(U + 'outTitle')" :hide-copy="!response">
      <ToolAlert v-if="error" kind="error">{{ error }}</ToolAlert>
      <template v-else-if="response">
        <div class="qt-row qt-row--center" style="--qt-row-gap:12px">
          <span class="qt-badge" :class="statusClass(response.status)" style="font-size:14px;padding:4px 10px">{{ response.status }} {{ response.statusText }}</span>
          <span class="qt-mono" style="font-size:13px;color:var(--qt-muted)">{{ response.timingMs }} ms</span>
        </div>
        <div class="qt-stack" style="--qt-stack-gap:4px">
          <span class="qt-label">{{ t(U + 'respHeaders') }}</span>
          <div v-for="(h, i) in response.headers" :key="i" class="qt-mono" style="font-size:13px;color:var(--qt-text)">{{ h.key }}: {{ h.value }}</div>
        </div>
        <div class="qt-stack" style="--qt-stack-gap:4px">
          <span class="qt-label">{{ t(U + 'respBody') }}</span>
          <pre class="qt-output" style="margin:0;font-size:13px">{{ response.body || t(U + 'emptyBody') }}</pre>
        </div>
      </template>
      <ToolAlert v-else kind="empty">{{ t(U + 'alertEmpty') }}</ToolAlert>
    </ToolOutput>
  </div>
</template>
