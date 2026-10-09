<script setup lang="ts">
/**
 * ProxmoxVmBuilder - form → QEMU VM config.
 */
import { useI18n } from 'vue-i18n';
import { RotateCcw } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import ToolField from '@/components/ToolField.vue';
import ToolButton from '@/components/ToolButton.vue';
import {
  useProxmoxVmBuilder,
  type ScsiController,
  type NetModel,
} from './useProxmoxVmBuilder';

const { config, output, update, reset } = useProxmoxVmBuilder();

const { t } = useI18n();
const U = 'tools.proxmox-vm-builder.ui.';

const SCSI_CONTROLLERS: ScsiController[] = ['lsi', 'virtio-scsi-pci', 'virtio-scsi-single', 'megasas', 'pvscsi'];
const NET_MODELS: NetModel[] = ['virtio', 'e1000', 'rtl8139', 'vmxnet3'];
</script>

<template>
  <div class="qt-tool">
    <ToolInput :title="t(U + 'inputTitle')" :description="t(U + 'desc')">
      <template #actions>
        <ToolButton @click="reset"><RotateCcw :size="14" /><span>{{ t('common.reset') }}</span></ToolButton>
      </template>

      <div class="qt-row qt-row--bottom" style="--qt-row-gap:10px">
        <ToolField
          :model-value="config.vmId"
          :label="t(U + 'vmIdLabel')"
          type="number"
          min="1"
          @update:model-value="update('vmId', Number($event))"
        />
        <ToolField v-model="config.name" :label="t('common.name')" grow />
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
          :model-value="config.sockets"
          :label="t(U + 'socketsLabel')"
          type="number"
          min="1"
          @update:model-value="update('sockets', Number($event))"
        />
      </div>
      <div class="qt-row qt-row--bottom" style="--qt-row-gap:10px">
        <ToolField v-model="config.cpuType" :label="t(U + 'cpuTypeLabel')" />
        <label class="qt-field qt-field--grow" style="min-width:100px"><span class="qt-label">BIOS</span>
          <select class="qt-input" :value="config.bios" @change="update('bios', ($event.target as HTMLSelectElement).value as 'seabios' | 'ovmf')">
            <option value="seabios">seabios</option><option value="ovmf">ovmf</option>
          </select></label>
        <ToolField v-model="config.bootOrder" :label="t(U + 'bootOrderLabel')" />
      </div>
      <div class="qt-row qt-row--bottom" style="--qt-row-gap:10px">
        <label class="qt-field qt-field--grow" style="min-width:100px"><span class="qt-label">{{ t(U + 'scsiLabel') }}</span>
          <select class="qt-input" :value="config.scsihw" @change="update('scsihw', ($event.target as HTMLSelectElement).value as ScsiController)">
            <option v-for="s in SCSI_CONTROLLERS" :key="s" :value="s">{{ s }}</option>
          </select></label>
        <ToolField v-model="config.diskStorage" :label="t(U + 'diskStorageLabel')" />
        <ToolField
          :model-value="config.diskSize"
          :label="t(U + 'diskSizeLabel')"
          type="number"
          min="1"
          @update:model-value="update('diskSize', Number($event))"
        />
        <label class="qt-field qt-field--grow" style="min-width:100px"><span class="qt-label">{{ t(U + 'diskFormatLabel') }}</span>
          <select class="qt-input" :value="config.diskFormat" @change="update('diskFormat', ($event.target as HTMLSelectElement).value as 'raw' | 'qcow2' | 'vmdk')">
            <option value="raw">raw</option><option value="qcow2">qcow2</option><option value="vmdk">vmdk</option>
          </select></label>
      </div>
      <div class="qt-row qt-row--bottom" style="--qt-row-gap:10px">
        <label class="qt-field qt-field--grow" style="min-width:100px"><span class="qt-label">{{ t(U + 'netModelLabel') }}</span>
          <select class="qt-input" :value="config.netModel" @change="update('netModel', ($event.target as HTMLSelectElement).value as NetModel)">
            <option v-for="m in NET_MODELS" :key="m" :value="m">{{ m }}</option>
          </select></label>
        <ToolField v-model="config.netBridge" :label="t(U + 'netBridgeLabel')" />
        <ToolField v-model="config.netVlan" :label="t(U + 'vlanLabel')" />
      </div>
      <div class="qt-row qt-row--bottom" style="--qt-row-gap:10px">
        <ToolField v-model="config.osType" :label="t(U + 'osTypeLabel')" />
        <label class="qt-check" style="padding-bottom:8px"><input type="checkbox" :checked="config.onboot" @change="update('onboot', ($event.target as HTMLInputElement).checked)" /> <span>{{ t(U + 'onbootLabel') }}</span></label>
        <label class="qt-check" style="padding-bottom:8px"><input type="checkbox" :checked="config.protection" @change="update('protection', ($event.target as HTMLInputElement).checked)" /> <span>{{ t(U + 'protectionLabel') }}</span></label>
        <label class="qt-check" style="padding-bottom:8px"><input type="checkbox" :checked="config.agent" @change="update('agent', ($event.target as HTMLInputElement).checked)" /> <span>{{ t(U + 'agentLabel') }}</span></label>
      </div>
    </ToolInput>

    <ToolOutput :title="t(U + 'outTitle')" :copy-text="output" :copy-label="t(U + 'copyLabel')">
      <pre class="qt-output" style="margin:0;max-height:60vh"><code>{{ output }}</code></pre>
    </ToolOutput>
  </div>
</template>
