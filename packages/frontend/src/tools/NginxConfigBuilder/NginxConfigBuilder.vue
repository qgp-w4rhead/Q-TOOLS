<script setup lang="ts">
/**
 * NginxConfigBuilder - visual form → Nginx configuration.
 *
 * Three modes: reverse-proxy, static-site, load-balancer.
 * Generates a complete server block with optional SSL, logging, and
 * mode-specific directives.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { RotateCcw } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import ToolField from '@/components/ToolField.vue';
import ToolButton from '@/components/ToolButton.vue';
import {
  useNginxConfigBuilder,
  type NginxMode,
} from './useNginxConfigBuilder';

const {
  config,
  output,
  update,
  addBackend,
  removeBackend,
  updateBackend,
  reset,
} = useNginxConfigBuilder();

const { t } = useI18n();
const U = 'tools.nginx-config-builder.ui.';

const MODES = computed<{ value: NginxMode; label: string }[]>(() => [
  { value: 'reverse-proxy', label: t(U + 'modeReverseProxy') },
  { value: 'static-site', label: t(U + 'modeStaticSite') },
  { value: 'load-balancer', label: t(U + 'modeLoadBalancer') },
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
        <span class="qt-label">{{ t('common.mode') }}</span>
        <select
          class="qt-input"
          :value="config.mode"
          @change="update('mode', ($event.target as HTMLSelectElement).value as NginxMode)"
        >
          <option v-for="m in MODES" :key="m.value" :value="m.value">{{ m.label }}</option>
        </select>
      </label>

      <div class="qt-row" style="--qt-row-gap:10px">
        <ToolField v-model="config.serverName" :label="t(U + 'serverNameLabel')" placeholder="example.com" grow />
        <ToolField
          :model-value="config.listenPort"
          :label="t(U + 'listenPortLabel')"
          type="number"
          min="1"
          max="65535"
          @update:model-value="update('listenPort', Number($event))"
        />
      </div>

      <!-- Reverse proxy fields -->
      <template v-if="config.mode === 'reverse-proxy'">
        <ToolField v-model="config.proxyPass" :label="t(U + 'proxyPassLabel')" placeholder="http://127.0.0.1:3000" />
        <div class="qt-row" style="--qt-row-gap:16px">
          <label class="qt-check">
            <input type="checkbox" :checked="config.proxySetHeaders" @change="update('proxySetHeaders', ($event.target as HTMLInputElement).checked)" />
            <span>{{ t(U + 'proxyHeadersLabel') }}</span>
          </label>
          <label class="qt-check">
            <input type="checkbox" :checked="config.proxyWebsocket" @change="update('proxyWebsocket', ($event.target as HTMLInputElement).checked)" />
            <span>{{ t(U + 'proxyWsLabel') }}</span>
          </label>
        </div>
      </template>

      <!-- Static site fields -->
      <template v-if="config.mode === 'static-site'">
        <ToolField v-model="config.rootDir" :label="t(U + 'rootDirLabel')" placeholder="/var/www/html" />
        <ToolField v-model="config.indexFile" :label="t(U + 'indexFileLabel')" placeholder="index.html" />
        <div class="qt-row" style="--qt-row-gap:16px">
          <label class="qt-check">
            <input type="checkbox" :checked="config.gzip" @change="update('gzip', ($event.target as HTMLInputElement).checked)" />
            <span>{{ t(U + 'gzipLabel') }}</span>
          </label>
          <label class="qt-check">
            <input type="checkbox" :checked="config.tryFiles" @change="update('tryFiles', ($event.target as HTMLInputElement).checked)" />
            <span>{{ t(U + 'tryFilesLabel') }}</span>
          </label>
        </div>
      </template>

      <!-- Load balancer fields -->
      <template v-if="config.mode === 'load-balancer'">
        <div class="qt-row" style="--qt-row-gap:10px">
          <ToolField v-model="config.upstreamName" :label="t(U + 'upstreamNameLabel')" placeholder="backend" grow />
          <label class="qt-field">
            <span class="qt-label">{{ t(U + 'methodLabel') }}</span>
            <select
              class="qt-input"
              :value="config.lbMethod"
              @change="update('lbMethod', ($event.target as HTMLSelectElement).value as 'round-robin' | 'ip_hash' | 'least_conn')"
            >
              <option value="round-robin">{{ t(U + 'lbRoundRobin') }}</option>
              <option value="ip_hash">{{ t(U + 'lbIpHash') }}</option>
              <option value="least_conn">{{ t(U + 'lbLeastConn') }}</option>
            </select>
          </label>
        </div>
        <div class="qt-stack" style="--qt-stack-gap:8px">
          <div v-for="(b, i) in config.backends" :key="i" class="qt-row qt-row--center" style="--qt-row-gap:8px;flex-wrap:nowrap">
            <ToolField v-model="b.url" placeholder="127.0.0.1:3000" grow aria-label="Backend URL" />
            <ToolField
              :model-value="b.weight"
              type="number"
              min="1"
              max="100"
              :title="t(U + 'weightTitle')"
              aria-label="Backend weight"
              style="max-width: 80px"
              @update:model-value="updateBackend(i, 'weight', Number($event))"
            />
            <button type="button" class="qt-btn qt-btn--ghost" style="flex-shrink:0;width:28px;height:28px;padding:0;color:var(--qt-danger);font-size:16px;line-height:1" :disabled="config.backends.length <= 1" @click="removeBackend(i)">×</button>
          </div>
          <button type="button" class="qt-btn qt-btn--ghost" style="align-self:flex-start;padding:6px 12px;font-size:12.5px" @click="addBackend">+ {{ t(U + 'addBackend') }}</button>
        </div>
      </template>

      <!-- SSL fields -->
      <details class="ngb__details">
        <summary class="ngb__summary">{{ t(U + 'sslSection') }}</summary>
        <label class="qt-check">
          <input type="checkbox" :checked="config.sslEnabled" @change="update('sslEnabled', ($event.target as HTMLInputElement).checked)" />
          <span>{{ t(U + 'sslEnable') }}</span>
        </label>
        <template v-if="config.sslEnabled">
          <ToolField v-model="config.sslCert" :label="t(U + 'sslCertLabel')" />
          <ToolField v-model="config.sslKey" :label="t(U + 'sslKeyLabel')" />
        </template>
      </details>

      <!-- Logging fields -->
      <details class="ngb__details">
        <summary class="ngb__summary">{{ t(U + 'loggingSection') }}</summary>
        <ToolField v-model="config.accessLog" :label="t(U + 'accessLogLabel')" />
        <ToolField v-model="config.errorLog" :label="t(U + 'errorLogLabel')" />
      </details>
    </ToolInput>

    <ToolOutput
      :title="t(U + 'outTitle')"
      :copy-text="output"
      :copy-label="t(U + 'copyLabel')"
    >
      <pre class="qt-output" style="margin:0;max-height:60vh;tab-size:2"><code>{{ output }}</code></pre>
    </ToolOutput>
  </div>
</template>

<style scoped>
/* Kept scoped: patterns unique to this tool (no generic utility). */

/* Bordered collapsible sections. */
.ngb__details {
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  padding: 8px 10px;
}
.ngb__summary {
  cursor: pointer;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--qt-muted);
}
</style>
