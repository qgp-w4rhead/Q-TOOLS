<script setup lang="ts">
/**
 * ProxmoxLxcBuilder - form → LXC container config.
 */
import { useI18n } from 'vue-i18n';
import { RotateCcw } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import ToolField from '@/components/ToolField.vue';
import ToolButton from '@/components/ToolButton.vue';
import { useProxmoxLxcBuilder, type LxcArch } from './useProxmoxLxcBuilder';

const { config, output, update, reset } = useProxmoxLxcBuilder();

const { t } = useI18n();
const U = 'tools.proxmox-lxc-builder.ui.';

const ARCHES: LxcArch[] = ['amd64', 'arm64', 'armhf', 'i386'];
</script>

<template>
  <div class="qt-tool">
    <ToolInput :title="t(U + 'inputTitle')" :description="t(U + 'desc')">
      <template #actions>
        <ToolButton @click="reset"><RotateCcw :size="14" /><span>{{ t('common.reset') }}</span></ToolButton>
      </template>

      <div class="qt-row qt-row--bottom" style="--qt-row-gap:10px">
        <ToolField
          :model-value="config.ctId"
          :label="t(U + 'ctIdLabel')"
          type="number"
          min="1"
          @update:model-value="update('ctId', Number($event))"
        />
        <ToolField v-model="config.hostname" :label="t(U + 'hostnameLabel')" grow />
        <label class="qt-field qt-field--grow" style="min-width:100px"><span class="qt-label">{{ t(U + 'archLabel') }}</span>
          <select class="qt-input" :value="config.arch" @change="update('arch', ($event.target as HTMLSelectElement).value as LxcArch)">
            <option v-for="a in ARCHES" :key="a" :value="a">{{ a }}</option>
          </select></label>
      </div>
      <div class="qt-row qt-row--bottom" style="--qt-row-gap:10px">
        <ToolField
          :model-value="config.cores"
          :label="t(U + 'coresLabel')"
          type="number"
          min="1"
          @update:model-value="update('cores', Number($event))"
        />
        <ToolField
          :model-value="config.memory"
          :label="t(U + 'memoryLabel')"
          type="number"
          min="16"
          @update:model-value="update('memory', Number($event))"
        />
        <ToolField
          :model-value="config.swap"
          :label="t(U + 'swapLabel')"
          type="number"
          min="0"
          @update:model-value="update('swap', Number($event))"
        />
      </div>
      <div class="qt-row qt-row--bottom" style="--qt-row-gap:10px">
        <ToolField v-model="config.rootStorage" :label="t(U + 'rootStorageLabel')" />
        <ToolField v-model="config.rootSize" :label="t(U + 'rootSizeLabel')" />
        <ToolField v-model="config.osType" :label="t(U + 'osTypeLabel')" />
      </div>
      <div class="qt-row qt-row--bottom" style="--qt-row-gap:10px">
        <label class="qt-field qt-field--grow" style="min-width:100px"><span class="qt-label">{{ t(U + 'netTypeLabel') }}</span>
          <select class="qt-input" :value="config.netType" @change="update('netType', ($event.target as HTMLSelectElement).value as 'veth' | 'vlan')">
            <option value="veth">veth</option><option value="vlan">vlan</option>
          </select></label>
        <ToolField v-model="config.netBridge" :label="t(U + 'bridgeLabel')" />
        <ToolField v-model="config.netIp" :label="t(U + 'ipLabel')" mono />
        <ToolField v-model="config.netGateway" :label="t(U + 'gatewayLabel')" mono />
        <ToolField v-model="config.netDns" label="DNS" mono />
      </div>
      <div class="qt-row qt-row--bottom" style="--qt-row-gap:10px">
        <ToolField v-model="config.features" :label="t(U + 'featuresLabel')" grow />
        <label class="qt-check" style="padding-bottom:8px"><input type="checkbox" :checked="config.onboot" @change="update('onboot', ($event.target as HTMLInputElement).checked)" /> <span>{{ t(U + 'onbootLabel') }}</span></label>
        <label class="qt-check" style="padding-bottom:8px"><input type="checkbox" :checked="config.protection" @change="update('protection', ($event.target as HTMLInputElement).checked)" /> <span>{{ t(U + 'protectionLabel') }}</span></label>
        <label class="qt-check" style="padding-bottom:8px"><input type="checkbox" :checked="config.unprivileged" @change="update('unprivileged', ($event.target as HTMLInputElement).checked)" /> <span>{{ t(U + 'unprivilegedLabel') }}</span></label>
      </div>
    </ToolInput>

    <ToolOutput :title="t(U + 'outTitle')" :copy-text="output" :copy-label="t(U + 'copyLabel')">
      <pre class="qt-output" style="margin:0;max-height:60vh"><code>{{ output }}</code></pre>
    </ToolOutput>
  </div>
</template>
