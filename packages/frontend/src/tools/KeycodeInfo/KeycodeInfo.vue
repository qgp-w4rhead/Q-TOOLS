<script setup lang="ts">
/**
 * KeycodeInfo — display key, code, keyCode, location, and modifiers for the
 * most recent key press. A `keydown` listener is attached to `document` and
 * captured events are shown live, with a bounded history of recent presses.
 *
 * No external dependencies.
 *
 * Works in embed mode: sends an `output` PostMessage on each keydown with the
 * full `KeyEventInfo` plus a `summary` string, and accepts `input` messages
 * `{ pause: boolean }` and `{ clear: true }`.
 */
import { computed, ref } from 'vue';
import { Keyboard, Pause, Play, Trash2, Check, Copy } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import CopyButton from '@/components/CopyButton.vue';
import {
  useKeycodeInfo,
  summarizeEvent,
  eventToJson,
  type KeyEventInfo,
} from './useKeycodeInfo';

const { last, history, paused, count, togglePause, clear } = useKeycodeInfo();

interface Field {
  key: keyof KeyEventInfo;
  label: string;
  value: string;
}

const fields = computed<Field[]>(() => {
  const e = last.value;
  if (!e) return [];
  return [
    { key: 'key', label: 'key', value: e.key === ' ' ? 'Space' : e.key },
    { key: 'code', label: 'code', value: e.code },
    { key: 'keyCode', label: 'keyCode', value: String(e.keyCode) },
    { key: 'which', label: 'which', value: String(e.which) },
    { key: 'charCode', label: 'charCode', value: String(e.charCode) },
    { key: 'location', label: 'location', value: `${e.location} — ${e.locationLabel}` },
    { key: 'repeat', label: 'repeat', value: e.repeat ? 'true' : 'false' },
    { key: 'isComposing', label: 'isComposing', value: e.isComposing ? 'true' : 'false' },
  ];
});

const modifiers = computed(() => {
  const e = last.value;
  if (!e) return [];
  return [
    { id: 'ctrl', label: 'Ctrl', active: e.ctrl },
    { id: 'shift', label: 'Shift', active: e.shift },
    { id: 'alt', label: 'Alt', active: e.alt },
    { id: 'meta', label: 'Meta', active: e.meta },
  ];
});

const summary = computed(() => (last.value ? summarizeEvent(last.value) : ''));

const copiedAll = ref(false);

async function onCopyAll(): Promise<void> {
  if (!last.value) return;
  try {
    await navigator.clipboard.writeText(eventToJson(last.value));
    copiedAll.value = true;
    setTimeout(() => {
      copiedAll.value = false;
    }, 1500);
  } catch {
    // CopyButton handles its own feedback; this is a best-effort bulk copy.
  }
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString();
  } catch {
    return iso;
  }
}
</script>

<template>
  <div class="keycode">
    <ToolInput
      title="Keycode info"
      description="Press any key to inspect its key, code, keyCode, location, and modifier state. The listener is attached to the whole document."
    >
      <template #actions>
        <button
          class="keycode__btn"
          type="button"
          @click="togglePause"
        >
          <component :is="paused ? Play : Pause" :size="14" />
          <span>{{ paused ? 'Resume' : 'Pause' }}</span>
        </button>
        <button
          class="keycode__btn keycode__btn--ghost"
          type="button"
          @click="clear"
          :disabled="!last"
        >
          <Trash2 :size="14" />
          <span>Clear</span>
        </button>
      </template>

      <div class="keycode__meta">
        <Keyboard :size="14" />
        <span>{{ count }} event{{ count === 1 ? '' : 's' }} captured · {{ paused ? 'paused' : 'listening' }}</span>
      </div>
    </ToolInput>

    <ToolOutput title="Last key press">
      <div v-if="!last" class="keycode__empty">
        <Keyboard :size="36" />
        <p>Press any key to see its details.</p>
      </div>

      <div v-else class="keycode__result">
        <div class="keycode__hero">
          <div class="keycode__hero-key" :title="last.key === ' ' ? 'Space' : last.key">
            {{ last.key === ' ' ? 'Space' : last.key || last.code }}
          </div>
          <div class="keycode__hero-meta">
            <span class="keycode__hero-summary">{{ summary }}</span>
            <button
              class="keycode__btn keycode__btn--ghost keycode__btn--sm"
              type="button"
              @click="onCopyAll"
            >
              <component :is="copiedAll ? Check : Copy" :size="12" />
              <span>{{ copiedAll ? 'Copied!' : 'Copy JSON' }}</span>
            </button>
          </div>
        </div>

        <div class="keycode__mods">
          <span
            v-for="m in modifiers"
            :key="m.id"
            class="keycode__mod"
            :class="{ 'keycode__mod--active': m.active }"
          >{{ m.label }}</span>
        </div>

        <dl class="keycode__grid">
          <div v-for="f in fields" :key="f.key" class="keycode__row">
            <dt class="keycode__key">{{ f.label }}</dt>
            <dd class="keycode__value" :title="f.value">{{ f.value }}</dd>
            <CopyButton :text="f.value" class="keycode__copy" />
          </div>
        </dl>
      </div>
    </ToolOutput>

    <ToolOutput v-if="history.length > 0" title="Recent presses">
      <ul class="keycode__history">
        <li
          v-for="(e, i) in history"
          :key="`${e.eventTime}-${i}`"
          class="keycode__history-row"
          :class="{ 'keycode__history-row--current': i === 0 }"
        >
          <span class="keycode__history-time">{{ formatTime(e.timestamp) }}</span>
          <span class="keycode__history-summary">{{ summarizeEvent(e) }}</span>
          <span class="keycode__history-code">{{ e.code || '—' }}</span>
          <span class="keycode__history-keycode">{{ e.keyCode }}</span>
        </li>
      </ul>
    </ToolOutput>
  </div>
