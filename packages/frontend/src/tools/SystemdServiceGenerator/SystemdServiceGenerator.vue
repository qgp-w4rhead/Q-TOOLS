<script setup lang="ts">
/**
 * SystemdServiceGenerator - form → .service unit file.
 */
import { useI18n } from 'vue-i18n';
import { RotateCcw } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import ToolField from '@/components/ToolField.vue';
import ToolButton from '@/components/ToolButton.vue';
import {
  useSystemdServiceGenerator,
  type SystemdType,
  type RestartPolicy,
} from './useSystemdServiceGenerator';

const {
  config,
  output,
  update,
  addEnvVar,
  removeEnvVar,
  reset,
} = useSystemdServiceGenerator();

const { t } = useI18n();
const U = 'tools.systemd-service-generator.ui.';

const TYPES: { value: SystemdType; label: string }[] = [
  { value: 'simple', label: 'simple' },
  { value: 'forking', label: 'forking' },
  { value: 'oneshot', label: 'oneshot' },
  { value: 'notify', label: 'notify' },
  { value: 'idle', label: 'idle' },
];

const RESTART_POLICIES: { value: RestartPolicy; label: string }[] = [
  { value: 'no', label: 'no' },
  { value: 'on-success', label: 'on-success' },
  { value: 'on-failure', label: 'on-failure' },
  { value: 'on-abnormal', label: 'on-abnormal' },
  { value: 'on-watchdog', label: 'on-watchdog' },
  { value: 'on-abort', label: 'on-abort' },
  { value: 'always', label: 'always' },
];
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
        <ToolField v-model="config.name" :label="t(U + 'nameLabel')" placeholder="myapp" grow />
        <ToolField v-model="config.description" :label="t(U + 'descLabel')" placeholder="My Application Service" grow />
      </div>

      <div class="qt-row" style="--qt-row-gap:10px">
        <label class="qt-field">
          <span class="qt-label">{{ t('common.type') }}</span>
          <select class="qt-input" :value="config.type" @change="update('type', ($event.target as HTMLSelectElement).value as SystemdType)">
            <option v-for="t in TYPES" :key="t.value" :value="t.value">{{ t.label }}</option>
          </select>
        </label>
        <label class="qt-field">
          <span class="qt-label">{{ t(U + 'restartLabel') }}</span>
          <select class="qt-input" :value="config.restart" @change="update('restart', ($event.target as HTMLSelectElement).value as RestartPolicy)">
            <option v-for="r in RESTART_POLICIES" :key="r.value" :value="r.value">{{ r.label }}</option>
          </select>
        </label>
        <ToolField
          :model-value="config.restartSec"
          :label="t(U + 'restartSecLabel')"
          type="number"
          min="0"
          @update:model-value="update('restartSec', Number($event))"
        />
      </div>

      <ToolField v-model="config.execStart" label="ExecStart" mono placeholder="/usr/bin/node /opt/myapp/server.js" />

      <div class="qt-row" style="--qt-row-gap:10px">
        <ToolField v-model="config.execStartPre" :label="t(U + 'execStartPreLabel')" mono grow />
        <ToolField v-model="config.execStartPost" :label="t(U + 'execStartPostLabel')" mono grow />
      </div>

      <ToolField v-model="config.execStop" :label="t(U + 'execStopLabel')" mono />

      <div class="qt-row" style="--qt-row-gap:10px">
        <ToolField v-model="config.user" :label="t(U + 'userLabel')" placeholder="node" />
        <ToolField v-model="config.group" :label="t(U + 'groupLabel')" placeholder="node" />
        <ToolField v-model="config.workingDirectory" :label="t(U + 'workDirLabel')" mono placeholder="/opt/myapp" grow />
      </div>

      <div class="qt-row" style="--qt-row-gap:10px">
        <ToolField v-model="config.after" :label="t(U + 'afterLabel')" placeholder="network.target" grow />
        <ToolField v-model="config.wants" :label="t(U + 'wantsLabel')" grow />
        <ToolField v-model="config.requires" :label="t(U + 'requiresLabel')" grow />
      </div>

      <div class="qt-row" style="--qt-row-gap:10px">
        <label class="qt-field">
          <span class="qt-label">KillMode</span>
          <select class="qt-input" :value="config.killMode" @change="update('killMode', ($event.target as HTMLSelectElement).value as 'control-group' | 'process' | 'mixed' | 'none')">
            <option value="control-group">control-group</option>
            <option value="process">process</option>
            <option value="mixed">mixed</option>
            <option value="none">none</option>
          </select>
        </label>
        <ToolField
          :model-value="config.timeoutStartSec"
          label="TimeoutStartSec"
          type="number"
          min="1"
          @update:model-value="update('timeoutStartSec', Number($event))"
        />
        <ToolField
          :model-value="config.timeoutStopSec"
          label="TimeoutStopSec"
          type="number"
          min="1"
          @update:model-value="update('timeoutStopSec', Number($event))"
        />
      </div>

      <div class="qt-row" style="--qt-row-gap:10px">
        <ToolField v-model="config.standardOutput" label="StandardOutput" grow />
        <ToolField v-model="config.standardError" label="StandardError" grow />
      </div>

      <ToolField v-model="config.environmentFile" :label="t(U + 'envFileLabel')" mono placeholder="/etc/myapp/env" />

      <div class="qt-stack" style="--qt-stack-gap:8px">
        <div class="qt-row qt-row--center qt-row--between">
          <span class="qt-label">{{ t(U + 'envVarsLabel') }}</span>
          <button type="button" class="qt-btn qt-btn--ghost" style="padding:4px 10px;font-size:12px" @click="addEnvVar">+ {{ t('common.add') }}</button>
        </div>
        <div v-for="(e, i) in config.environment" :key="i" class="qt-row qt-row--center" style="--qt-row-gap:8px;flex-wrap:nowrap">
          <ToolField v-model="e.key" mono placeholder="KEY" grow aria-label="Environment key" />
          <span style="font-size:14px;font-weight:700;color:var(--qt-muted)">=</span>
          <ToolField v-model="e.value" mono placeholder="value" grow aria-label="Environment value" />
          <button type="button" class="qt-btn qt-btn--ghost" style="flex-shrink:0;width:28px;height:28px;padding:0;color:var(--qt-danger);font-size:16px;line-height:1" @click="removeEnvVar(i)">×</button>
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
