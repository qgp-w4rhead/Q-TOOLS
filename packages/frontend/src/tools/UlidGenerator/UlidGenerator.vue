<script setup lang="ts">
/**
 * UlidGenerator - generate ULIDs (Universally Unique Lexicographically Sortable
 * Identifiers, https://github.com/ulid/spec).
 *
 *   - 26-character Crockford Base32 string.
 *   - First 10 chars encode a 48-bit millisecond timestamp (sortable).
 *   - Last 16 chars are random (cryptographically secure - we inject a PRNG
 *     backed by `crypto.getRandomValues`).
 *
 * Two modes:
 *   - standard: each ULID is independent.
 *   - monotonic: within the same millisecond, successive ULIDs are guaranteed
 *     to be lexicographically increasing (uses `ulid`'s `monotonicFactory`).
 *
 * Configurable quantity (1-10000), uppercase option. Per-ULID copy + copy-all.
 * Each generated row also shows the decoded timestamp.
 *
 * Works in embed mode: receives `input` PostMessages to set mode/quantity/
 * uppercase and sends `output` PostMessages with the generated ULIDs.
 */
import { computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { RefreshCw, AlertCircle, Loader2, ArrowUpWideNarrow, Shuffle } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import CopyButton from '@/components/CopyButton.vue';
import {
  useUlidGenerator,
  MIN_QUANTITY,
  MAX_QUANTITY,
  type UlidMode,
} from './useUlidGenerator';

const { t } = useI18n();

const {
  mode,
  quantity,
  uppercase,
  ulids,
  timestamps,
  generating,
  error,
  generate,
} = useUlidGenerator();

/** All ULIDs joined by newlines - used for the "copy all" button. */
const allUlidsText = computed(() => ulids.value.join('\n'));

/** Whether the Generate button should be enabled. */
const canGenerate = computed(() => !generating.value);

const MODE_OPTIONS: {
  value: UlidMode;
  labelKey: string;
  hintKey: string;
  icon: typeof Shuffle;
}[] = [
  { value: 'standard', labelKey: 'modeStandard', hintKey: 'modeStandardHint', icon: Shuffle },
  { value: 'monotonic', labelKey: 'modeMonotonic', hintKey: 'modeMonotonicHint', icon: ArrowUpWideNarrow },
];

/** Localized mode label (used in the output description too). */
const modeLabel = computed(() => t(`tools.ulid-generator.ui.${mode.value === 'standard' ? 'modeStandard' : 'modeMonotonic'}`));

/** Format a millisecond timestamp as an ISO string for display. */
function formatTimestamp(ts: number): string {
  try {
    return new Date(ts).toISOString();
  } catch {
    return String(ts);
  }
}

function onQuantityInput(e: Event): void {
  const v = Number((e.target as HTMLInputElement).value);
  if (Number.isFinite(v)) {
    quantity.value = Math.max(MIN_QUANTITY, Math.min(MAX_QUANTITY, Math.floor(v)));
  }
}

// Generate an initial ULID on mount so the output area is never empty.
onMounted(() => {
  if (ulids.value.length === 0 && canGenerate.value) void generate();
});
</script>

<template>
  <div class="qt-tool">
    <ToolInput
      :title="t('common.configuration')"
      :description="t('tools.ulid-generator.ui.desc')"
    >
      <template #actions>
        <button
          class="qt-btn qt-btn--primary"
          type="button"
          :disabled="!canGenerate"
          @click="generate"
        >
          <Loader2 v-if="generating" :size="14" class="qt-spin" />
          <RefreshCw v-else :size="14" />
          <span>{{ generating ? t('common.generating') : t('common.generate') }}</span>
        </button>
      </template>

      <div class="qt-field">
        <span class="qt-label">{{ t('tools.ulid-generator.ui.mode') }}</span>
        <div class="ulid-gen__modes" role="radiogroup" :aria-label="t('tools.ulid-generator.ui.modeLabel')">
          <button
            v-for="opt in MODE_OPTIONS"
            :key="opt.value"
            type="button"
            role="radio"
            :aria-checked="mode === opt.value"
            class="ulid-gen__mode"
            :class="{ 'ulid-gen__mode--active': mode === opt.value }"
            :title="t(`tools.ulid-generator.ui.${opt.hintKey}`)"
            @click="mode = opt.value"
          >
            <component :is="opt.icon" :size="14" />
            <span class="ulid-gen__mode-label">{{ t(`tools.ulid-generator.ui.${opt.labelKey}`) }}</span>
            <span class="ulid-gen__mode-hint">{{ t(`tools.ulid-generator.ui.${opt.hintKey}`) }}</span>
          </button>
        </div>
      </div>

      <label class="qt-field">
        <span class="qt-label">{{ t('common.quantity') }}</span>
        <input
          class="qt-input"
          type="number"
          :min="MIN_QUANTITY"
          :max="MAX_QUANTITY"
          :value="quantity"
          @input="onQuantityInput"
        />
      </label>

      <div class="qt-row" style="--qt-row-gap:18px">
        <label class="qt-check">
          <input
            type="checkbox"
            :checked="uppercase"
            @change="uppercase = ($event.target as HTMLInputElement).checked"
          />
          <span>{{ t('common.uppercase') }}</span>
        </label>
      </div>
    </ToolInput>

    <ToolOutput
      :title="t('tools.ulid-generator.ui.outputTitle')"
      :description="ulids.length ? t('tools.ulid-generator.ui.outputDesc', { n: ulids.length, mode: modeLabel }, ulids.length) : ''"
      :copy-text="allUlidsText"
      :copy-label="t('common.copyAll')"
    >
      <p v-if="error" class="qt-alert qt-alert--error">
        <AlertCircle :size="14" />
        <span>{{ error }}</span>
      </p>
      <p v-else-if="ulids.length === 0" class="qt-alert qt-alert--empty">
        {{ t('tools.ulid-generator.ui.empty') }}
      </p>
      <ul v-else class="qt-list qt-stack ulid-gen__list" style="--qt-stack-gap:6px">
        <li v-for="(u, i) in ulids" :key="i" class="qt-result-row">
          <span class="ulid-gen__idx">{{ i + 1 }}</span>
          <div class="ulid-gen__ulid-body">
            <code class="qt-mono ulid-gen__ulid-text">{{ u }}</code>
            <span
              v-if="timestamps[i] !== undefined"
              class="ulid-gen__ts"
              :title="formatTimestamp(timestamps[i]!)"
            >
              {{ formatTimestamp(timestamps[i]!) }}
            </span>
          </div>
          <CopyButton :text="u" :label="t('common.copy')" icon-only />
        </li>
      </ul>
    </ToolOutput>
  </div>
</template>

<style scoped>
/* Kept scoped: patterns unique to this tool (no generic utility). */

/* Mode picker — fixed 2-col grid of selectable cards. */
.ulid-gen__modes {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 6px;
}
.ulid-gen__mode {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  color: var(--qt-muted);
  font: inherit;
  padding: 10px 12px;
  cursor: pointer;
  transition:
    border-color 0.15s ease,
    background-color 0.15s ease,
    color 0.15s ease;
}
.ulid-gen__mode:hover {
  border-color: var(--qt-accent);
  color: var(--qt-text);
}
.ulid-gen__mode--active {
  border-color: var(--qt-accent);
  background: oklch(from var(--qt-accent) 95% c h / 0.15);
  color: var(--qt-accent);
}
.ulid-gen__mode-label {
  font-size: 14px;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 6px;
}
.ulid-gen__mode-hint {
  font-size: 10.5px;
  opacity: 0.85;
}
/* Scrollable ULID list. */
.ulid-gen__list {
  max-height: 60vh;
  overflow-y: auto;
}
/* Row index. */
.ulid-gen__idx {
  flex: 0 0 auto;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  color: var(--qt-muted);
  min-width: 28px;
  text-align: right;
}
/* ULID body — value + timestamp column. */
.ulid-gen__ulid-body {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.ulid-gen__ulid-text {
  font-size: 13px;
  color: var(--qt-text);
  word-break: break-all;
  white-space: pre-wrap;
}
.ulid-gen__ts {
  font-size: 10.5px;
  color: var(--qt-muted);
  font-variant-numeric: tabular-nums;
}
</style>
