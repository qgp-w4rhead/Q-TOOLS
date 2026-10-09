<script setup lang="ts">
/**
 * RandomPortGenerator - generate cryptographically secure random network
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
import { useI18n } from 'vue-i18n';
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

const { t } = useI18n();
const U = 'tools.random-port-generator.ui.';

/** All ports joined by newlines - used for the "copy all" button. */
const allPortsText = computed(() => ports.value.join('\n'));

/** Human-readable description of the effective range after normalisation. */
const rangeDescription = computed(() => {
  const r = effectiveRange.value;
  const mode = config.value.unique ? t(U + 'rangeUnique') : t(U + 'rangeReplace');
  const key = r.span === 1 ? 'rangeDescOne' : 'rangeDesc';
  return t(U + key, { min: r.min, max: r.max, n: r.span, mode });
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
const PRESETS = computed<{ label: string; min: number; max: number; exclude: boolean }[]>(() => [
  { label: t(U + 'presetAll'), min: 0, max: 65535, exclude: false },
  { label: t(U + 'presetRegistered'), min: 1024, max: 49151, exclude: true },
  { label: t(U + 'presetDynamic'), min: 49152, max: 65535, exclude: true },
  { label: t(U + 'presetEphemeral'), min: 32768, max: 60999, exclude: true },
]);

const outDesc = computed(() =>
  ports.value.length
    ? t(ports.value.length === 1 ? U + 'outDescOne' : U + 'outDesc', { n: ports.value.length })
    : '',
);

function applyPreset(p: { label: string; min: number; max: number; exclude: boolean }): void {
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
  <div class="qt-tool">
    <ToolInput
      :title="t(U + 'inputTitle')"
      :description="t(U + 'desc')"
    >
      <template #actions>
        <button
          class="qt-btn qt-btn--primary"
          type="button"
          @click="regenerate"
        >
          <RefreshCw :size="14" />
          <span>{{ t(U + 'generate') }}</span>
        </button>
      </template>

      <div class="qt-row" style="--qt-row-gap:8px;margin-bottom:12px">
        <button
          v-for="p in PRESETS"
          :key="p.label"
          type="button"
          class="qt-chip"
          @click="applyPreset(p)"
        >
          {{ p.label }}
        </button>
      </div>

      <div class="qt-row" style="--qt-row-gap:12px">
        <label class="qt-field qt-field--grow" style="--qt-field-min:120px">
          <span class="qt-label">{{ t(U + 'minPort') }}</span>
          <input
            class="qt-input"
            style="font-variant-numeric:tabular-nums"
            type="number"
            :min="PORT_MIN"
            :max="PORT_MAX"
            :value="config.min"
            @input="onMinInput"
          />
        </label>
        <label class="qt-field qt-field--grow" style="--qt-field-min:120px">
          <span class="qt-label">{{ t(U + 'maxPort') }}</span>
          <input
            class="qt-input"
            style="font-variant-numeric:tabular-nums"
            type="number"
            :min="PORT_MIN"
            :max="PORT_MAX"
            :value="config.max"
            @input="onMaxInput"
          />
        </label>
        <label class="qt-field qt-field--grow" style="--qt-field-min:120px">
          <span class="qt-label">{{ t(U + 'quantity') }}</span>
          <input
            class="qt-input"
            style="font-variant-numeric:tabular-nums"
            type="number"
            :min="MIN_QUANTITY"
            :max="MAX_QUANTITY"
            :value="config.quantity"
            @input="onQuantityInput"
          />
        </label>
      </div>

      <fieldset class="port-gen__fieldset">
        <legend class="port-gen__legend">{{ t(U + 'options') }}</legend>
        <div class="qt-grid" style="--qt-grid-min:220px;--qt-grid-gap:6px 12px">
          <label class="qt-check">
            <input
              type="checkbox"
              :checked="config.excludeWellKnown"
              @change="
                config.excludeWellKnown = ($event.target as HTMLInputElement).checked
              "
            />
            <span>{{ t(U + 'excludeWellKnown', { n: WELL_KNOWN_BOUNDARY }) }}</span>
          </label>
          <label class="qt-check">
            <input
              type="checkbox"
              :checked="config.unique"
              @change="
                config.unique = ($event.target as HTMLInputElement).checked
              "
            />
            <span>{{ t(U + 'unique') }}</span>
          </label>
        </div>
      </fieldset>

      <p class="qt-row qt-row--center" style="--qt-row-gap:10px;margin:12px 0 0;font-size:12.5px;color:var(--qt-muted)">
        <span style="font-weight:600">{{ t(U + 'effectiveRange') }}</span>
        <code class="qt-kbd" style="padding:4px 8px;font-variant-numeric:tabular-nums">{{ rangeDescription }}</code>
      </p>
    </ToolInput>

    <ToolOutput
      :title="t(U + 'outTitle')"
      :description="outDesc"
      :copy-text="allPortsText"
      :copy-label="t(U + 'copyAll')"
    >
      <p v-if="error" class="qt-alert qt-alert--error">
        <AlertCircle :size="14" />
        <span>{{ error }}</span>
      </p>
      <p v-else-if="ports.length === 0" class="qt-alert qt-alert--empty">
        {{ t(U + 'alertEmpty') }}
      </p>
      <ul v-else class="qt-list qt-stack" style="--qt-stack-gap:6px">
        <li v-for="(p, i) in ports" :key="i" class="qt-result-row">
          <code class="qt-value qt-value--sm" style="min-width:64px">{{ p }}</code>
          <span
            class="qt-badge"
            style="flex:1;text-transform:uppercase"
            :class="{
              'qt-badge--warn': p < WELL_KNOWN_BOUNDARY,
              'qt-badge--info':
                p >= WELL_KNOWN_BOUNDARY && p < 49152,
              'qt-badge--success': p >= 49152,
            }"
          >
            {{
              p < WELL_KNOWN_BOUNDARY
                ? t(U + 'badgeWellKnown')
                : p < 49152
                  ? t(U + 'badgeRegistered')
                  : t(U + 'badgeDynamic')
            }}
          </span>
          <CopyButton :text="String(p)" :label="t('common.copy')" icon-only />
        </li>
      </ul>
    </ToolOutput>
  </div>
</template>

<style scoped>
/* Kept scoped: patterns unique to this tool (no generic utility). */

/* Options group — bordered fieldset + legend caption. */
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
</style>
