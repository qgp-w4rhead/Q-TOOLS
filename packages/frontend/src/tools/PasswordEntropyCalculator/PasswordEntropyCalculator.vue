<script setup lang="ts">
/**
 * PasswordEntropyCalculator - charset pool → bits of entropy + crack-time table.
 *
 * Auto-detects the charset pool from the typed password (lowercase/uppercase/
 * digits/symbols/whitespace/non-ASCII) or accepts a manual pool override.
 * Shows entropy bits, a qualitative band, a crack-time table at five attacker
 * speeds, and concrete strengthening tips.
 *
 * No external dependencies.
 *
 * Works in embed mode: receives `input` PostMessages to pre-fill the password
 * and pool; sends `output` PostMessages with `{ length, pool, entropy, band }`.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { Eye, EyeOff, Gauge, Lightbulb, Timer } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import ToolAlert from '@/components/ToolAlert.vue';
import { usePasswordEntropyCalculator } from './usePasswordEntropyCalculator';

const { t } = useI18n();
const U = 'tools.password-entropy-calculator.ui.';

const {
  password,
  showPassword,
  manualPool,
  manualMode,
  result,
} = usePasswordEntropyCalculator();

const passwordType = computed(() => (showPassword.value ? 'text' : 'password'));

const entropyDisplay = computed(() =>
  result.value ? result.value.entropy.toFixed(1) : '0',
);

const breakdownRows = computed(() => {
  const r = result.value;
  if (!r) return [];
  const b = r.breakdown;
  const rows: Array<{ label: string; count: number; pool: number }> = [];
  if (b.lowercase) rows.push({ label: t(U + 'bdLower'), count: b.lowercase, pool: 26 });
  if (b.uppercase) rows.push({ label: t(U + 'bdUpper'), count: b.uppercase, pool: 26 });
  if (b.digits) rows.push({ label: t(U + 'bdDigits'), count: b.digits, pool: 10 });
  if (b.symbolsCommon) rows.push({ label: t(U + 'bdSymCommon'), count: b.symbolsCommon, pool: 33 });
  if (b.symbolsExtended) rows.push({ label: t(U + 'bdSymExt'), count: b.symbolsExtended, pool: 33 });
  if (b.whitespace) rows.push({ label: t(U + 'bdWhitespace'), count: b.whitespace, pool: 2 });
  if (b.nonAscii) rows.push({ label: t(U + 'bdNonAscii'), count: b.nonAscii, pool: 1000 });
  return rows;
});

function onPassword(e: Event): void {
  password.value = (e.target as HTMLInputElement).value;
}
function onManualPool(e: Event): void {
  const v = Number((e.target as HTMLInputElement).value);
  manualPool.value = Number.isFinite(v) ? v : 0;
}
</script>

<template>
  <div class="qt-tool">
    <ToolInput
      :title="t(U + 'inputTitle')"
      :description="t(U + 'desc')"
    >
      <div class="pec__pw">
        <input
          class="qt-input qt-input--mono"
          style="padding-right:38px"
          :type="passwordType"
          :placeholder="t(U + 'phPassword')"
          :value="password"
          spellcheck="false"
          autocomplete="off"
          autocapitalize="off"
          @input="onPassword"
        />
        <button
          type="button"
          class="pec__pw-btn"
          :title="showPassword ? t(U + 'hideTitle') : t(U + 'showTitle')"
          :aria-pressed="showPassword"
          @click="showPassword = !showPassword"
        >
          <component :is="showPassword ? EyeOff : Eye" :size="14" />
        </button>
      </div>

      <label class="qt-check" style="font-size:13px;color:var(--qt-muted)">
        <input type="checkbox" :checked="manualMode" @change="manualMode = !manualMode" />
        <span>{{ t(U + 'manualLabel') }}</span>
        <input
          v-if="manualMode"
          class="qt-input"
          style="width:110px;padding:5px 8px;font-size:13px"
          type="number"
          min="1"
          max="1000000"
          :placeholder="t(U + 'phPool')"
          :value="manualPool || ''"
          @input="onManualPool"
        />
      </label>
    </ToolInput>

    <ToolOutput
      :title="t(U + 'outTitle')"
      :description="result ? t(U + 'descResult', { n: result.length, pool: result.pool }) : t(U + 'descEmpty')"
      :copy-text="result ? `${result.entropy.toFixed(1)} ${t(U + 'bitsUnit')}` : ''"
      :copy-label="t(U + 'copyLabel')"
    >
      <template v-if="!result">
        <ToolAlert kind="empty">{{ t(U + 'alertEmpty') }}</ToolAlert>
      </template>
      <template v-else>
        <div class="qt-row qt-row--center qt-row--between" style="--qt-row-gap:12px">
          <div class="qt-row" style="--qt-row-gap:8px;align-items:baseline;color:var(--qt-accent);flex-wrap:nowrap">
            <Gauge :size="18" />
            <span style="font-size:34px;font-weight:800;font-variant-numeric:tabular-nums">{{ entropyDisplay }}</span>
            <span class="qt-hint" style="font-size:14px">{{ t(U + 'bitsUnit') }}</span>
          </div>
          <span class="pec__band" :class="`pec__band--${result.band}`">
            {{ result.bandLabel }}
          </span>
        </div>

        <div v-if="breakdownRows.length" class="qt-stack" style="--qt-stack-gap:4px">
          <div v-for="row in breakdownRows" :key="row.label" class="pec__bd-row">
            <span style="color:var(--qt-text)">{{ row.label }}</span>
            <span class="qt-hint" style="font-variant-numeric:tabular-nums">×{{ row.count }}</span>
            <span style="color:var(--qt-accent);font-variant-numeric:tabular-nums">{{ t(U + 'poolBadge', { n: row.pool }) }}</span>
          </div>
        </div>

        <div>
          <p class="qt-stat-head" style="margin:0 0 8px"><Timer :size="13" /> {{ t(U + 'crackTitle') }}</p>
          <table class="pec__table">
            <thead>
              <tr><th>{{ t(U + 'colAttacker') }}</th><th>{{ t(U + 'colRate') }}</th><th>{{ t(U + 'colTime') }}</th></tr>
            </thead>
            <tbody>
              <tr v-for="row in result.crackTimes" :key="row.label">
                <td>{{ row.label }}</td>
                <td class="pec__num">{{ row.guessesPerSecond.toExponential(0) }}/s</td>
                <td class="pec__num pec__time">{{ row.display }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-if="result.tips.length">
          <p class="qt-stat-head" style="margin:0 0 8px"><Lightbulb :size="13" /> {{ t(U + 'tipsTitle') }}</p>
          <ul class="qt-stack" style="--qt-stack-gap:4px;margin:0;padding-left:18px;font-size:13px;color:var(--qt-text)">
            <li v-for="(tip, i) in result.tips" :key="i">{{ tip }}</li>
          </ul>
        </div>
      </template>
    </ToolOutput>
  </div>
</template>

<style scoped>
/* Kept scoped: patterns unique to this tool (no generic utility). */

