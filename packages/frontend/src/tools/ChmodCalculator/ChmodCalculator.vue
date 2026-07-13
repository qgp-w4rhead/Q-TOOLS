<script setup lang="ts">
/**
 * ChmodCalculator — interactive Unix file permission calculator.
 *
 * Three permission scopes (owner / group / other) × three bits (read / write /
 * execute) as checkboxes, plus the three special bits (setuid / setgid /
 * sticky). Outputs the numeric octal mode (e.g. `755` or `4755`) and the
 * 9-char symbolic string (e.g. `rwxr-xr-x`). A raw-input field accepts either
 * a numeric or symbolic mode and updates the checkboxes accordingly.
 *
 * Works in embed mode: receives `input` PostMessages with `{ octal }`,
 * `{ numeric }`, `{ symbolic }`, or `{ permissions: { ... } }` and sends
 * `output` PostMessages with `{ octal, numeric, symbolic, description,
 * permissions }` whenever the mode changes.
 */
import { ref } from 'vue';
import { AlertCircle, RotateCcw } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import {
  useChmodCalculator,
  SCOPE_ORDER,
  BIT_ORDER,
  SCOPE_LABEL,
  BIT_LABEL,
  validateOctal,
  validateSymbolic,
  type PermissionScope,
  type SpecialBit,
} from './useChmodCalculator';

const {
  permissions,
  octal,
  symbolic,
  description,
  toggleBit,
  toggleSpecial,
  loadOctal,
  loadSymbolic,
  reset,
} = useChmodCalculator();

/** Special bits metadata for rendering. */
const SPECIAL_BITS: { key: SpecialBit; label: string; hint: string }[] = [
  { key: 'setuid', label: 'setuid', hint: 'Run executable as owner (4000)' },
  { key: 'setgid', label: 'setgid', hint: 'Run executable as group (2000)' },
  { key: 'sticky', label: 'sticky', hint: 'Only owner deletes files in dir (1000)' },
];

/** Raw input field state. */
const rawInput = ref('');
const rawError = ref('');

/** Apply the raw input — auto-detect numeric vs symbolic. */
function applyRaw(): void {
  const trimmed = rawInput.value.trim();
  if (!trimmed) {
    rawError.value = 'Enter an octal (e.g. 755) or symbolic (e.g. rwxr-xr-x) mode.';
    return;
  }
  // Try numeric first (only 0-7 digits).
  if (/^[0-7]+$/.test(trimmed)) {
    const v = validateOctal(trimmed);
    if (!v.ok) {
      rawError.value = v.message;
      return;
    }
    if (loadOctal(trimmed)) {
      rawError.value = '';
      return;
    }
    rawError.value = 'Invalid octal mode.';
    return;
  }
  // Otherwise treat as symbolic.
  const v = validateSymbolic(trimmed);
  if (!v.ok) {
    rawError.value = v.message;
    return;
  }
  if (loadSymbolic(trimmed)) {
    rawError.value = '';
    return;
  }
  rawError.value = 'Invalid symbolic mode.';
}

/** Per-scope digit for display (the octal digit under each column header). */
function scopeDigit(scope: PermissionScope): string {
  const s = permissions.value[scope];
  let d = 0;
  if (s.read) d += 4;
  if (s.write) d += 2;
  if (s.execute) d += 1;
  return String(d);
}

/** Whether any special bit is set (drives the 4-digit octal display). */
function hasSpecial(): boolean {
  return permissions.value.setuid || permissions.value.setgid || permissions.value.sticky;
}

/** Quick-pick presets. */
const PRESETS: { label: string; octal: string }[] = [
  { label: '755', octal: '755' },
  { label: '644', octal: '644' },
  { label: '777', octal: '777' },
  { label: '600', octal: '600' },
  { label: '700', octal: '700' },
  { label: '444', octal: '444' },
  { label: '666', octal: '666' },
  { label: '000', octal: '000' },
];

