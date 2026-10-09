<script setup lang="ts">
/**
 * WireGuardConfigBuilder - generate server and client WireGuard configs.
 */
import { useI18n } from 'vue-i18n';
import { RotateCcw } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import ToolField from '@/components/ToolField.vue';
import ToolButton from '@/components/ToolButton.vue';
import { useWireGuardConfigBuilder } from './useWireGuardConfigBuilder';

const {
  config, serverOutput, clientOutput,
  update, addPeer, removePeer, reset,
} = useWireGuardConfigBuilder();

const { t } = useI18n();
const U = 'tools.wireguard-config-builder.ui.';
</script>

<template>
  <div class="qt-tool">
    <ToolInput :title="t(U + 'inputTitle')" :description="t(U + 'desc')">
      <template #actions>
        <ToolButton @click="reset"><RotateCcw :size="14" /><span>{{ t('common.reset') }}</span></ToolButton>
      </template>

      <div style="font-size:13px;font-weight:700;color:var(--qt-text);padding-top:4px;border-top:1px solid var(--qt-border)">{{ t(U + 'secServer') }}</div>
      <ToolField v-model="config.serverPrivateKey" :label="t(U + 'serverKeyLabel')" mono />
      <div class="qt-row" style="--qt-row-gap:10px">
        <ToolField v-model="config.serverAddress" :label="t(U + 'serverAddrLabel')" mono />
        <ToolField
          :model-value="config.serverListenPort"
          :label="t(U + 'listenPortLabel')"
          type="number"
          @update:model-value="update('serverListenPort', Number($event))"
        />
        <ToolField v-model="config.serverDns" label="DNS" mono />
      </div>
      <ToolField v-model="config.serverPostUp" label="PostUp" mono />
      <ToolField v-model="config.serverPostDown" label="PostDown" mono />

      <div style="font-size:13px;font-weight:700;color:var(--qt-text);padding-top:4px;border-top:1px solid var(--qt-border)">{{ t(U + 'secClient') }}</div>
      <div class="qt-row" style="--qt-row-gap:10px">
        <ToolField v-model="config.clientPrivateKey" :label="t(U + 'clientKeyLabel')" mono />
        <ToolField v-model="config.clientAddress" :label="t(U + 'clientAddrLabel')" mono />
        <ToolField v-model="config.clientDns" :label="t(U + 'clientDnsLabel')" mono />
      </div>

      <div style="font-size:13px;font-weight:700;color:var(--qt-text);padding-top:4px;border-top:1px solid var(--qt-border)">{{ t(U + 'secPeers') }}</div>
      <div class="qt-stack" style="--qt-stack-gap:8px">
        <button type="button" class="qt-btn qt-btn--ghost" style="padding:4px 10px;font-size:12px;align-self:flex-start" @click="addPeer">+ {{ t(U + 'addPeer') }}</button>
        <div v-for="(p, i) in config.peers" :key="i" class="qt-stack" style="--qt-stack-gap:6px">
          <ToolField v-model="p.name" :placeholder="t(U + 'phName')" aria-label="Peer name" />
          <ToolField v-model="p.publicKey" mono :placeholder="t(U + 'phPubKey')" aria-label="Peer public key" />
          <div class="qt-row" style="--qt-row-gap:10px">
            <ToolField v-model="p.allowedIps" mono placeholder="AllowedIPs" grow aria-label="Peer allowed IPs" />
            <ToolField v-model="p.endpoint" mono :placeholder="t(U + 'phEndpoint')" grow aria-label="Peer endpoint" />
            <ToolField v-model="p.presharedKey" mono :placeholder="t(U + 'phPsk')" grow aria-label="Peer preshared key" />
            <button type="button" class="qt-btn qt-btn--ghost" style="flex-shrink:0;width:28px;height:28px;padding:0;color:var(--qt-danger);font-size:16px;line-height:1;align-self:center" @click="removePeer(i)">×</button>
          </div>
        </div>
      </div>
    </ToolInput>

    <ToolOutput :title="t(U + 'outServerTitle')" :copy-text="serverOutput" :copy-label="t(U + 'copyServer')">
      <pre class="qt-output" style="margin:0;max-height:60vh"><code>{{ serverOutput }}</code></pre>
    </ToolOutput>
    <ToolOutput :title="t(U + 'outClientTitle')" :copy-text="clientOutput" :copy-label="t(U + 'copyClient')">
      <pre class="qt-output" style="margin:0;max-height:60vh"><code>{{ clientOutput }}</code></pre>
    </ToolOutput>
  </div>
</template>
