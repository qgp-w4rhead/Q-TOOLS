<script setup lang="ts">
/**
 * TerraformImportBuilder - generate terraform import commands.
 */
import { useI18n } from 'vue-i18n';
import { RotateCcw } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import ToolField from '@/components/ToolField.vue';
import ToolButton from '@/components/ToolButton.vue';
import { useTerraformImportBuilder } from './useTerraformImportBuilder';

const {
  config,
  output,
  addEntry,
  removeEntry,
  reset,
} = useTerraformImportBuilder();

const { t } = useI18n();
const U = 'tools.terraform-import-builder.ui.';
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

      <ToolField v-model="config.workspace" :label="t(U + 'workspaceLabel')" placeholder="default" />

      <div class="qt-stack" style="--qt-stack-gap:8px">
        <div class="qt-row qt-row--center qt-row--between">
          <span class="qt-label">{{ t(U + 'resourcesLabel') }}</span>
          <button type="button" class="qt-btn qt-btn--ghost" style="padding:4px 10px;font-size:12px" @click="addEntry">+ {{ t('common.add') }}</button>
        </div>
        <div v-for="(e, i) in config.entries" :key="i" class="qt-row qt-row--center" style="--qt-row-gap:8px;flex-wrap:nowrap">
          <ToolField v-model="e.address" mono placeholder="aws_instance.web" grow aria-label="Resource address" />
          <ToolField v-model="e.id" mono placeholder="i-0123456789abcdef0" grow aria-label="Resource ID" />
          <button type="button" class="qt-btn qt-btn--ghost" style="flex-shrink:0;width:28px;height:28px;padding:0;color:var(--qt-danger);font-size:16px;line-height:1" @click="removeEntry(i)">×</button>
        </div>
      </div>
    </ToolInput>

    <ToolOutput :title="t(U + 'outTitle')" :copy-text="output" :copy-label="t(U + 'copyLabel')">
      <pre class="qt-output" style="margin:0;max-height:60vh"><code>{{ output }}</code></pre>
    </ToolOutput>
  </div>
</template>
