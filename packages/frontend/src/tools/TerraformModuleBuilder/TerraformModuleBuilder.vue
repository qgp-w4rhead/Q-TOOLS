<script setup lang="ts">
/**
 * TerraformModuleBuilder - generate module scaffolding.
 */
import { useI18n } from 'vue-i18n';
import { RotateCcw } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import ToolField from '@/components/ToolField.vue';
import ToolButton from '@/components/ToolButton.vue';
import {
  useTerraformModuleBuilder,
  type VariableType,
} from './useTerraformModuleBuilder';

const {
  config,
  output,
  addVariable,
  removeVariable,
  updateVariable,
  addOutput,
  removeOutput,
  reset,
} = useTerraformModuleBuilder();

const { t } = useI18n();
const U = 'tools.terraform-module-builder.ui.';

const VAR_TYPES: VariableType[] = ['string', 'number', 'bool', 'list(string)', 'map(string)', 'object'];
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

      <div class="qt-row" style="--qt-row-gap:10px">
        <ToolField v-model="config.moduleName" :label="t(U + 'moduleNameLabel')" grow />
        <ToolField v-model="config.provider" :label="t(U + 'providerLabel')" grow />
      </div>

      <div class="qt-stack" style="--qt-stack-gap:8px">
        <div class="qt-row qt-row--center qt-row--between">
          <span class="qt-label">{{ t(U + 'variablesLabel') }}</span>
          <button type="button" class="qt-btn qt-btn--ghost" style="padding:4px 10px;font-size:12px" @click="addVariable">+ {{ t('common.add') }}</button>
        </div>
        <div v-for="(v, i) in config.variables" :key="i" class="qt-row qt-row--center" style="--qt-row-gap:6px">
          <ToolField v-model="v.name" mono :placeholder="t(U + 'phName')" aria-label="Variable name" />
          <select class="qt-input" style="width:auto" :value="v.type" @change="updateVariable(i, 'type', ($event.target as HTMLSelectElement).value)">
            <option v-for="t in VAR_TYPES" :key="t" :value="t">{{ t }}</option>
          </select>
          <ToolField v-model="v.description" :placeholder="t(U + 'phDesc')" grow aria-label="Variable description" />
          <ToolField v-model="v.defaultValue" mono :placeholder="t(U + 'phDefault')" aria-label="Variable default" />
          <button type="button" class="qt-btn qt-btn--ghost" style="flex-shrink:0;width:28px;height:28px;padding:0;color:var(--qt-danger);font-size:16px;line-height:1" @click="removeVariable(i)">×</button>
        </div>
      </div>

      <div class="qt-stack" style="--qt-stack-gap:8px">
        <div class="qt-row qt-row--center qt-row--between">
          <span class="qt-label">{{ t(U + 'outputsLabel') }}</span>
          <button type="button" class="qt-btn qt-btn--ghost" style="padding:4px 10px;font-size:12px" @click="addOutput">+ {{ t('common.add') }}</button>
        </div>
        <div v-for="(o, i) in config.outputs" :key="i" class="qt-row qt-row--center" style="--qt-row-gap:6px">
          <ToolField v-model="o.name" mono :placeholder="t(U + 'phName')" aria-label="Output name" />
          <ToolField v-model="o.description" :placeholder="t(U + 'phDesc')" aria-label="Output description" />
          <ToolField v-model="o.value" mono :placeholder="t(U + 'phValueExpr')" grow aria-label="Output value" />
          <button type="button" class="qt-btn qt-btn--ghost" style="flex-shrink:0;width:28px;height:28px;padding:0;color:var(--qt-danger);font-size:16px;line-height:1" @click="removeOutput(i)">×</button>
        </div>
      </div>
    </ToolInput>

    <ToolOutput
      :title="t(U + 'outTitle')"
      :copy-text="output"
      :copy-label="t(U + 'copyLabel')"
    >
      <pre class="qt-output" style="margin:0;max-height:60vh"><code>{{ output }}</code></pre>
    </ToolOutput>
  </div>
</template>