</template>

<style scoped>
.keycode {
  display: flex;
  flex-direction: column;
  gap: var(--qt-gap);
  max-width: var(--qt-max-content);
  margin: 0 auto;
}
.keycode__btn {
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
.keycode__btn:hover:not(:disabled) {
  transform: translateY(-1px);
}
.keycode__btn:active:not(:disabled) {
  transform: translateY(0);
}
.keycode__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.keycode__btn--ghost {
  background: transparent;
  color: var(--qt-text);
  border-color: var(--qt-border);
}
.keycode__btn--ghost:hover:not(:disabled) {
  border-color: var(--qt-accent);
  color: var(--qt-accent);
}
.keycode__btn--sm {
  padding: 4px 8px;
  font-size: 12px;
}
.keycode__meta {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--qt-muted);
}
.keycode__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 40px 16px;
  color: var(--qt-muted);
  text-align: center;
}
.keycode__empty p {
  margin: 0;
  font-size: 13.5px;
}
.keycode__result {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.keycode__hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px;
  background: var(--qt-surface);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius);
}
.keycode__hero-key {
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
  font-size: 22px;
  font-weight: 700;
  color: var(--qt-text);
  word-break: break-word;
  min-width: 0;
}
.keycode__hero-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}
.keycode__hero-summary {
  font-size: 12.5px;
  color: var(--qt-muted);
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
}
.keycode__mods {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.keycode__mod {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border: 1px solid var(--qt-border);
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  color: var(--qt-muted);
  background: transparent;
  transition:
    background 0.12s ease,
    color 0.12s ease,
    border-color 0.12s ease;
}
.keycode__mod--active {
  background: var(--qt-accent);
  border-color: var(--qt-accent);
  color: var(--qt-bg);
}
.keycode__grid {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin: 0;
}
.keycode__row {
  display: grid;
  grid-template-columns: minmax(120px, 180px) 1fr auto;
  align-items: center;
  gap: 10px;
  padding: 7px 8px;
  border-radius: var(--qt-radius-sm);
  transition: background 0.12s ease;
}
.keycode__row:hover {
  background: var(--qt-surface);
}
.keycode__key {
  font-size: 13px;
  font-weight: 600;
  color: var(--qt-muted);
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
}
.keycode__value {
  margin: 0;
  font-size: 13.5px;
  color: var(--qt-text);
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
  word-break: break-word;
  min-width: 0;
}
.keycode__copy {
  opacity: 0;
  transition: opacity 0.12s ease;
}
.keycode__row:hover .keycode__copy,
.keycode__row:focus-within .keycode__copy {
  opacity: 1;
}
.keycode__history {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.keycode__history-row {
  display: grid;
  grid-template-columns: 90px 1fr 130px 60px;
  align-items: center;
  gap: 10px;
  padding: 6px 8px;
  border-radius: var(--qt-radius-sm);
  font-size: 12.5px;
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
  color: var(--qt-muted);
  transition: background 0.12s ease;
}
.keycode__history-row:hover {
  background: var(--qt-surface);
}
.keycode__history-row--current {
  color: var(--qt-text);
  background: var(--qt-surface);
}
.keycode__history-summary {
  color: var(--qt-text);
  font-weight: 600;
  word-break: break-word;
  min-width: 0;
}
.keycode__history-code {
  color: var(--qt-muted);
}
.keycode__history-keycode {
  color: var(--qt-muted);
  text-align: right;
}
@media (max-width: 640px) {
  .keycode__row {
    grid-template-columns: minmax(100px, 140px) 1fr auto;
    gap: 8px;
  }
  .keycode__copy {
    opacity: 1;
  }
  .keycode__history-row {
    grid-template-columns: 70px 1fr 60px;
  }
  .keycode__history-code {
    display: none;
  }
}
</style>
