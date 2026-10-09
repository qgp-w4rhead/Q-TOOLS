<script setup lang="ts">
/**
 * DeviceInformation - display browser, OS, and device information.
 *
 * Snapshots the runtime environment via the standard `navigator`, `screen`,
 * and `window` APIs and renders the result as a grouped key/value grid.
 * The viewport and online status are kept live (resize + online/offline
 * listeners); a Refresh button re-snapshots everything on demand.
 *
 * No external dependencies.
 *
 * Works in embed mode: sends `output` PostMessages with a flat
 * `{ field: value }` map whenever the snapshot changes, and accepts an
 * `input` PostMessage with `{ refresh: true }` to trigger a re-snapshot.
 */
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { RefreshCw, Monitor, Check, Copy } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import CopyButton from '@/components/CopyButton.vue';
import { useDeviceInformation } from './useDeviceInformation';

const { info, refreshing, refresh, copyAllText } = useDeviceInformation();

const { t } = useI18n();
const U = 'tools.device-information.ui.';

function groupLabel(id: string): string {
  return t(`${U}groups.${id}`);
}
function fieldLabel(key: string): string {
  return t(`${U}fields.${key}`);
}
function fieldValue(f: { value: string }): string {
  if (f.value === 'Yes') return t(U + 'yes');
  if (f.value === 'No') return t(U + 'no');
  return f.value;
}

const groups = computed(() => info.value.groups);
const collectedAt = computed(() => info.value.collectedAt);

const collectedAtLabel = computed(() => {
  try {
    const d = new Date(collectedAt.value);
    return d.toLocaleString();
  } catch {
    return collectedAt.value;
  }
});

const totalFields = computed(() =>
  groups.value.reduce((sum, g) => sum + g.fields.length, 0),
);

const copiedAll = ref(false);

async function onCopyAll(): Promise<void> {
  const text = copyAllText();
  try {
    await navigator.clipboard.writeText(text);
    copiedAll.value = true;
    setTimeout(() => {
      copiedAll.value = false;
    }, 1500);
  } catch {
    // CopyButton handles its own feedback; this is a best-effort bulk copy.
  }
}
</script>

<template>
  <div class="qt-tool">
    <ToolInput
      :title="t(U + 'inputTitle')"
      :description="t(U + 'desc')"
    >
      <template #actions>
        <button
          class="qt-btn qt-btn--primary"
          type="button"
          :disabled="refreshing"
          @click="refresh"
        >
          <RefreshCw :size="14" :class="{ 'qt-spin': refreshing }" />
          <span>{{ refreshing ? t(U + 'refreshing') : t(U + 'refresh') }}</span>
        </button>
        <button
          class="qt-btn qt-btn--ghost"
          type="button"
          @click="onCopyAll"
        >
          <component :is="copiedAll ? Check : Copy" :size="14" />
          <span>{{ copiedAll ? t('common.copiedFeedback') : t('common.copyAll') }}</span>
        </button>
      </template>

      <div class="qt-row qt-row--center qt-hint" style="--qt-row-gap:6px;font-size:12px">
        <Monitor :size="14" />
        <span>{{ t(U + 'fieldsCount', { time: collectedAtLabel }, totalFields) }}</span>
      </div>
    </ToolInput>

    <ToolOutput :title="t(U + 'outputTitle')">
      <div class="qt-stack" style="--qt-stack-gap:18px">
        <section
          v-for="group in groups"
          :key="group.id"
          class="qt-stack"
          style="--qt-stack-gap:8px"
        >
          <h3 class="qt-stat-head device__group-title">{{ groupLabel(group.id) }}</h3>
          <dl class="qt-stack" style="--qt-stack-gap:2px;margin:0">
            <div
              v-for="f in group.fields"
              :key="f.key"
              class="device__row"
              :class="{ 'device__row--unavailable': f.unavailable }"
            >
              <dt class="qt-label">{{ fieldLabel(f.key) }}</dt>
              <dd class="qt-mono device__value" :title="f.value">{{ fieldValue(f) }}</dd>
              <CopyButton
                v-if="!f.unavailable"
                :text="f.value"
                class="device__copy"
              />
            </div>
          </dl>
        </section>
      </div>
    </ToolOutput>
  </div>
</template>

<style scoped>
/* Kept scoped: patterns unique to this tool (no generic utility). */

/* Group heading (base via .qt-stat-head) — bottom rule. */
.device__group-title {
  margin: 0;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--qt-border);
  width: 100%;
}
/* Field rows — 3-col grid (key / value / copy) with hover reveal. */
.device__row {
  display: grid;
  grid-template-columns: minmax(140px, 220px) 1fr auto;
  align-items: center;
  gap: 10px;
  padding: 7px 8px;
  border-radius: var(--qt-radius-sm);
  transition: background 0.12s ease;
}
.device__row:hover {
  background: var(--qt-surface);
}
.device__row--unavailable {
  opacity: 0.65;
}
.device__value {
  margin: 0;
  font-size: 13.5px;
  color: var(--qt-text);
  word-break: break-word;
  min-width: 0;
}
.device__copy {
  opacity: 0;
  transition: opacity 0.12s ease;
}
.device__row:hover .device__copy,
.device__row:focus-within .device__copy {
  opacity: 1;
}
@media (max-width: 640px) {
  .device__row {
    grid-template-columns: minmax(110px, 160px) 1fr auto;
    gap: 8px;
  }
  .device__copy {
    opacity: 1;
  }
}
</style>
