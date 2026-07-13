<script setup lang="ts">
/**
 * RandomPortGenerator — generate cryptographically secure random network
 * ports.
 *
 * Configurable range (min/max, 0-65535), an "exclude well-known ports (<1024)"
 * toggle, quantity (1-1000), and a "unique" toggle (no duplicates).
 * Randomness comes from `crypto.getRandomValues()` with rejection sampling
 * (no modulo bias).
 *
 * Works in embed mode: receives `input` PostMessages to pre-fill the config
 * (accepts `min`/`rangeMin`, `max`/`rangeMax`, `excludeWellKnown`,
 * `quantity`/`count`, `unique`) and sends `output` PostMessages whenever the
 * generated ports change.
 */
import { computed, onMounted } from 'vue';
import { RefreshCw, AlertCircle } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import CopyButton from '@/components/CopyButton.vue';
import {
  useRandomPortGenerator,
  PORT_MIN,
  PORT_MAX,
  WELL_KNOWN_BOUNDARY,
  MIN_QUANTITY,
  MAX_QUANTITY,
} from './useRandomPortGenerator';

const {
  config,
  ports,
  error,
  isValid,
  effectiveRange,
  regenerate,
} = useRandomPortGenerator();

/** All ports joined by newlines — used for the "copy all" button. */
const allPortsText = computed(() => ports.value.join('\n'));

/** Human-readable description of the effective range after normalisation. */
const rangeDescription = computed(() => {
  const r = effectiveRange.value;
  const unique = config.value.unique ? 'unique' : 'with replacement';
  return `${r.min}–${r.max} (${r.span} port${r.span === 1 ? '' : 's'}, ${unique})`;
});

function onMinInput(e: Event): void {
  const v = Number((e.target as HTMLInputElement).value);
  config.value.min = Number.isNaN(v) ? PORT_MIN : v;
}
function onMaxInput(e: Event): void {
  const v = Number((e.target as HTMLInputElement).value);
  config.value.max = Number.isNaN(v) ? PORT_MAX : v;
}
function onQuantityInput(e: Event): void {
  const v = Number((e.target as HTMLInputElement).value);
  config.value.quantity = Number.isNaN(v) ? MIN_QUANTITY : v;
}

/** Quick-pick range presets. */
const PRESETS: { label: string; min: number; max: number; exclude: boolean }[] =
  [
    { label: 'All (0-65535)', min: 0, max: 65535, exclude: false },
    { label: 'Registered (1024-49151)', min: 1024, max: 49151, exclude: true },
    { label: 'Dynamic (49152-65535)', min: 49152, max: 65535, exclude: true },
    { label: 'Ephemeral (32768-60999)', min: 32768, max: 60999, exclude: true },
  ];

function applyPreset(p: (typeof PRESETS)[number]): void {
  config.value.min = p.min;
  config.value.max = p.max;
  config.value.excludeWellKnown = p.exclude;
  regenerate();
}

// Generate an initial set on mount so the output area is never empty.
onMounted(() => {
  if (ports.value.length === 0 && isValid.value) regenerate();
});
</script>

<template>
  <div class="port-gen">
    <ToolInput
      title="Configuration"
      description="Cryptographically secure random ports (Web Crypto API)."
    >
      <template #actions>
        <button
          class="port-gen__generate"
          type="button"
          @click="regenerate"
        >
          <RefreshCw :size="14" />
          <span>Generate</span>
        </button>
      </template>

      <div class="port-gen__presets">
        <button
          v-for="p in PRESETS"
          :key="p.label"
          type="button"
          class="port-gen__preset"
          @click="applyPreset(p)"
        >
          {{ p.label }}
        </button>
      </div>

      <div class="port-gen__row">
        <label class="port-gen__field">
          <span class="port-gen__label">Minimum port</span>
          <input
            class="port-gen__input"
            type="number"
            :min="PORT_MIN"
            :max="PORT_MAX"
            :value="config.min"
            @input="onMinInput"
          />
        </label>
        <label class="port-gen__field">
          <span class="port-gen__label">Maximum port</span>
          <input
            class="port-gen__input"
            type="number"
            :min="PORT_MIN"
            :max="PORT_MAX"
            :value="config.max"
            @input="onMaxInput"
          />
        </label>
        <label class="port-gen__field">
          <span class="port-gen__label">Quantity</span>
          <input
            class="port-gen__input"
            type="number"
            :min="MIN_QUANTITY"
            :max="MAX_QUANTITY"
            :value="config.quantity"
            @input="onQuantityInput"
          />
        </label>
      </div>

      <fieldset class="port-gen__fieldset">
        <legend class="port-gen__legend">Options</legend>
        <div class="port-gen__checks">
          <label class="port-gen__check">
            <input
              type="checkbox"
              :checked="config.excludeWellKnown"
              @change="
                config.excludeWellKnown = ($event.target as HTMLInputElement).checked
              "
            />
            <span>Exclude well-known ports (&lt;{{ WELL_KNOWN_BOUNDARY }})</span>
          </label>
          <label class="port-gen__check">
            <input
              type="checkbox"
              :checked="config.unique"
              @change="
                config.unique = ($event.target as HTMLInputElement).checked
              "
            />
            <span>Unique (no duplicates)</span>
          </label>
        </div>
      </fieldset>

      <p class="port-gen__range-info">
        <span class="port-gen__range-label">Effective range</span>
        <code class="port-gen__range-value">{{ rangeDescription }}</code>
      </p>
    </ToolInput>

    <ToolOutput
      title="Generated ports"
      :description="
        ports.length
          ? `${ports.length} port${ports.length === 1 ? '' : 's'}`
          : ''
      "
      :copy-text="allPortsText"
      copy-label="Copy all"
    >
      <p v-if="error" class="port-gen__error">
        <AlertCircle :size="14" />
        <span>{{ error }}</span>
      </p>
      <p v-else-if="ports.length === 0" class="port-gen__empty">
        No ports yet — click <strong>Generate</strong>.
      </p>
      <ul v-else class="port-gen__list">
        <li v-for="(p, i) in ports" :key="i" class="port-gen__port">
          <code class="port-gen__port-text">{{ p }}</code>
          <span
            class="port-gen__port-badge"
            :class="{
              'port-gen__port-badge--well-known': p < WELL_KNOWN_BOUNDARY,
              'port-gen__port-badge--registered':
                p >= WELL_KNOWN_BOUNDARY && p < 49152,
              'port-gen__port-badge--dynamic': p >= 49152,
            }"
          >
            {{
              p < WELL_KNOWN_BOUNDARY
                ? 'well-known'
                : p < 49152
                  ? 'registered'
                  : 'dynamic'
            }}
          </span>
          <CopyButton :text="String(p)" label="Copy" icon-only />
        </li>
      </ul>
    </ToolOutput>
  </div>
