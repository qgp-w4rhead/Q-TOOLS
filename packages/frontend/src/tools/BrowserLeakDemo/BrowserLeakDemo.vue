<script setup lang="ts">
/**
 * BrowserLeakDemo - show what the browser exposes to any website without a
 * permission prompt.
 *
 * Collects user-agent, platform, languages, screen/viewport geometry,
 * timezone, hardware hints, cookies/DoNotTrack, a canvas fingerprint hash,
 * and local IPs via WebRTC ICE candidates (no permission needed). A rough
 * entropy estimate shows how uniquely identifiable the visitor is.
 *
 * No external dependencies.
 *
 * Works in embed mode: receives `input` PostMessages with `{ action:
 * 'refresh' }`; sends `output` PostMessages with `{ bits, uniqueness,
 * webrtcIps, fields }`.
 */
import { useI18n } from 'vue-i18n';
import { Eye, Loader2, RefreshCw } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import ToolButton from '@/components/ToolButton.vue';
import ToolAlert from '@/components/ToolAlert.vue';
import CopyButton from '@/components/CopyButton.vue';
import { useBrowserLeakDemo } from './useBrowserLeakDemo';

const { t } = useI18n();
const U = 'tools.browser-leak-demo.ui.';

const { groups, webrtcIps, webrtcDone, bits, uniqueness, refresh } =
  useBrowserLeakDemo();
</script>

<template>
  <div class="qt-tool">
    <ToolInput
      :title="t(U + 'inputTitle')"
      :description="t(U + 'desc')"
    >
      <template #actions>
        <ToolButton @click="refresh">
          <RefreshCw :size="13" /> {{ t('common.refresh') }}
        </ToolButton>
      </template>
      <div class="qt-row qt-row--center qt-row--between" style="--qt-row-gap:12px">
        <div class="qt-row" style="--qt-row-gap:8px;align-items:baseline;color:var(--qt-accent);flex-wrap:nowrap">
          <Eye :size="18" />
          <span style="font-size:30px;font-weight:800;font-variant-numeric:tabular-nums">{{ bits.toFixed(1) }}</span>
          <span class="qt-hint" style="font-size:13px">{{ t(U + 'bitsLabel') }}</span>
        </div>
        <span class="qt-badge qt-badge--warn">{{ uniqueness }}</span>
      </div>
      <p class="qt-hint" style="font-size:12.5px">
        {{ t(U + 'entropyNote') }}
      </p>
    </ToolInput>

    <ToolOutput
      :title="t(U + 'outTitle')"
      :description="t(U + 'outDesc')"
      hide-copy
    >
      <div v-for="g in groups" :key="g.title" class="qt-stack" style="--qt-stack-gap:6px">
        <p class="qt-stat-head">{{ g.title }}</p>
        <div class="qt-stack" style="--qt-stack-gap:5px">
          <div v-for="item in g.items" :key="item.label" class="bld__kv">
            <span class="qt-stat-head">{{ item.label }}</span>
            <span style="font-size:12.5px;color:var(--qt-text);word-break:break-all;min-width:0;overflow:hidden;text-overflow:ellipsis" :title="item.value">{{ item.value }}</span>
            <CopyButton :text="item.value" :label="t('common.copy')" icon-only />
          </div>
        </div>
      </div>

      <div class="qt-stack" style="--qt-stack-gap:6px">
        <p class="qt-stat-head">{{ t(U + 'webrtcTitle') }}</p>
        <div v-if="!webrtcDone" class="qt-row qt-row--center" style="--qt-row-gap:8px;font-size:13px;color:var(--qt-muted);flex-wrap:nowrap">
          <Loader2 :size="14" class="qt-spin" />
          <span>{{ t(U + 'webrtcBusy') }}</span>
        </div>
        <template v-else>
          <div v-if="webrtcIps.length" class="qt-stack" style="--qt-stack-gap:5px">
            <div v-for="ip in webrtcIps" :key="ip" class="bld__kv">
              <span class="qt-stat-head">{{ t(U + 'localAddr') }}</span>
              <span class="qt-mono" style="font-size:12.5px;word-break:break-all;min-width:0;overflow:hidden;text-overflow:ellipsis">{{ ip }}</span>
              <CopyButton :text="ip" :label="t('common.copy')" icon-only />
            </div>
          </div>
          <ToolAlert v-else kind="empty">
            {{ t(U + 'webrtcEmpty') }}
          </ToolAlert>
        </template>
      </div>
    </ToolOutput>
  </div>
</template>

<style scoped>
/* Kept scoped: patterns unique to this tool (no generic utility). */

/* Key/value row — fixed 150px label column + flexible value + copy. */
.bld__kv {
  display: grid;
  grid-template-columns: 150px 1fr auto;
  align-items: center;
  gap: 10px;
  padding: 6px 10px;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
}
@media (max-width: 640px) {
  .bld__kv { grid-template-columns: 110px 1fr auto; }
}
</style>
