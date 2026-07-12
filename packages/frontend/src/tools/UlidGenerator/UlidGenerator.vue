<script setup lang="ts">
/**
 * UlidGenerator — generate ULIDs (Universally Unique Lexicographically Sortable
 * Identifiers, https://github.com/ulid/spec).
 *
 *   - 26-character Crockford Base32 string.
 *   - First 10 chars encode a 48-bit millisecond timestamp (sortable).
 *   - Last 16 chars are random (cryptographically secure — we inject a PRNG
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

/** All ULIDs joined by newlines — used for the "copy all" button. */
const allUlidsText = computed(() => ulids.value.join('\n'));

/** Whether the Generate button should be enabled. */
const canGenerate = computed(() => !generating.value);

const MODE_OPTIONS: {
  value: UlidMode;
  label: string;
  hint: string;
  icon: typeof Shuffle;
}[] = [
  { value: 'standard', label: 'Standard', hint: 'independent random', icon: Shuffle },
  { value: 'monotonic', label: 'Monotonic', hint: 'lex-increasing within a ms', icon: ArrowUpWideNarrow },
];

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
  <div class="ulid-gen">
    <ToolInput
      title="Configuration"
      description="ULIDs are 26-char Crockford Base32 strings — 10 timestamp chars + 16 random chars. Sortable, 128-bit compatible."
    >
      <template #actions>
        <button
          class="ulid-gen__generate"
          type="button"
          :disabled="!canGenerate"
          @click="generate"
        >
          <Loader2 v-if="generating" :size="14" class="ulid-gen__spin" />
          <RefreshCw v-else :size="14" />
          <span>{{ generating ? 'Generating…' : 'Generate' }}</span>
        </button>
      </template>

      <div class="ulid-gen__field">
        <span class="ulid-gen__label">Mode</span>
        <div class="ulid-gen__modes" role="radiogroup" aria-label="ULID generation mode">
          <button
            v-for="opt in MODE_OPTIONS"
            :key="opt.value"
            type="button"
            role="radio"
            :aria-checked="mode === opt.value"
            class="ulid-gen__mode"
            :class="{ 'ulid-gen__mode--active': mode === opt.value }"
            :title="opt.hint"
            @click="mode = opt.value"
          >
            <component :is="opt.icon" :size="14" />
            <span class="ulid-gen__mode-label">{{ opt.label }}</span>
            <span class="ulid-gen__mode-hint">{{ opt.hint }}</span>
          </button>
        </div>
      </div>

      <label class="ulid-gen__field">
        <span class="ulid-gen__label">Quantity</span>
        <input
          class="ulid-gen__input"
          type="number"
          :min="MIN_QUANTITY"
          :max="MAX_QUANTITY"
          :value="quantity"
          @input="onQuantityInput"
        />
      </label>

      <div class="ulid-gen__toggles">
        <label class="ulid-gen__toggle">
          <input
            type="checkbox"
            :checked="uppercase"
            @change="uppercase = ($event.target as HTMLInputElement).checked"
          />
          <span>Uppercase</span>
        </label>
      </div>
    </ToolInput>

    <ToolOutput
      title="Generated ULIDs"
      :description="ulids.length ? `${ulids.length} ULID${ulids.length === 1 ? '' : 's'} (${mode})` : ''"
      :copy-text="allUlidsText"
      copy-label="Copy all"
    >
      <p v-if="error" class="ulid-gen__error">
        <AlertCircle :size="14" />
        <span>{{ error }}</span>
      </p>
      <p v-else-if="ulids.length === 0" class="ulid-gen__empty">
        No ULIDs yet — click <strong>Generate</strong>.
      </p>
      <ul v-else class="ulid-gen__list">
        <li v-for="(u, i) in ulids" :key="i" class="ulid-gen__ulid">
          <span class="ulid-gen__idx">{{ i + 1 }}</span>
          <div class="ulid-gen__ulid-body">
            <code class="ulid-gen__ulid-text">{{ u }}</code>
            <span
              v-if="timestamps[i] !== undefined"
              class="ulid-gen__ts"
              :title="formatTimestamp(timestamps[i]!)"
            >
              {{ formatTimestamp(timestamps[i]!) }}
            </span>
          </div>
          <CopyButton :text="u" label="Copy" icon-only />
        </li>
      </ul>
    </ToolOutput>
  </div>
</template>

<style scoped>
.ulid-gen {
  display: flex;
  flex-direction: column;
  gap: var(--qt-gap);
  max-width: var(--qt-max-content);
  margin: 0 auto;
}
.ulid-gen__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.ulid-gen__label {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--qt-muted);
}
.ulid-gen__input {
  width: 100%;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  color: var(--qt-text);
  font: inherit;
  font-size: 14px;
  padding: 9px 11px;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;
  will-change: border-color;
}
.ulid-gen__input:focus {
  border-color: var(--qt-accent);
  outline: none;
  box-shadow: 0 0 0 2px oklch(from var(--qt-accent) 90% c h / 0.25);
}
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
  will-change: border-color;
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
.ulid-gen__toggles {
  display: flex;
  gap: 18px;
  flex-wrap: wrap;
}
.ulid-gen__toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13.5px;
  color: var(--qt-text);
  cursor: pointer;
}
.ulid-gen__toggle input[type='checkbox'] {
  accent-color: var(--qt-accent);
  cursor: pointer;
}
.ulid-gen__generate {
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
.ulid-gen__generate:hover:not(:disabled) {
  transform: translateY(-1px);
}
.ulid-gen__generate:active:not(:disabled) {
  transform: translateY(0);
}
.ulid-gen__generate:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.ulid-gen__spin {
  animation: ulid-gen-spin 0.8s linear infinite;
}
@keyframes ulid-gen-spin {
  to {
    transform: rotate(360deg);
  }
}
.ulid-gen__error {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: var(--qt-danger);
  font-size: 13.5px;
}
.ulid-gen__empty {
  margin: 0;
  color: var(--qt-muted);
  font-size: 13.5px;
}
.ulid-gen__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 60vh;
  overflow-y: auto;
}
.ulid-gen__ulid {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  padding: 7px 10px;
}
.ulid-gen__idx {
  flex: 0 0 auto;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  color: var(--qt-muted);
  min-width: 28px;
  text-align: right;
}
.ulid-gen__ulid-body {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.ulid-gen__ulid-text {
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
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
