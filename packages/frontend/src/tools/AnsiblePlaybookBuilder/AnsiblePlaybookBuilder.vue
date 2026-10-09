<script setup lang="ts">
/**
 * AnsiblePlaybookBuilder - form → Ansible playbook YAML.
 */
import { useI18n } from 'vue-i18n';
import { RotateCcw } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import ToolField from '@/components/ToolField.vue';
import ToolButton from '@/components/ToolButton.vue';
import { useAnsiblePlaybookBuilder } from './useAnsiblePlaybookBuilder';

const {
  config, output, update,
  addVariable,
  removeVariable,
  addTask,
  removeTask,
  updateTask,
  addHandler,
  removeHandler,
  reset,
} = useAnsiblePlaybookBuilder();

const { t } = useI18n();
const U = 'tools.ansible-playbook-builder.ui.';
</script>

<template>
  <div class="qt-tool">
    <ToolInput :title="t(U + 'inputTitle')" :description="t(U + 'desc')">
      <template #actions>
        <ToolButton @click="reset"><RotateCcw :size="14" /><span>{{ t('common.reset') }}</span></ToolButton>
      </template>

      <div class="qt-row qt-row--bottom" style="--qt-row-gap:10px">
        <ToolField v-model="config.playbookName" :label="t(U + 'playbookNameLabel')" />
        <ToolField v-model="config.hosts" :label="t(U + 'hostsLabel')" />
        <ToolField v-model="config.remoteUser" :label="t(U + 'remoteUserLabel')" />
      </div>
      <div class="qt-row" style="--qt-row-gap:16px">
        <label class="qt-check"><input type="checkbox" :checked="config.become" @change="update('become', ($event.target as HTMLInputElement).checked)" /> <span>{{ t(U + 'becomeLabel') }}</span></label>
        <label class="qt-check"><input type="checkbox" :checked="config.gatherFacts" @change="update('gatherFacts', ($event.target as HTMLInputElement).checked)" /> <span>{{ t(U + 'gatherFactsLabel') }}</span></label>
      </div>

      <div class="qt-stack" style="--qt-stack-gap:8px">
        <div class="qt-row qt-row--center qt-row--between"><span class="qt-label">{{ t(U + 'variablesLabel') }}</span>
          <button type="button" class="qt-btn qt-btn--ghost" style="padding:4px 10px;font-size:12px" @click="addVariable">+ {{ t('common.add') }}</button></div>
        <div v-for="(v, i) in config.variables" :key="i" class="qt-row qt-row--center" style="--qt-row-gap:6px;flex-wrap:nowrap">
          <ToolField v-model="v.key" mono placeholder="key" aria-label="Variable key" />
          <span style="font-size:14px;font-weight:700;color:var(--qt-muted)">=</span>
          <ToolField v-model="v.value" mono placeholder="value" grow aria-label="Variable value" />
          <button type="button" class="qt-btn qt-btn--ghost" style="flex-shrink:0;width:28px;height:28px;padding:0;color:var(--qt-danger);font-size:16px;line-height:1" @click="removeVariable(i)">×</button>
        </div>
      </div>

      <div class="qt-stack" style="--qt-stack-gap:8px">
        <div class="qt-row qt-row--center qt-row--between"><span class="qt-label">{{ t(U + 'tasksLabel') }}</span>
          <button type="button" class="qt-btn qt-btn--ghost" style="padding:4px 10px;font-size:12px" @click="addTask">+ {{ t('common.add') }}</button></div>
        <div v-for="(task, i) in config.tasks" :key="i" class="qt-stack" style="--qt-stack-gap:6px">
          <ToolField v-model="task.name" :placeholder="t(U + 'phTaskName')" aria-label="Task name" />
          <div class="qt-row qt-row--center" style="--qt-row-gap:6px">
            <ToolField v-model="task.module" mono placeholder="module" aria-label="Task module" />
            <ToolField v-model="task.args" mono placeholder="args" grow aria-label="Task args" />
            <label class="qt-check"><input type="checkbox" :checked="task.become" @change="updateTask(i, 'become', ($event.target as HTMLInputElement).checked)" /> <span>become</span></label>
            <button type="button" class="qt-btn qt-btn--ghost" style="flex-shrink:0;width:28px;height:28px;padding:0;color:var(--qt-danger);font-size:16px;line-height:1" @click="removeTask(i)">×</button>
          </div>
        </div>
      </div>

      <div class="qt-stack" style="--qt-stack-gap:8px">
        <div class="qt-row qt-row--center qt-row--between"><span class="qt-label">{{ t(U + 'handlersLabel') }}</span>
          <button type="button" class="qt-btn qt-btn--ghost" style="padding:4px 10px;font-size:12px" @click="addHandler">+ {{ t('common.add') }}</button></div>
        <div v-for="(h, i) in config.handlers" :key="i" class="qt-row qt-row--center" style="--qt-row-gap:6px">
          <ToolField v-model="h.name" :placeholder="t(U + 'phHandlerName')" aria-label="Handler name" />
          <ToolField v-model="h.module" mono placeholder="module" aria-label="Handler module" />
          <ToolField v-model="h.args" mono placeholder="args" grow aria-label="Handler args" />
          <button type="button" class="qt-btn qt-btn--ghost" style="flex-shrink:0;width:28px;height:28px;padding:0;color:var(--qt-danger);font-size:16px;line-height:1" @click="removeHandler(i)">×</button>
        </div>
      </div>
    </ToolInput>

    <ToolOutput :title="t(U + 'outTitle')" :copy-text="output" :copy-label="t(U + 'copyLabel')">
      <pre class="qt-output" style="margin:0;max-height:60vh"><code>{{ output }}</code></pre>
    </ToolOutput>
  </div>
</template>