function applyPreset(o: string): void {
  if (loadOctal(o)) {
    rawError.value = '';
    rawInput.value = '';
  }
}
</script>

<template>
  <div class="chmod">
    <ToolInput
      title="Permissions"
      description="Toggle read / write / execute for each scope. Special bits are optional."
    >
      <template #actions>
        <button class="chmod__reset" type="button" @click="reset">
          <RotateCcw :size="14" />
          <span>Reset</span>
        </button>
      </template>

      <!-- Quick presets -->
      <div class="chmod__presets">
        <span class="chmod__presets-label">Presets:</span>
        <button
          v-for="p in PRESETS"
          :key="p.octal"
          type="button"
          class="chmod__preset"
          :class="{ 'chmod__preset--active': octal === p.octal && !hasSpecial() }"
          @click="applyPreset(p.octal)"
        >
          {{ p.label }}
        </button>
      </div>

      <!-- 3×3 checkbox grid -->
      <div class="chmod__grid" role="group" aria-label="Permission matrix">
        <div class="chmod__grid-head"></div>
        <div
          v-for="bit in BIT_ORDER"
          :key="bit"
          class="chmod__col-head"
        >
          {{ BIT_LABEL[bit] }}
        </div>

        <template v-for="scope in SCOPE_ORDER" :key="scope">
          <div class="chmod__row-head">
            <span class="chmod__scope-name">{{ SCOPE_LABEL[scope] }}</span>
            <code class="chmod__scope-digit">{{ scopeDigit(scope) }}</code>
          </div>
          <label
            v-for="bit in BIT_ORDER"
            :key="bit"
            class="chmod__cell"
            :class="{ 'chmod__cell--on': permissions[scope][bit] }"
          >
            <input
              type="checkbox"
              :checked="permissions[scope][bit]"
              @change="toggleBit(scope, bit)"
            />
            <span class="chmod__cell-mark">{{ permissions[scope][bit] ? '✓' : '' }}</span>
          </label>
        </template>
      </div>

      <!-- Special bits -->
      <details class="chmod__special">
        <summary class="chmod__special-summary">Special bits (setuid / setgid / sticky)</summary>
        <div class="chmod__special-grid">
          <label
            v-for="sb in SPECIAL_BITS"
            :key="sb.key"
            class="chmod__special-row"
            :class="{ 'chmod__special-row--on': permissions[sb.key] }"
          >
            <input
              type="checkbox"
              :checked="permissions[sb.key]"
              @change="toggleSpecial(sb.key)"
            />
            <span class="chmod__special-label">{{ sb.label }}</span>
            <span class="chmod__special-hint">{{ sb.hint }}</span>
          </label>
        </div>
      </details>

      <!-- Raw input -->
      <details class="chmod__raw">
        <summary class="chmod__raw-summary">Paste numeric or symbolic mode</summary>
        <div class="chmod__raw-row">
          <input
            v-model="rawInput"
            class="chmod__raw-input"
            type="text"
            placeholder="755 or rwxr-xr-x"
            @keydown.enter.prevent="applyRaw"
          />
          <button class="chmod__apply" type="button" @click="applyRaw">
            Apply
          </button>
        </div>
        <p v-if="rawError" class="chmod__raw-error">
          <AlertCircle :size="14" />
          <span>{{ rawError }}</span>
        </p>
      </details>
    </ToolInput>

    <ToolOutput
      title="Result"
      :copy-text="octal"
      copy-label="Copy octal"
    >
      <div class="chmod__results">
        <div class="chmod__result">
          <span class="chmod__result-label">Numeric (octal)</span>
          <code class="chmod__result-value chmod__result-value--big">{{ octal }}</code>
        </div>
        <div class="chmod__result">
          <span class="chmod__result-label">Symbolic</span>
          <code class="chmod__result-value chmod__result-value--mono">{{ symbolic }}</code>
        </div>
      </div>
      <p class="chmod__description">{{ description }}</p>

      <!-- Per-scope breakdown -->
      <div class="chmod__breakdown">
        <div v-for="scope in SCOPE_ORDER" :key="scope" class="chmod__breakdown-row">
          <span class="chmod__breakdown-scope">{{ SCOPE_LABEL[scope] }}</span>
          <code class="chmod__breakdown-sym">{{ symbolic.slice(SCOPE_ORDER.indexOf(scope) * 3, SCOPE_ORDER.indexOf(scope) * 3 + 3) }}</code>
          <span class="chmod__breakdown-oct">{{ scopeDigit(scope) }}</span>
        </div>
        <div v-if="hasSpecial()" class="chmod__breakdown-row chmod__breakdown-row--special">
          <span class="chmod__breakdown-scope">Special</span>
          <code class="chmod__breakdown-sym">{{ octal.charAt(0) }}</code>
          <span class="chmod__breakdown-oct">{{ octal.charAt(0) }}</span>
        </div>
      </div>
    </ToolOutput>
  </div>
