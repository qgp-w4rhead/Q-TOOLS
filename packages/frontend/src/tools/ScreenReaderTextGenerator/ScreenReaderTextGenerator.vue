<script setup lang="ts">
/**
 * ScreenReaderTextGenerator - generate visually-hidden text and aria-live regions.
 *
 * Produce sr-only CSS/HTML for screen reader-only text, or aria-live region
 * markup for dynamic announcements.
 */
import { useI18n } from 'vue-i18n';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import ToolField from '@/components/ToolField.vue';
import {
  useScreenReaderTextGenerator,
} from './useScreenReaderTextGenerator';

const { config, cssCode, htmlCode } = useScreenReaderTextGenerator();

const { t } = useI18n();
const U = 'tools.screen-reader-text-generator.ui.';
</script>

<template>
  <div class="qt-tool">
    <ToolInput
      :title="t(U + 'inputTitle')"
      :description="t(U + 'desc')"
    >
      <div class="qt-row qt-row--bottom" style="--qt-row-gap:12px">
        <label class="qt-field qt-field--grow" style="min-width:160px">
          <span class="qt-label">{{ t(U + 'outputType') }}</span>
          <select class="qt-input" style="font-size:14px;padding:8px 12px" v-model="config.type">
            <option value="sr-only">{{ t(U + 'typeSrOnly') }}</option>
            <option value="aria-live">{{ t(U + 'typeAriaLive') }}</option>
          </select>
        </label>
        <label v-if="config.type === 'aria-live'" class="qt-field qt-field--grow" style="min-width:160px">
          <span class="qt-label">{{ t(U + 'politeness') }}</span>
          <select class="qt-input" style="font-size:14px;padding:8px 12px" v-model="config.politeness">
            <option value="off">off</option>
            <option value="polite">polite</option>
            <option value="assertive">assertive</option>
          </select>
        </label>
      </div>

      <ToolField
        v-model="config.text"
        :label="t(U + 'textContent')"
        as="textarea"
        :rows="3"
        :placeholder="t(U + 'phText')"
      />

      <div v-if="config.type === 'aria-live'" class="qt-row qt-row--bottom" style="--qt-row-gap:12px">
        <label class="qt-check" style="font-size:13px;padding-bottom:8px">
          <input type="checkbox" v-model="config.atomic" />
          <span>{{ t(U + 'ariaAtomic') }}</span>
        </label>
        <label class="qt-field qt-field--grow" style="min-width:160px">
          <span class="qt-label">{{ t(U + 'ariaRelevant') }}</span>
          <select class="qt-input" style="font-size:14px;padding:8px 12px" v-model="config.relevant">
            <option value="additions text">additions text</option>
            <option value="additions">additions</option>
            <option value="text">text</option>
            <option value="removals">removals</option>
            <option value="all">all</option>
          </select>
        </label>
      </div>
    </ToolInput>

    <ToolOutput
      :title="t(U + 'outputHtml')"
      :copy-text="htmlCode"
      :copy-label="t(U + 'copyHtml')"
    >
      <pre class="qt-panel qt-mono" style="margin:0;padding:14px;font-size:13px;line-height:1.5;white-space:pre-wrap;overflow-x:auto">{{ htmlCode || t(U + 'emptyHtml') }}</pre>
    </ToolOutput>

    <ToolOutput
      :title="t(U + 'outputCss')"
      :copy-text="cssCode"
      :copy-label="t(U + 'copyCss')"
    >
      <pre class="qt-panel qt-mono" style="margin:0;padding:14px;font-size:13px;line-height:1.5;white-space:pre-wrap;overflow-x:auto">{{ cssCode }}</pre>
    </ToolOutput>
  </div>
</template>
