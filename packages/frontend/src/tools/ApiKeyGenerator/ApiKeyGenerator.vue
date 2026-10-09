<script setup lang="ts">
/**
 * ApiKeyGenerator — generate API keys with configurable format and checksum.
 */
import { RotateCcw, KeyRound } from 'lucide-vue-next';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import ToolField from '@/components/ToolField.vue';
import ToolButton from '@/components/ToolButton.vue';
import {
  useApiKeyGenerator,
  type KeyFormat,
} from './useApiKeyGenerator';

const { config, keys, reset } = useApiKeyGenerator();

const { t } = useI18n();
const U = 'tools.api-key-generator.ui.';

const FORMATS: KeyFormat[] = ['hex', 'base64', 'base32', 'base62'];

const allKeys = computed(() => keys.value.join('\n'));
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

      <div class="qt-grid" style="--qt-grid-min:140px;--qt-grid-gap:10px">
        <ToolField v-model="config.prefix" :label="t(U + 'prefix')" :placeholder="t(U + 'phPrefix')" spellcheck="false" />
        <ToolField v-model.number="config.length" :label="t(U + 'length')" type="number" min="8" max="128" />
        <label class="qt-field">
          <span class="qt-label">{{ t(U + 'format') }}</span>
          <select class="qt-input" style="font-size:13px;padding:6px 10px" v-model="config.format">
            <option v-for="f in FORMATS" :key="f" :value="f">{{ f }}</option>
          </select>
        </label>
        <ToolField v-model.number="config.count" :label="t(U + 'count')" type="number" min="1" max="100" />
        <ToolField v-model="config.separator" :label="t(U + 'separator')" :placeholder="t(U + 'phSeparator')" maxlength="2" />
        <label class="qt-check" style="align-self:end;padding-bottom:8px">
          <input type="checkbox" v-model="config.includeChecksum" />
          <span>{{ t(U + 'checksum') }}</span>
        </label>
      </div>
    </ToolInput>

    <ToolOutput :title="t(U + 'outTitle')" :copy-text="allKeys">
      <div class="qt-stack" style="--qt-stack-gap:4px">
        <div v-for="(key, i) in keys" :key="i" class="qt-panel qt-row qt-row--center" style="--qt-row-gap:6px;flex-wrap:nowrap;padding:6px 10px">
          <KeyRound :size="14" style="color:var(--qt-muted);flex-shrink:0" />
          <code class="qt-mono" style="font-size:13px;color:var(--qt-text);word-break:break-all">{{ key }}</code>
        </div>
      </div>
    </ToolOutput>
  </div>
</template>