</template>

<style scoped>
.chmod {
  display: flex;
  flex-direction: column;
  gap: var(--qt-gap);
  max-width: var(--qt-max-content);
  margin: 0 auto;
}

/* Presets */
.chmod__presets {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}
.chmod__presets-label {
  font-size: 12.5px;
  color: var(--qt-muted);
  font-weight: 600;
  margin-right: 2px;
}
.chmod__preset {
  padding: 4px 10px;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: 999px;
  color: var(--qt-text);
  font: inherit;
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas,
    monospace;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition:
    border-color 0.15s ease,
    color 0.15s ease,
    background 0.15s ease;
}
.chmod__preset:hover {
  border-color: var(--qt-accent);
  color: var(--qt-accent);
}
.chmod__preset--active {
  border-color: var(--qt-accent);
  color: var(--qt-accent);
  background: oklch(from var(--qt-accent) 90% c h / 0.12);
}

/* 3×3 grid */
.chmod__grid {
  display: grid;
  grid-template-columns: 1fr repeat(3, 56px);
  gap: 6px;
  align-items: stretch;
}
.chmod__grid-head,
.chmod__col-head {
  text-align: center;
  font-size: 12px;
  font-weight: 700;
  color: var(--qt-muted);
  padding: 4px 0;
}
.chmod__row-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 10px;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
}
.chmod__scope-name {
  font-size: 13px;
  font-weight: 700;
  color: var(--qt-text);
}
.chmod__scope-digit {
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas,
    monospace;
  font-size: 12px;
  font-weight: 700;
  color: var(--qt-accent);
  background: oklch(from var(--qt-accent) 90% c h / 0.12);
  border: 1px solid oklch(from var(--qt-accent) 60% c h / 0.4);
  border-radius: 999px;
  padding: 0 8px;
  font-variant-numeric: tabular-nums;
}
.chmod__cell {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  cursor: pointer;
  transition:
    border-color 0.15s ease,
    background 0.15s ease;
  min-height: 40px;
}
.chmod__cell:hover {
  border-color: var(--qt-accent);
}
.chmod__cell--on {
  border-color: var(--qt-accent);
  background: oklch(from var(--qt-accent) 90% c h / 0.16);
}
.chmod__cell input[type='checkbox'] {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
  margin: 0;
}
.chmod__cell-mark {
  font-size: 18px;
  font-weight: 700;
  color: var(--qt-accent);
  line-height: 1;
}
.chmod__cell:focus-within {
  box-shadow: 0 0 0 2px oklch(from var(--qt-accent) 90% c h / 0.25);
}

