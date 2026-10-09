<script setup lang="ts">
/**
 * WolPacketBuilder - build a Wake-on-LAN magic packet for a MAC address.
 *
 * Emits the 102-byte packet (6 × 0xFF + MAC × 16) as spaced hex and base64,
 * a downloadable `.bin`, and ready-to-paste CLI commands (`wakeonlan`,
 * `etherwake`, `wol`, PowerShell, Python) incorporating the optional
 * broadcast address and UDP port.
 *
 * Works in embed mode: receives `mac`/`address`/`input`/`value`,
 * `broadcast`, and `port` PostMessages; sends `output` PostMessages with
 * the packet bytes and commands.
 *
 * No external dependencies - byte-array math + `btoa` only.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { AlertCircle, Download } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import CopyButton from '@/components/CopyButton.vue';
import { useWolPacketBuilder } from './useWolPacketBuilder';

const { t } = useI18n();
const U = 'tools.wol-packet-builder.ui.';

const {
  macInput,
  broadcastInput,
  portInput,
  result,
  error,
} = useWolPacketBuilder();

const hasInput = computed(() => macInput.value.trim().length > 0);

function onMacInput(e: Event): void {
  macInput.value = (e.target as HTMLInputElement).value;
}
function onBroadcastInput(e: Event): void {
  broadcastInput.value = (e.target as HTMLInputElement).value;
}
function onPortInput(e: Event): void {
  portInput.value = (e.target as HTMLInputElement).value;
}

const commandRows = computed(() => {
  const r = result.value;
  if (!r) return [];
  return [
    { label: 'wakeonlan', value: r.commands.wakeonlan },
    { label: 'etherwake', value: r.commands.etherwake },
    { label: 'wol', value: r.commands.wol },
    { label: 'PowerShell', value: r.commands.powershell },
    { label: 'Python 3', value: r.commands.python },
  ];
});

function downloadPacket(): void {
  const r = result.value;
  if (!r) return;
  const blob = new Blob([r.packet.slice().buffer as ArrayBuffer], {
    type: 'application/octet-stream',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `wol-${r.mac.replace(/:/g, '')}.bin`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
</script>

<template>
  <div class="qt-tool">
    <ToolInput
      :title="t(U + 'inputTitle')"
      :description="t(U + 'desc')"
    >
      <div class="wolb__inputs">
        <div class="qt-field" style="gap:4px">
          <label class="qt-stat-head" for="wol-mac">{{ t(U + 'macLabel') }}</label>
          <input
            id="wol-mac"
            class="qt-input qt-input--mono"
            style="font-size:13.5px"
            type="text"
            :placeholder="t(U + 'phMac')"
            :value="macInput"
            spellcheck="false"
            autocomplete="off"
            autocapitalize="off"
            @input="onMacInput"
          />
        </div>
        <div class="qt-field" style="gap:4px">
          <label class="qt-stat-head" for="wol-bcast">{{ t(U + 'bcastLabel') }}</label>
          <input
            id="wol-bcast"
            class="qt-input qt-input--mono"
            style="font-size:13.5px"
            type="text"
            :placeholder="t(U + 'phBcast')"
            :value="broadcastInput"
            spellcheck="false"
            autocomplete="off"
            autocapitalize="off"
            @input="onBroadcastInput"
          />
        </div>
        <div class="qt-field" style="gap:4px">
          <label class="qt-stat-head" for="wol-port">{{ t(U + 'portLabel') }}</label>
          <input
            id="wol-port"
            class="qt-input qt-input--mono"
            style="font-size:13.5px"
            type="text"
            inputmode="numeric"
            :placeholder="t(U + 'phPort')"
            :value="portInput"
            spellcheck="false"
            autocomplete="off"
            @input="onPortInput"
          />
        </div>
      </div>
    </ToolInput>

    <ToolOutput
      :title="t(U + 'outTitle')"
      :description="result ? t(U + 'descResult', { n: result.length, bcast: result.broadcast, port: result.port }) : t(U + 'descEmpty')"
      :copy-text="result ? result.hex : ''"
      :copy-label="t(U + 'copyHex')"
    >
      <template v-if="!hasInput">
        <p class="qt-alert qt-alert--empty">{{ t(U + 'alertEmpty') }}</p>
      </template>
      <template v-else-if="error">
        <p class="qt-banner qt-banner--error" style="margin:0">
          <AlertCircle :size="14" />
          <span>{{ error }}</span>
        </p>
      </template>
      <template v-else-if="result">
        <div class="qt-row qt-row--center" style="--qt-row-gap:8px;margin-bottom:10px">
          <span class="qt-badge" style="font-weight:600;text-transform:none">{{ t(U + 'badgeBytes', { n: result.length }) }}</span>
          <span class="qt-badge" style="font-weight:600;text-transform:none">6 × FF + MAC × 16</span>
          <button type="button" class="qt-chip qt-chip--filled" style="padding:4px 12px" @click="downloadPacket">
            <Download :size="13" />
            <span>{{ t(U + 'download') }}</span>
          </button>
        </div>

        <div class="qt-field" style="gap:4px;margin-bottom:10px">
          <span class="qt-stat-head">{{ t(U + 'hexLabel') }}</span>
          <code class="wolb__hex">{{ result.hex }}</code>
        </div>

        <div class="qt-field" style="gap:4px;margin-bottom:10px">
          <span class="qt-stat-head">{{ t(U + 'b64Label') }}</span>
          <div class="qt-row qt-row--center" style="--qt-row-gap:8px;flex-wrap:nowrap">
            <code class="qt-mono" style="font-size:12.5px;color:var(--qt-text);flex:1;background:var(--qt-bg);border:1px solid var(--qt-border);border-radius:var(--qt-radius-sm);padding:8px 10px;word-break:break-all">{{ result.base64 }}</code>
            <CopyButton :text="result.base64" icon-only :label="t('common.copy')" />
          </div>
        </div>

        <div style="margin-top:4px">
          <h3 class="qt-stat-head" style="font-size:12px;margin:0 0 8px">{{ t(U + 'cliTitle') }}</h3>
          <div v-for="c in commandRows" :key="c.label" class="qt-result-row wolb__cmd" style="margin-bottom:6px">
            <span class="qt-label wolb__cmd-label">{{ c.label }}</span>
            <code class="qt-mono" style="font-size:12px;color:var(--qt-text);flex:1;word-break:break-all">{{ c.value }}</code>
            <CopyButton :text="c.value" icon-only :label="t('common.copy')" />
          </div>
        </div>
      </template>
    </ToolOutput>
  </div>
</template>

<style scoped>
/* Kept scoped: patterns unique to this tool (no generic utility). */

/* Inputs — fixed 3-column grid (MAC / broadcast / port). */
.wolb__inputs {
  display: grid;
  grid-template-columns: 2fr 1.4fr 0.7fr;
  gap: 10px;
}

/* Hex dump — scrollable mono block. */
.wolb__hex {
  font-family: var(--qt-font-mono);
  font-size: 11.5px;
  color: var(--qt-text);
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  padding: 8px 10px;
  word-break: break-all;
  max-height: 120px;
  overflow-y: auto;
}

/* Command-row label — fixed column width; wraps full-width on narrow. */
.wolb__cmd-label {
  flex: 0 0 90px;
}

@media (max-width: 640px) {
  .wolb__inputs {
    grid-template-columns: 1fr;
  }
  .wolb__cmd {
    flex-wrap: wrap;
  }
  .wolb__cmd-label {
    flex-basis: 100%;
  }
}
</style>
