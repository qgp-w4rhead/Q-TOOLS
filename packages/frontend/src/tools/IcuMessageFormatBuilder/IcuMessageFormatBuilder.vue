<script setup lang="ts">
/**
 * IcuMessageFormatBuilder - build and preview ICU MessageFormat strings.
 *
 * Enter an ICU MessageFormat template, set variables, and see the rendered
 * output live. Supports plural, select, number, and date arguments.
 *
 * Works in embed mode: receives `input` PostMessages to set the message,
 * locale, and variables, and sends `output` PostMessages with the rendered
 * result.
 */
import { RotateCcw, Plus, Trash2 } from 'lucide-vue-next';
import { useI18n } from 'vue-i18n';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import ToolField from '@/components/ToolField.vue';
import ToolButton from '@/components/ToolButton.vue';
import ToolAlert from '@/components/ToolAlert.vue';
import {
  useIcuMessageFormatBuilder,
} from './useIcuMessageFormatBuilder';

const {
  message,
  locale,
  variables,
  result,
  reset,
  addVariable,
  removeVariable,
} = useIcuMessageFormatBuilder();

const { t } = useI18n();
const U = 'tools.icu-message-format-builder.ui.';

const COMMON_LOCALES = [
  'en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'ja', 'zh', 'ko', 'ar', 'he', 'hi', 'tr', 'nl', 'pl', 'sv',
];
</script>

<template>
  <div class="qt-tool">
    <ToolInput
      :title="t(U + 'inputTitle')"
      :description="t(U + 'desc')"
    >
      <template #actions>
        <ToolButton :title="t(U + 'resetTitle')" @click="reset">
          <RotateCcw :size="14" />
          <span>{{ t('common.reset') }}</span>
        </ToolButton>
      </template>

      <ToolField
        v-model="message"
        :label="t(U + 'messageTemplate')"
        as="textarea"
        mono
        :rows="5"
        spellcheck="false"
        :placeholder="t(U + 'placeholder')"
      />

      <label class="qt-row qt-row--center" style="--qt-row-gap:8px;flex-wrap:nowrap">
        <span class="qt-label">{{ t(U + 'locale') }}</span>
        <select v-model="locale" class="qt-input" style="width:auto;font-size:13px;padding:6px 10px">
          <option v-for="l in COMMON_LOCALES" :key="l" :value="l">{{ l }}</option>
        </select>
      </label>

      <div class="qt-stack" style="--qt-stack-gap:8px">
        <div class="qt-row qt-row--center qt-row--between">
          <span class="qt-label">{{ t(U + 'variables') }}</span>
          <ToolButton @click="addVariable">
            <Plus :size="14" />
            <span>{{ t(U + 'add') }}</span>
          </ToolButton>
        </div>
        <div v-for="(v, i) in variables" :key="i" class="qt-row qt-row--center" style="--qt-row-gap:8px;flex-wrap:nowrap">
          <input
            v-model="v.name"
            class="qt-input"
            style="flex:1;font-size:13px;padding:6px 10px"
            type="text"
            :placeholder="t(U + 'phName')"
          />
          <input
            v-model="v.value"
            class="qt-input"
            style="flex:1;font-size:13px;padding:6px 10px"
            type="text"
            :placeholder="t(U + 'phValue')"
          />
          <button
            type="button"
            class="qt-btn qt-btn--ghost"
            style="padding:4px;color:var(--qt-muted)"
            :title="t(U + 'removeVar')"
            @click="removeVariable(i)"
          >
            <Trash2 :size="14" />
          </button>
        </div>
      </div>
    </ToolInput>

    <ToolOutput
      :title="t(U + 'outputTitle')"
      :description="t(U + 'descOut')"
      :copy-text="result.output"
    >
      <ToolAlert v-if="result.error" kind="error">{{ result.error }}</ToolAlert>
      <div v-else class="qt-panel" style="font-size:15px;line-height:1.5;padding:12px;white-space:pre-wrap;word-break:break-word">{{ result.output }}</div>
    </ToolOutput>

    <ToolOutput
      v-if="result.parsedAst"
      :title="t(U + 'astTitle')"
      :description="t(U + 'astDesc')"
      :copy-text="result.parsedAst"
      :copy-label="t(U + 'copyAst')"
    >
      <pre class="qt-output" style="margin:0;font-size:12px;padding:12px">{{ result.parsedAst }}</pre>
    </ToolOutput>
  </div>
</template>
