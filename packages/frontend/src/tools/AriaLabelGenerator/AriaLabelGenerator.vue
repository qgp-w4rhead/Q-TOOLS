<script setup lang="ts">
/**
 * AriaLabelGenerator - generate ARIA attributes from form inputs.
 *
 * Configure element tag, role, label, labelledby, and describedby to
 * produce ready-to-paste HTML with proper ARIA wiring.
 */
import { useI18n } from 'vue-i18n';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import ToolField from '@/components/ToolField.vue';
import {
  useAriaLabelGenerator,
  ELEMENT_TAGS,
  ARIA_ROLES,
} from './useAriaLabelGenerator';

const { config, output } = useAriaLabelGenerator();

const { t } = useI18n();
const U = 'tools.aria-label-generator.ui.';

const roleOptions = Object.values(ARIA_ROLES).sort();
</script>

<template>
  <div class="qt-tool">
    <ToolInput
      :title="t(U + 'inputTitle')"
      :description="t(U + 'desc')"
    >
      <div class="qt-row" style="--qt-row-gap:12px">
        <label class="qt-field qt-field--grow" style="min-width:180px">
          <span class="qt-label">{{ t(U + 'elementTag') }}</span>
          <select class="qt-input" style="font-size:14px;padding:8px 12px" v-model="config.elementTag">
            <option v-for="tag in ELEMENT_TAGS" :key="tag" :value="tag">{{ tag }}</option>
          </select>
        </label>
        <label class="qt-field qt-field--grow" style="min-width:180px">
          <span class="qt-label">{{ t(U + 'role') }}</span>
          <select class="qt-input" style="font-size:14px;padding:8px 12px" v-model="config.role">
            <option v-for="r in roleOptions" :key="r" :value="r">{{ r }}</option>
          </select>
        </label>
      </div>

      <div class="qt-row" style="--qt-row-gap:12px">
        <label class="qt-check" style="font-size:13px">
          <input type="checkbox" v-model="config.useRole" />
          <span>{{ t(U + 'includeRole') }}</span>
        </label>
        <label class="qt-check" style="font-size:13px">
          <input type="checkbox" v-model="config.useLabel" />
          <span>aria-label</span>
        </label>
        <label class="qt-check" style="font-size:13px">
          <input type="checkbox" v-model="config.useLabelledby" />
          <span>aria-labelledby</span>
        </label>
        <label class="qt-check" style="font-size:13px">
          <input type="checkbox" v-model="config.useDescribedby" />
          <span>aria-describedby</span>
        </label>
      </div>

      <ToolField
        v-if="config.useLabel"
        v-model="config.label"
        :label="t(U + 'labelText')"
        :placeholder="t(U + 'phLabel')"
      />

      <ToolField
        v-if="config.useLabelledby"
        v-model="config.labelledbyId"
        :label="t(U + 'labelledbyId')"
        :placeholder="t(U + 'phLabelledby')"
      />

      <div v-if="config.useDescribedby" class="qt-stack" style="--qt-stack-gap:6px">
        <ToolField
          v-model="config.describedbyId"
          :label="t(U + 'describedbyId')"
          :placeholder="t(U + 'phDescribedby')"
        />
        <ToolField
          v-model="config.description"
          :label="t(U + 'descText')"
          :placeholder="t(U + 'phDesc')"
        />
      </div>
    </ToolInput>

    <ToolOutput
      :title="t(U + 'outputTitle')"
      :copy-text="output"
      :copy-label="t(U + 'copyHtml')"
    >
      <pre class="qt-panel qt-mono" style="margin:0;padding:14px;font-size:13px;line-height:1.5;overflow-x:auto;white-space:pre-wrap">{{ output }}</pre>
    </ToolOutput>
  </div>
</template>
