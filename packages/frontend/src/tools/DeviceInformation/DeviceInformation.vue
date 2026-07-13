<script setup lang="ts">
/**
 * DeviceInformation — display browser, OS, and device information.
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
import { RefreshCw, Monitor, Check, Copy } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import CopyButton from '@/components/CopyButton.vue';
import { useDeviceInformation } from './useDeviceInformation';

const { info, refreshing, refresh, copyAllText } = useDeviceInformation();

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
  <div class="device">
    <ToolInput
      title="Device information"
      description="Live snapshot of your browser, screen, viewport, hardware, and capabilities. The viewport and online status update automatically."
    >
      <template #actions>
        <button
          class="device__btn"
          type="button"
          :disabled="refreshing"
          @click="refresh"
        >
          <RefreshCw :size="14" :class="{ 'device__spin': refreshing }" />
          <span>{{ refreshing ? 'Refreshing…' : 'Refresh' }}</span>
        </button>
        <button
          class="device__btn device__btn--ghost"
          type="button"
          @click="onCopyAll"
        >
          <component :is="copiedAll ? Check : Copy" :size="14" />
          <span>{{ copiedAll ? 'Copied!' : 'Copy all' }}</span>
        </button>
      </template>

      <div class="device__meta">
        <Monitor :size="14" />
        <span>{{ totalFields }} fields · updated {{ collectedAtLabel }}</span>
      </div>
    </ToolInput>

    <ToolOutput title="Snapshot">
      <div class="device__groups">
        <section
          v-for="group in groups"
          :key="group.id"
          class="device__group"
        >
          <h3 class="device__group-title">{{ group.label }}</h3>
          <dl class="device__grid">
            <div
              v-for="f in group.fields"
              :key="f.key"
              class="device__row"
              :class="{ 'device__row--unavailable': f.unavailable }"
            >
              <dt class="device__key">{{ f.label }}</dt>
              <dd class="device__value" :title="f.value">{{ f.value }}</dd>
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
.device {
  display: flex;
  flex-direction: column;
  gap: var(--qt-gap);
  max-width: var(--qt-max-content);
  margin: 0 auto;
}
.device__btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: var(--qt-accent);
  border: 1px solid var(--qt-accent);
  border-radius: var(--qt-radius-sm);
  color: var(--qt-bg);
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  padding: 7px 12px;
  cursor: pointer;
  transition:
    transform 0.1s ease,
    opacity 0.15s ease;
  will-change: transform;
}
.device__btn:hover:not(:disabled) {
  transform: translateY(-1px);
}
.device__btn:active:not(:disabled) {
  transform: translateY(0);
}
.device__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.device__btn--ghost {
  background: transparent;
  color: var(--qt-text);
  border-color: var(--qt-border);
}
.device__btn--ghost:hover:not(:disabled) {
  border-color: var(--qt-accent);
  color: var(--qt-accent);
}
.device__spin {
  animation: device-spin 0.8s linear infinite;
}
@keyframes device-spin {
  to {
    transform: rotate(360deg);
  }
}
.device__meta {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--qt-muted);
}
.device__groups {
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.device__group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.device__group-title {
  margin: 0;
  font-size: 12.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--qt-muted);
  padding-bottom: 6px;
  border-bottom: 1px solid var(--qt-border);
}
.device__grid {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin: 0;
}
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
.device__key {
  font-size: 13px;
  font-weight: 600;
  color: var(--qt-muted);
}
.device__value {
  margin: 0;
  font-size: 13.5px;
  color: var(--qt-text);
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
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