</template>

<style scoped>
.port-gen {
  display: flex;
  flex-direction: column;
  gap: var(--qt-gap);
  max-width: var(--qt-max-content);
  margin: 0 auto;
}
.port-gen__presets {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}
.port-gen__preset {
  padding: 5px 11px;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: 999px;
  color: var(--qt-text);
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  transition:
    border-color 0.15s ease,
    color 0.15s ease;
}
.port-gen__preset:hover {
  border-color: var(--qt-accent);
  color: var(--qt-accent);
}
.port-gen__row {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}
.port-gen__field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1 1 120px;
}
.port-gen__label {
  font-size: 12.5px;
  color: var(--qt-muted);
  font-weight: 600;
}
.port-gen__input {
  width: 100%;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  color: var(--qt-text);
  font: inherit;
  font-size: 14px;
  padding: 8px 10px;
  font-variant-numeric: tabular-nums;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;
  will-change: border-color;
}
.port-gen__input:focus {
  border-color: var(--qt-accent);
  outline: none;
  box-shadow: 0 0 0 2px oklch(from var(--qt-accent) 90% c h / 0.25);
}
.port-gen__fieldset {
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  padding: 10px 12px;
  margin: 12px 0 0 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.port-gen__legend {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--qt-muted);
  padding: 0 6px;
}
.port-gen__checks {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 6px 12px;
}
.port-gen__check {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13.5px;
  color: var(--qt-text);
  cursor: pointer;
}
.port-gen__check input[type='checkbox'] {
  accent-color: var(--qt-accent);
  cursor: pointer;
}
.port-gen__range-info {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin: 12px 0 0 0;
  font-size: 12.5px;
  color: var(--qt-muted);
}
.port-gen__range-label {
  font-weight: 600;
}
.port-gen__range-value {
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas,
    monospace;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  padding: 4px 8px;
  color: var(--qt-text);
  font-variant-numeric: tabular-nums;
}
.port-gen__generate {
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
.port-gen__generate:hover:not(:disabled) {
  transform: translateY(-1px);
}
.port-gen__generate:active:not(:disabled) {
  transform: translateY(0);
}
.port-gen__generate:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.port-gen__error {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: var(--qt-danger);
  font-size: 13.5px;
}
.port-gen__empty {
  margin: 0;
  color: var(--qt-muted);
  font-size: 13.5px;
}
.port-gen__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.port-gen__port {
  display: flex;
  align-items: center;
  gap: 10px;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  padding: 8px 10px;
}
.port-gen__port-text {
  flex: 0 0 auto;
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas,
    monospace;
  font-size: 14px;
  font-weight: 600;
  color: var(--qt-text);
  font-variant-numeric: tabular-nums;
  min-width: 64px;
}
.port-gen__port-badge {
  flex: 1 1 auto;
  font-size: 10.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid var(--qt-border);
  color: var(--qt-muted);
  white-space: nowrap;
}
.port-gen__port-badge--well-known {
  color: var(--qt-warning);
  border-color: oklch(from var(--qt-warning) 60% c h);
}
.port-gen__port-badge--registered {
  color: var(--qt-accent);
  border-color: oklch(from var(--qt-accent) 60% c h);
}
.port-gen__port-badge--dynamic {
  color: var(--qt-success);
  border-color: oklch(from var(--qt-success) 60% c h);
}
</style>
