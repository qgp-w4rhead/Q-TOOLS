<script setup lang="ts">
/**
 * ChmodCalculator - interactive Unix file permission calculator.
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
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
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

const { t } = useI18n();
const U = 'tools.chmod-calculator.ui.';

/** Special bits metadata for rendering. */
const SPECIAL_BITS = computed<{ key: SpecialBit; label: string; hint: string }[]>(() => [
  { key: 'setuid', label: 'setuid', hint: t(U + 'hintSetuid') },
  { key: 'setgid', label: 'setgid', hint: t(U + 'hintSetgid') },
  { key: 'sticky', label: 'sticky', hint: t(U + 'hintSticky') },
]);

/** Raw input field state. */
const rawInput = ref('');
const rawError = ref('');

/** Apply the raw input - auto-detect numeric vs symbolic. */
function applyRaw(): void {
  const trimmed = rawInput.value.trim();
  if (!trimmed) {
    rawError.value = t(U + 'errEmpty');
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
    rawError.value = t(U + 'errOctal');
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
  rawError.value = t(U + 'errSymbolic');
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
  <div class="qt-tool">
    <ToolInput
      :title="t(U + 'inputTitle')"
      :description="t(U + 'desc')"
    >
      <template #actions>
        <button class="qt-btn qt-btn--ghost qt-btn--sm" type="button" @click="reset">
          <RotateCcw :size="14" />
          <span>{{ t('common.reset') }}</span>
        </button>
      </template>

      <!-- Quick presets -->
      <div class="qt-row qt-row--center" style="--qt-row-gap:6px">
        <span class="qt-label" style="margin-right:2px">{{ t(U + 'presets') }}</span>
        <button
          v-for="p in PRESETS"
          :key="p.octal"
          type="button"
          class="qt-chip qt-chip--filled"
          style="font-family:var(--qt-font-mono)"
          :class="{ 'qt-chip--active': octal === p.octal && !hasSpecial() }"
          @click="applyPreset(p.octal)"
        >
          {{ p.label }}
        </button>
      </div>

      <!-- 3×3 checkbox grid -->
      <div class="chmod__grid" role="group" :aria-label="t(U + 'matrixLabel')">
        <div class="chmod__grid-head"></div>
        <div
          v-for="bit in BIT_ORDER"
          :key="bit"
          class="chmod__col-head"
        >
          {{ BIT_LABEL[bit] }}
        </div>

        <template v-for="scope in SCOPE_ORDER" :key="scope">
          <div class="qt-result-row" style="justify-content:space-between;padding:8px 10px">
            <span style="font-size:13px;font-weight:700;color:var(--qt-text)">{{ SCOPE_LABEL[scope] }}</span>
            <code class="qt-badge qt-badge--info" style="font-family:var(--qt-font-mono);font-variant-numeric:tabular-nums">{{ scopeDigit(scope) }}</code>
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
      <details class="qt-panel" style="padding:8px 10px">
        <summary class="qt-label" style="cursor:pointer">{{ t(U + 'specialSummary') }}</summary>
        <div class="qt-stack" style="--qt-stack-gap:6px;margin-top:8px">
          <label
            v-for="sb in SPECIAL_BITS"
            :key="sb.key"
            class="qt-result-row chmod__special-row"
            style="padding:6px 8px;cursor:pointer"
            :class="{ 'qt-result-row--active': permissions[sb.key] }"
          >
            <input
              type="checkbox"
              style="margin:0;accent-color:var(--qt-accent);cursor:pointer"
              :checked="permissions[sb.key]"
              @change="toggleSpecial(sb.key)"
            />
            <span style="font-size:13px;font-weight:700;color:var(--qt-text);font-family:var(--qt-font-mono)">{{ sb.label }}</span>
            <span style="font-size:12px;color:var(--qt-muted);margin-left:auto">{{ sb.hint }}</span>
          </label>
        </div>
      </details>

      <!-- Raw input -->
      <details class="qt-panel" style="margin-top:4px;padding:8px 10px">
        <summary class="qt-label" style="cursor:pointer">{{ t(U + 'rawSummary') }}</summary>
        <div class="qt-row" style="--qt-row-gap:8px;margin-top:8px">
          <input
            v-model="rawInput"
            class="qt-input qt-input--mono"
            style="flex:1;font-size:13.5px;padding:6px 8px"
            type="text"
            :placeholder="t(U + 'phRaw')"
            @keydown.enter.prevent="applyRaw"
          />
          <button class="qt-btn qt-btn--primary" style="font-size:12.5px;padding:6px 12px" type="button" @click="applyRaw">
            {{ t(U + 'apply') }}
          </button>
        </div>
        <p v-if="rawError" class="qt-alert qt-alert--error" style="align-items:center;gap:6px;margin:6px 0 0;font-size:12.5px">
          <AlertCircle :size="14" />
          <span>{{ rawError }}</span>
        </p>
      </details>
    </ToolInput>

    <ToolOutput
      :title="t(U + 'outTitle')"
      :copy-text="octal"
      :copy-label="t(U + 'copyOctal')"
    >
      <div class="chmod__results">
        <div class="qt-result" style="padding:10px 12px">
          <span class="qt-stat-head">{{ t(U + 'numericOctal') }}</span>
          <code class="qt-value" style="font-size:28px;color:var(--qt-accent);letter-spacing:0.06em;font-variant-numeric:tabular-nums">{{ octal }}</code>
        </div>
        <div class="qt-result" style="padding:10px 12px">
          <span class="qt-stat-head">{{ t(U + 'symbolic') }}</span>
          <code class="qt-value" style="letter-spacing:0.12em;font-variant-numeric:tabular-nums">{{ symbolic }}</code>
        </div>
      </div>
      <p style="margin:10px 0 0;font-size:14px;color:var(--qt-text);line-height:1.5">{{ description }}</p>

      <!-- Per-scope breakdown -->
      <div class="chmod__breakdown">
        <div v-for="scope in SCOPE_ORDER" :key="scope" class="chmod__breakdown-row">
          <span class="chmod__breakdown-scope">{{ SCOPE_LABEL[scope] }}</span>
          <code class="chmod__breakdown-sym">{{ symbolic.slice(SCOPE_ORDER.indexOf(scope) * 3, SCOPE_ORDER.indexOf(scope) * 3 + 3) }}</code>
          <span class="chmod__breakdown-oct">{{ scopeDigit(scope) }}</span>
        </div>
        <div v-if="hasSpecial()" class="chmod__breakdown-row chmod__breakdown-row--special">
          <span class="chmod__breakdown-scope">{{ t(U + 'special') }}</span>
          <code class="chmod__breakdown-sym">{{ octal.charAt(0) }}</code>
          <span class="chmod__breakdown-oct">{{ octal.charAt(0) }}</span>
        </div>
      </div>
    </ToolOutput>
  </div>
</template>

<style scoped>
/* Kept scoped: patterns unique to this tool (no generic utility). */

/* 3×3 permission matrix — custom grid + clickable cells. */
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

/* Special-bit row — accent hover + tinted on-state (over .qt-result-row). */
.chmod__special-row:hover {
  border-color: var(--qt-accent);
}
.chmod__special-row.qt-result-row--active {
  background: oklch(from var(--qt-accent) 90% c h / 0.12);
}

/* Results — fixed 2-col grid (collapses on narrow). */
.chmod__results {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

/* Per-scope breakdown — 3-col grid with display:contents rows. */
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
  font-family: var(--qt-font-mono);
  font-size: 13px;
  font-weight: 700;
  color: var(--qt-text);
  letter-spacing: 0.08em;
}
.chmod__breakdown-oct {
  font-family: var(--qt-font-mono);
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
