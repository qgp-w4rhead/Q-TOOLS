<script setup lang="ts">
/**
 * AltTextBuilder - template-based alt text generator for images.
 *
 * Combine subject, action, emotion, and context into descriptive alt text
 * following WCAG guidelines.
 */
import { useI18n } from 'vue-i18n';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import ToolField from '@/components/ToolField.vue';
import {
  useAltTextBuilder,
} from './useAltTextBuilder';

const { config, altText, altAttribute } = useAltTextBuilder();

const { t } = useI18n();
const U = 'tools.alt-text-builder.ui.';
</script>

<template>
  <div class="qt-tool">
    <ToolInput
      :title="t(U + 'inputTitle')"
      :description="t(U + 'desc')"
    >
      <div class="qt-row qt-row--bottom" style="--qt-row-gap:12px">
        <ToolField
          v-model="config.subject"
          :label="t(U + 'subject')"
          :placeholder="t(U + 'phSubject')"
          grow
        />
        <ToolField
          v-model="config.action"
          :label="t(U + 'action')"
          :placeholder="t(U + 'phAction')"
          grow
        />
      </div>

      <div class="qt-row qt-row--bottom" style="--qt-row-gap:12px">
        <ToolField
          v-model="config.emotion"
          :label="t(U + 'emotion')"
          :placeholder="t(U + 'phEmotion')"
          grow
        />
        <ToolField
          v-model="config.context"
          :label="t(U + 'context')"
          :placeholder="t(U + 'phContext')"
          grow
        />
      </div>

      <div class="qt-row qt-row--bottom" style="--qt-row-gap:12px">
        <label class="qt-field">
          <span class="qt-label">{{ t(U + 'format') }}</span>
          <select class="qt-input" style="font-size:14px;padding:8px 12px" v-model="config.format">
            <option value="sentence">{{ t(U + 'fmtSentence') }}</option>
            <option value="descriptive">{{ t(U + 'fmtDescriptive') }}</option>
            <option value="minimal">{{ t(U + 'fmtMinimal') }}</option>
          </select>
        </label>
        <label class="qt-check" style="font-size:13px;padding-bottom:8px" v-if="config.format !== 'minimal'">
          <input type="checkbox" v-model="config.includeContext" />
          <span>{{ t(U + 'includeContext') }}</span>
        </label>
      </div>
    </ToolInput>

    <ToolOutput
      :title="t(U + 'outputTitle')"
      :copy-text="altText"
      :copy-label="t(U + 'copyText')"
    >
      <p style="margin:0;font-size:15px;line-height:1.5;color:var(--qt-text)">{{ altText || t(U + 'emptyText') }}</p>
    </ToolOutput>

    <ToolOutput
      v-if="altAttribute"
      :title="t(U + 'outputTitle2')"
      :copy-text="altAttribute"
      :copy-label="t(U + 'copyAttr')"
    >
      <pre class="qt-panel qt-mono" style="margin:0;padding:14px;font-size:13px">{{ altAttribute }}</pre>
    </ToolOutput>
  </div>
</template>
