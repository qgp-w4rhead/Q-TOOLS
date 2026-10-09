<script setup lang="ts">
/**
 * PortForwardingBuilder - generate iptables/nftables/SSH port-forwarding commands.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { RotateCcw } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import ToolField from '@/components/ToolField.vue';
import ToolButton from '@/components/ToolButton.vue';
import {
  usePortForwardingBuilder,
  type ForwardMethod,
} from './usePortForwardingBuilder';

const {
  config,
  output,
  update,
  reset,
} = usePortForwardingBuilder();

const { t } = useI18n();
const U = 'tools.port-forwarding-builder.ui.';

const METHODS = computed<{ value: ForwardMethod; label: string }[]>(() => [
  { value: 'iptables', label: 'iptables' },
  { value: 'nftables', label: 'nftables' },
  { value: 'ssh', label: t(U + 'methodSsh') },
]);
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

      <label class="qt-field">
        <span class="qt-label">{{ t(U + 'methodLabel') }}</span>
        <select class="qt-input" :value="config.method" @change="update('method', ($event.target as HTMLSelectElement).value as ForwardMethod)">
          <option v-for="m in METHODS" :key="m.value" :value="m.value">{{ m.label }}</option>
        </select>
      </label>

      <div class="qt-row" style="--qt-row-gap:10px">
        <ToolField
          :model-value="config.localPort"
          :label="t(U + 'localPortLabel')"
          type="number"
          min="1"
          max="65535"
          @update:model-value="update('localPort', Number($event))"
        />
        <ToolField
          :model-value="config.remotePort"
          :label="t(U + 'remotePortLabel')"
          type="number"
          min="1"
          max="65535"
          @update:model-value="update('remotePort', Number($event))"
        />
      </div>

      <template v-if="config.method === 'iptables' || config.method === 'nftables'">
        <div class="qt-row" style="--qt-row-gap:10px">
          <ToolField v-model="config.localInterface" :label="t(U + 'ifaceLabel')" placeholder="eth0" />
          <ToolField v-model="config.remoteHost" :label="t(U + 'remoteHostLabel')" mono placeholder="127.0.0.1" grow />
        </div>
      </template>

      <template v-if="config.method === 'ssh'">
        <div class="qt-row" style="--qt-row-gap:10px">
          <ToolField v-model="config.sshUser" :label="t(U + 'sshUserLabel')" placeholder="user" />
          <ToolField v-model="config.sshHost" :label="t(U + 'sshHostLabel')" placeholder="remote.example.com" grow />
        </div>
        <div class="qt-row" style="--qt-row-gap:10px">
          <ToolField v-model="config.bindAddress" :label="t(U + 'bindAddrLabel')" placeholder="0.0.0.0" grow />
          <ToolField v-model="config.remoteHost" :label="t(U + 'remoteHostLabel')" mono placeholder="127.0.0.1" />
        </div>
        <label class="qt-check">
          <input type="checkbox" :checked="config.reverse" @change="update('reverse', ($event.target as HTMLInputElement).checked)" />
          <span>{{ t(U + 'reverseLabel') }}</span>
        </label>
      </template>
    </ToolInput>

    <ToolOutput
      :title="t(U + 'outTitle')"
      :copy-text="output"
      :copy-label="t('common.copy')"
    >
      <pre class="qt-output" style="margin:0;max-height:60vh"><code>{{ output }}</code></pre>
    </ToolOutput>
  </div>
</template>
