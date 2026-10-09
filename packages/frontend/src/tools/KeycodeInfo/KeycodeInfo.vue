<script setup lang="ts">
/**
 * KeycodeInfo - display key, code, keyCode, location, and modifiers for the
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
import { useI18n } from 'vue-i18n';
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

const { t, locale } = useI18n();
const U = 'tools.keycode-info.ui.';

function locationLabel(location: number): string {
  const key = String(location);
  return t(`${U}locations.${key}`) !== `${U}locations.${key}`
    ? t(`${U}locations.${key}`)
    : t(`${U}locations.unknown`);
}

interface Field {
  key: keyof KeyEventInfo;
  label: string;
  value: string;
}

const fields = computed<Field[]>(() => {
  const e = last.value;
  if (!e) return [];
  return [
    { key: 'key', label: 'key', value: e.key === ' ' ? t(U + 'space') : e.key },
    { key: 'code', label: 'code', value: e.code },
    { key: 'keyCode', label: 'keyCode', value: String(e.keyCode) },
    { key: 'which', label: 'which', value: String(e.which) },
    { key: 'charCode', label: 'charCode', value: String(e.charCode) },
    { key: 'location', label: 'location', value: `${e.location} - ${locationLabel(e.location)}` },
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
    return new Date(iso).toLocaleTimeString(locale.value);
  } catch {
    return iso;
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
          @click="togglePause"
        >
          <component :is="paused ? Play : Pause" :size="14" />
          <span>{{ paused ? t(U + 'resume') : t(U + 'pause') }}</span>
        </button>
        <button
          class="qt-btn qt-btn--ghost"
          type="button"
          @click="clear"
          :disabled="!last"
        >
          <Trash2 :size="14" />
          <span>{{ t('common.clear') }}</span>
        </button>
      </template>

      <div class="qt-row qt-row--center qt-hint" style="--qt-row-gap:6px;font-size:12px">
        <Keyboard :size="14" />
        <span>{{ t(U + 'eventsCaptured', count) }} · {{ paused ? t(U + 'statePaused') : t(U + 'stateListening') }}</span>
      </div>
    </ToolInput>

    <ToolOutput :title="t(U + 'outputTitle')">
      <div v-if="!last" class="keycode__empty">
        <Keyboard :size="36" />
        <p>{{ t(U + 'empty') }}</p>
      </div>

      <div v-else class="qt-stack" style="--qt-stack-gap:16px">
        <div class="qt-panel qt-row qt-row--center qt-row--between qt-row--nowrap" style="--qt-row-gap:12px">
          <div class="qt-mono keycode__hero-key" :title="last.key === ' ' ? t(U + 'space') : last.key">
            {{ last.key === ' ' ? t(U + 'space') : last.key || last.code }}
          </div>
          <div class="qt-row qt-row--center qt-row--nowrap" style="--qt-row-gap:10px;flex-shrink:0">
            <span class="qt-mono keycode__hero-summary">{{ summary }}</span>
            <button
              class="qt-btn qt-btn--ghost qt-btn--sm"
              type="button"
              @click="onCopyAll"
            >
              <component :is="copiedAll ? Check : Copy" :size="12" />
              <span>{{ copiedAll ? t('common.copiedFeedback') : t(U + 'copyJson') }}</span>
            </button>
          </div>
        </div>

        <div class="qt-row" style="--qt-row-gap:8px">
          <span
            v-for="m in modifiers"
            :key="m.id"
            class="keycode__mod"
            :class="{ 'keycode__mod--active': m.active }"
          >{{ m.label }}</span>
        </div>

        <dl class="qt-stack" style="--qt-stack-gap:2px;margin:0">
          <div v-for="f in fields" :key="f.key" class="keycode__row">
            <dt class="qt-label qt-mono">{{ f.label }}</dt>
            <dd class="qt-mono keycode__value" :title="f.value">{{ f.value }}</dd>
            <CopyButton :text="f.value" class="keycode__copy" />
          </div>
        </dl>
      </div>
    </ToolOutput>

    <ToolOutput v-if="history.length > 0" :title="t(U + 'historyTitle')">
      <ul class="qt-list qt-stack" style="--qt-stack-gap:2px">
        <li
          v-for="(e, i) in history"
          :key="`${e.eventTime}-${i}`"
          class="keycode__history-row"
          :class="{ 'keycode__history-row--current': i === 0 }"
        >
          <span class="keycode__history-time">{{ formatTime(e.timestamp) }}</span>
          <span class="keycode__history-summary">{{ summarizeEvent(e) }}</span>
          <span class="keycode__history-code">{{ e.code || '-' }}</span>
          <span class="qt-muted" style="text-align:right">{{ e.keyCode }}</span>
        </li>
      </ul>
    </ToolOutput>
  </div>
</template>

<style scoped>
/* Kept scoped: patterns unique to this tool (no generic utility). */

/* Centered empty state — big icon + prompt. */
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
/* Big pressed-key readout (font via .qt-mono). */
.keycode__hero-key {
  font-size: 22px;
  font-weight: 700;
  color: var(--qt-text);
  word-break: break-word;
  min-width: 0;
}
.keycode__hero-summary {
  font-size: 12.5px;
  color: var(--qt-muted);
}
/* Modifier pills — display-only, solid-accent when active. */
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
/* Field rows — 3-col grid (key / value / copy) with hover reveal. */
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
.keycode__value {
  margin: 0;
  font-size: 13.5px;
  color: var(--qt-text);
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
/* History rows — 4-col grid (time / summary / code / keyCode). */
.keycode__history-row {
  display: grid;
  grid-template-columns: 90px 1fr 130px 60px;
  align-items: center;
  gap: 10px;
  padding: 6px 8px;
  border-radius: var(--qt-radius-sm);
  font-size: 12.5px;
  font-family: var(--qt-font-mono);
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
