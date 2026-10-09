<script setup lang="ts">
/**
 * HaProxyConfigBuilder - form → HAProxy config.
 */
import { useI18n } from 'vue-i18n';
import { RotateCcw } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import ToolField from '@/components/ToolField.vue';
import ToolButton from '@/components/ToolButton.vue';
import { useHaProxyConfigBuilder, type BalanceAlgorithm } from './useHaProxyConfigBuilder';

const { config, output, update, addBackend, removeBackend, updateBackend, reset } = useHaProxyConfigBuilder();

const { t } = useI18n();
const U = 'tools.haproxy-config-builder.ui.';

const BALANCE_ALGOS: BalanceAlgorithm[] = ['roundrobin', 'leastconn', 'static-rr', 'source'];
</script>

<template>
  <div class="qt-tool">
    <ToolInput :title="t(U + 'inputTitle')" :description="t(U + 'desc')">
      <template #actions>
        <ToolButton @click="reset"><RotateCcw :size="14" /><span>{{ t('common.reset') }}</span></ToolButton>
      </template>

      <div style="font-size:13px;font-weight:700;color:var(--qt-text);padding-top:4px;border-top:1px solid var(--qt-border)">{{ t(U + 'secFrontend') }}</div>
      <div class="qt-row qt-row--bottom" style="--qt-row-gap:10px">
        <ToolField v-model="config.frontendName" :label="t(U + 'frontendNameLabel')" />
        <ToolField v-model="config.frontendBind" :label="t(U + 'bindAddrLabel')" />
        <ToolField
          :model-value="config.frontendPort"
          :label="t(U + 'portLabel')"
          type="number"
          @update:model-value="update('frontendPort', Number($event))"
        />
        <ToolField v-model="config.sslCert" :label="t(U + 'sslCertLabel')" mono />
      </div>

      <div style="font-size:13px;font-weight:700;color:var(--qt-text);padding-top:4px;border-top:1px solid var(--qt-border)">{{ t(U + 'secStats') }}</div>
      <div class="qt-row qt-row--bottom" style="--qt-row-gap:10px">
        <label class="qt-check"><input type="checkbox" :checked="config.enableStats" @change="update('enableStats', ($event.target as HTMLInputElement).checked)" /> <span>{{ t(U + 'enableStatsLabel') }}</span></label>
        <ToolField v-model="config.statsUri" :label="t(U + 'statsUriLabel')" />
        <ToolField v-model="config.statsAuth" :label="t(U + 'statsAuthLabel')" />
      </div>

      <div style="font-size:13px;font-weight:700;color:var(--qt-text);padding-top:4px;border-top:1px solid var(--qt-border)">{{ t(U + 'secBackends') }}</div>
      <div class="qt-stack" style="--qt-stack-gap:8px">
        <button type="button" class="qt-btn qt-btn--ghost" style="padding:4px 10px;font-size:12px;align-self:flex-start" @click="addBackend">+ {{ t(U + 'addBackend') }}</button>
        <div v-for="(b, i) in config.backends" :key="i" class="qt-stack" style="--qt-stack-gap:6px">
          <div class="qt-row qt-row--center" style="--qt-row-gap:6px">
            <ToolField v-model="b.name" :placeholder="t(U + 'phBackendName')" grow aria-label="Backend name" />
            <select class="qt-input" style="width:auto" :value="b.balance" @change="updateBackend(i, 'balance', ($event.target as HTMLSelectElement).value)">
              <option v-for="a in BALANCE_ALGOS" :key="a" :value="a">{{ a }}</option>
            </select>
            <label class="qt-check"><input type="checkbox" :checked="b.check" @change="updateBackend(i, 'check', ($event.target as HTMLInputElement).checked)" /> <span>{{ t(U + 'healthCheckLabel') }}</span></label>
            <label class="qt-check"><input type="checkbox" :checked="b.redirectHttps" @change="updateBackend(i, 'redirectHttps', ($event.target as HTMLInputElement).checked)" /> <span>{{ t(U + 'redirectHttpsLabel') }}</span></label>
            <button type="button" class="qt-btn qt-btn--ghost" style="flex-shrink:0;width:28px;height:28px;padding:0;color:var(--qt-danger);font-size:16px;line-height:1" @click="removeBackend(i)">×</button>
          </div>
          <ToolField v-model="b.servers" as="textarea" :rows="3" mono placeholder="web1 10.0.0.1:8080 check&#10;web2 10.0.0.2:8080 check" aria-label="Backend servers" />
        </div>
      </div>
    </ToolInput>

    <ToolOutput :title="t(U + 'outTitle')" :copy-text="output" :copy-label="t(U + 'copyLabel')">
      <pre class="qt-output" style="margin:0;max-height:60vh"><code>{{ output }}</code></pre>
    </ToolOutput>
  </div>
</template>