/* Special bits */
.chmod__special {
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  padding: 8px 10px;
}
.chmod__special-summary {
  cursor: pointer;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--qt-muted);
}
.chmod__special-grid {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 8px;
}
.chmod__special-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 8px;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  cursor: pointer;
  transition:
    border-color 0.15s ease,
    background 0.15s ease;
}
.chmod__special-row:hover {
  border-color: var(--qt-accent);
}
.chmod__special-row--on {
  border-color: var(--qt-accent);
  background: oklch(from var(--qt-accent) 90% c h / 0.12);
}
.chmod__special-row input[type='checkbox'] {
  margin: 0;
  accent-color: var(--qt-accent);
  cursor: pointer;
}
.chmod__special-label {
  font-size: 13px;
  font-weight: 700;
  color: var(--qt-text);
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas,
    monospace;
}
.chmod__special-hint {
  font-size: 12px;
  color: var(--qt-muted);
  margin-left: auto;
}

/* Raw input */
.chmod__raw {
  margin-top: 4px;
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  padding: 8px 10px;
}
.chmod__raw-summary {
  cursor: pointer;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--qt-muted);
}
.chmod__raw-row {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}
.chmod__raw-input {
  flex: 1 1 auto;
  background: var(--qt-surface);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  color: var(--qt-text);
  font: inherit;
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas,
    monospace;
  font-size: 13.5px;
  padding: 6px 8px;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;
}
.chmod__raw-input:focus {
  border-color: var(--qt-accent);
  outline: none;
  box-shadow: 0 0 0 2px oklch(from var(--qt-accent) 90% c h / 0.25);
}
.chmod__apply {
  padding: 6px 12px;
  background: var(--qt-accent);
  border: 1px solid var(--qt-accent);
  border-radius: var(--qt-radius-sm);
  color: var(--qt-bg);
  font: inherit;
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s ease;
}
.chmod__apply:hover {
  opacity: 0.9;
}
.chmod__raw-error {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 6px 0 0 0;
  color: var(--qt-danger);
  font-size: 12.5px;
}

/* Reset button */
.chmod__reset {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  color: var(--qt-text);
  font: inherit;
  font-size: 12.5px;
  font-weight: 600;
  padding: 6px 10px;
  cursor: pointer;
  transition:
    border-color 0.15s ease,
    color 0.15s ease;
}
.chmod__reset:hover {
  border-color: var(--qt-accent);
  color: var(--qt-accent);
}

/* Results */
.chmod__results {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.chmod__result {
  display: flex;
  flex-direction: column;
  gap: 4px;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  padding: 10px 12px;
}
.chmod__result-label {
  font-size: 11.5px;
  font-weight: 600;
  color: var(--qt-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.chmod__result-value {
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas,
    monospace;
  font-size: 16px;
  font-weight: 700;
  color: var(--qt-text);
  font-variant-numeric: tabular-nums;
}
.chmod__result-value--big {
  font-size: 28px;
  color: var(--qt-accent);
  letter-spacing: 0.06em;
}
.chmod__result-value--mono {
  letter-spacing: 0.12em;
}
.chmod__description {
  margin: 10px 0 0 0;
  font-size: 14px;
  color: var(--qt-text);
  line-height: 1.5;
}

/* Breakdown */
.chmod__breakdown {
  display: grid;
  grid-template-columns: 1fr auto auto;
  gap: 6px 12px;
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid var(--qt-border);
}
.chmod__breakdown-row {
  display: contents;
}
.chmod__breakdown-scope {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--qt-muted);
}
.chmod__breakdown-sym {
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas,
    monospace;
  font-size: 13px;
  font-weight: 700;
  color: var(--qt-text);
  letter-spacing: 0.08em;
}
.chmod__breakdown-oct {
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas,
    monospace;
  font-size: 13px;
  font-weight: 700;
  color: var(--qt-accent);
  font-variant-numeric: tabular-nums;
}
.chmod__breakdown-row--special .chmod__breakdown-scope {
  color: var(--qt-accent);
}

@media (max-width: 520px) {
  .chmod__results {
    grid-template-columns: 1fr;
  }
  .chmod__grid {
    grid-template-columns: 1fr repeat(3, 48px);
  }
}
</style>
