<script setup lang="ts">
/**
 * MakefileGenerator - generate common Makefile targets.
 */
import { useI18n } from 'vue-i18n';
import { RotateCcw } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import ToolField from '@/components/ToolField.vue';
import ToolButton from '@/components/ToolButton.vue';
import { useMakefileGenerator } from './useMakefileGenerator';

const {
  config, output,
  addVariable, removeVariable,
  addTarget, removeTarget, updateTarget,
  reset,
} = useMakefileGenerator();

const { t } = useI18n();
const U = 'tools.makefile-generator.ui.';
</script>

<template>
  <div class="qt-tool">
    <ToolInput :title="t(U + 'inputTitle')" :description="t(U + 'desc')">
      <template #actions>
        <ToolButton @click="reset"><RotateCcw :size="14" /><span>{{ t('common.reset') }}</span></ToolButton>
      </template>

      <div class="qt-stack" style="--qt-stack-gap:8px">
        <div class="qt-row qt-row--center qt-row--between"><span class="qt-label">{{ t(U + 'variablesLabel') }}</span>
          <button type="button" class="qt-btn qt-btn--ghost" style="padding:4px 10px;font-size:12px" @click="addVariable">+ {{ t('common.add') }}</button></div>
        <div v-for="(v, i) in config.variables" :key="i" class="qt-row qt-row--center" style="--qt-row-gap:6px;flex-wrap:nowrap">
          <ToolField v-model="v.key" mono placeholder="VAR" aria-label="Variable name" />
          <span style="font-size:14px;font-weight:700;color:var(--qt-muted)">:=</span>
          <ToolField v-model="v.value" mono placeholder="value" grow aria-label="Variable value" />
          <button type="button" class="qt-btn qt-btn--ghost" style="flex-shrink:0;width:28px;height:28px;padding:0;color:var(--qt-danger);font-size:16px;line-height:1" @click="removeVariable(i)">×</button>
        </div>
      </div>

      <div class="qt-stack" style="--qt-stack-gap:8px">
        <div class="qt-row qt-row--center qt-row--between"><span class="qt-label">{{ t(U + 'targetsLabel') }}</span>
          <button type="button" class="qt-btn qt-btn--ghost" style="padding:4px 10px;font-size:12px" @click="addTarget">+ {{ t('common.add') }}</button></div>
        <div v-for="(tgt, i) in config.targets" :key="i" class="qt-stack" style="--qt-stack-gap:6px">
          <div class="qt-row qt-row--center" style="--qt-row-gap:6px">
            <ToolField v-model="tgt.name" mono :placeholder="t(U + 'phTargetName')" aria-label="Target name" />
            <ToolField v-model="tgt.dependsOn" mono :placeholder="t(U + 'phDepends')" grow aria-label="Target dependencies" />
            <label class="qt-check"><input type="checkbox" :checked="tgt.phony" @change="updateTarget(i, 'phony', ($event.target as HTMLInputElement).checked)" /> <span>.PHONY</span></label>
            <button type="button" class="qt-btn qt-btn--ghost" style="flex-shrink:0;width:28px;height:28px;padding:0;color:var(--qt-danger);font-size:16px;line-height:1" @click="removeTarget(i)">×</button>
          </div>
          <ToolField v-model="tgt.commands" as="textarea" :rows="2" mono :placeholder="t(U + 'phCommands')" aria-label="Target commands" />
        </div>
      </div>
    </ToolInput>

    <ToolOutput :title="t(U + 'outTitle')" :copy-text="output" :copy-label="t(U + 'copyLabel')">
      <pre class="qt-output" style="margin:0;max-height:60vh"><code>{{ output }}</code></pre>
    </ToolOutput>
  </div>
</template>
