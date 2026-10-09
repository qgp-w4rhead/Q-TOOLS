<script setup lang="ts">
/**
 * ProxmoxCloudInitBuilder - generate cloud-init user-data and network-config.
 */
import { useI18n } from 'vue-i18n';
import { RotateCcw } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import ToolField from '@/components/ToolField.vue';
import ToolButton from '@/components/ToolButton.vue';
import { useProxmoxCloudInitBuilder } from './useProxmoxCloudInitBuilder';

const { config, output, reset } = useProxmoxCloudInitBuilder();

const { t } = useI18n();
const U = 'tools.proxmox-cloud-init-builder.ui.';
</script>

<template>
  <div class="qt-tool">
    <ToolInput :title="t(U + 'inputTitle')" :description="t(U + 'desc')">
      <template #actions>
        <ToolButton @click="reset"><RotateCcw :size="14" /><span>{{ t('common.reset') }}</span></ToolButton>
      </template>

      <div class="qt-row" style="--qt-row-gap:10px">
        <ToolField v-model="config.hostname" :label="t(U + 'hostnameLabel')" />
        <ToolField v-model="config.fqdn" label="FQDN" grow />
      </div>
      <div class="qt-row" style="--qt-row-gap:10px">
        <ToolField v-model="config.user" :label="t(U + 'userLabel')" />
        <ToolField v-model="config.password" :label="t(U + 'passwordLabel')" placeholder="$6$..." />
        <ToolField v-model="config.timezone" :label="t(U + 'timezoneLabel')" />
      </div>
      <ToolField v-model="config.sshKey" :label="t(U + 'sshKeyLabel')" mono />
      <div class="qt-row" style="--qt-row-gap:10px">
        <ToolField v-model="config.ip" :label="t(U + 'ipLabel')" mono />
        <ToolField v-model="config.gateway" :label="t(U + 'gatewayLabel')" mono />
        <ToolField v-model="config.dns" label="DNS" mono />
        <ToolField v-model="config.searchDomain" :label="t(U + 'searchDomainLabel')" />
      </div>
      <ToolField v-model="config.packages" as="textarea" :label="t(U + 'packagesLabel')" :rows="4" />
      <ToolField v-model="config.runcmd" as="textarea" :label="t(U + 'runcmdLabel')" :rows="4" />
      <ToolField v-model="config.writeFiles" as="textarea" :label="t(U + 'writeFilesLabel')" placeholder="write_files:..." :rows="4" />
    </ToolInput>

    <ToolOutput :title="t(U + 'outTitle')" :copy-text="output" :copy-label="t(U + 'copyLabel')">
      <pre class="qt-output" style="margin:0;max-height:60vh"><code>{{ output }}</code></pre>
    </ToolOutput>
  </div>
</template>