/* Password input wrap + eye toggle button. */
.pec__pw {
  position: relative;
  display: flex;
  align-items: center;
}
.pec__pw-btn {
  position: absolute;
  right: 6px;
  top: 50%;
  transform: translateY(-50%);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border: none;
  background: transparent;
  color: var(--qt-muted);
  border-radius: var(--qt-radius-sm);
  cursor: pointer;
}
.pec__pw-btn:hover {
  color: var(--qt-accent);
  background: var(--qt-surface);
}

/* Strength band badge — colored by band. */
.pec__band {
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 4px 10px;
  border-radius: 999px;
  border: 1px solid var(--qt-border);
}
.pec__band--very-weak { color: var(--qt-danger); border-color: var(--qt-danger); }
.pec__band--weak { color: var(--qt-danger); }
.pec__band--fair { color: var(--qt-warning); border-color: var(--qt-warning); }
.pec__band--strong { color: var(--qt-success); border-color: var(--qt-success); }
.pec__band--excellent { color: var(--qt-success); border-color: var(--qt-success); background: oklch(from var(--qt-success) 20% c h / 0.15); }

/* Breakdown row — 3-col grid (label | count | pool). */
.pec__bd-row {
  display: grid;
  grid-template-columns: 1fr auto auto;
  gap: 10px;
  padding: 5px 10px;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  font-size: 12.5px;
}

/* Crack-time table. */
.pec__table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.pec__table th,
.pec__table td {
  text-align: left;
  padding: 7px 10px;
  border-bottom: 1px solid var(--qt-border);
}
.pec__table th {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--qt-muted);
  font-weight: 700;
}
.pec__num {
  font-variant-numeric: tabular-nums;
  color: var(--qt-muted);
}
.pec__time {
  color: var(--qt-text);
  font-weight: 600;
}
</style>
