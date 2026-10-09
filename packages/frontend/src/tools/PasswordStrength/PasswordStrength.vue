<script setup lang="ts">
/**
 * PasswordStrength - analyse password strength with zxcvbn.
 *
 * Uses `@zxcvbn-ts/core` + `@zxcvbn-ts/language-common` + `@zxcvbn-ts/language-en`
 * (all lazy-loaded inside the composable). Reports a 0-4 score, entropy bits,
 * crack-time estimates for four attack scenarios, and verbal feedback
 * (warning + suggestions). A color-coded 5-segment meter visualises the score.
 *
 * Works in embed mode: receives `input` PostMessages to pre-fill the password
 * (and optional user-context inputs), and sends `output` PostMessages whenever
 * the analysis changes.
 */
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { AlertCircle, Check, Eye, EyeOff, Lightbulb, Loader2, ShieldAlert } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import {
  usePasswordStrength,
  SCORE_INFOS,
  SCORE_MAP,
  type PasswordScore,
} from './usePasswordStrength';

const { t, locale } = useI18n();

const {
  password,
  userInputs,
  analysis,
  analyzing,
  error,
  autoMode,
  recompute,
} = usePasswordStrength();

/** Toggle password visibility (show/hide). */
const showPassword = ref(false);

/** Char count of the password (for the description line). */
const charCount = computed(() => password.value.length);

/** Current score band info (defaults to score 0 when no analysis yet). */
const currentScore = computed<PasswordScore>(() => analysis.value?.score ?? 0);
const scoreInfo = computed(() => SCORE_MAP[currentScore.value]);

/** Localized label/hint for a score band (composable strings stay English). */
function scoreLabel(score: PasswordScore): string {
  return t(`tools.password-strength-analyser.ui.score${score}`);
}
function scoreHint(score: PasswordScore): string {
  return t(`tools.password-strength-analyser.ui.score${score}Hint`);
}

/** Localized label/description for a crack-time scenario key. */
const CRACK_KEY_MAP: Record<string, string> = {
  onlineThrottling100PerHour: 'crackOnlineThrottled',
  onlineNoThrottling10PerSecond: 'crackOnlineNoThrottle',
  offlineSlowHashing1e4PerSecond: 'crackOfflineSlow',
  offlineFastHashing1e10PerSecond: 'crackOfflineFast',
};
function crackLabel(key: string): string {
  return t(`tools.password-strength-analyser.ui.${CRACK_KEY_MAP[key] ?? key}`);
}
function crackDesc(key: string): string {
  return t(`tools.password-strength-analyser.ui.${CRACK_KEY_MAP[key] ?? key}Desc`);
}

/** Segments for the 5-segment strength meter (lit up to currentScore + 1). */
const meterSegments = computed(() =>
  SCORE_INFOS.map((info) => ({
    value: info.value,
    active: analysis.value !== null && info.value <= currentScore.value,
    colorVar: info.colorVar,
  })),
);

/** Entropy rounded to 1 decimal place. */
const entropyBits = computed(() =>
  analysis.value ? Math.round(analysis.value.entropyBits * 10) / 10 : 0,
);

/** Guesses formatted with thousands separators. */
const guessesDisplay = computed(() =>
  analysis.value ? analysis.value.guesses.toLocaleString(locale.value) : '-',
);

function onPasswordInput(e: Event): void {
  password.value = (e.target as HTMLTextAreaElement).value;
}

function onUserInputsInput(e: Event): void {
  userInputs.value = (e.target as HTMLInputElement).value;
}
</script>

<template>
  <div class="qt-tool">
    <ToolInput
      :title="t('common.input')"
      :description="t('tools.password-strength-analyser.ui.desc')"
    >
      <template #actions>
        <div class="qt-row qt-row--center qt-row--nowrap" style="--qt-row-gap:6px">
          <button
            class="qt-chip qt-chip--filled"
            :class="{ 'qt-chip--active': !autoMode }"
            type="button"
            @click="autoMode = !autoMode"
          >
            {{ autoMode ? t('tools.password-strength-analyser.ui.auto') : t('tools.password-strength-analyser.ui.manual') }}
          </button>
          <button
            v-if="!autoMode"
            class="qt-btn qt-btn--primary qt-btn--icon"
            type="button"
            :disabled="analyzing || password.length === 0"
            :title="analyzing ? t('tools.password-strength-analyser.ui.analyzing') : t('tools.password-strength-analyser.ui.runAnalysis')"
            @click="recompute"
          >
            <Loader2 v-if="analyzing" :size="14" class="qt-spin" />
            <Check v-else :size="14" />
          </button>
        </div>
      </template>

      <label class="qt-field">
        <span class="qt-label">{{ t('common.password') }}</span>
        <div class="qt-input-wrap">
          <textarea
            :type="showPassword ? 'text' : 'password'"
            class="qt-input qt-input--mono pw-strength__textarea"
            rows="3"
            :placeholder="t('tools.password-strength-analyser.ui.passwordPlaceholder')"
            :value="password"
            spellcheck="false"
            autocomplete="off"
            @input="onPasswordInput"
          />
          <button
            class="qt-input-btn"
            type="button"
            :title="showPassword ? t('tools.password-strength-analyser.ui.hidePassword') : t('tools.password-strength-analyser.ui.showPassword')"
            @click="showPassword = !showPassword"
          >
            <EyeOff v-if="showPassword" :size="16" />
            <Eye v-else :size="16" />
          </button>
        </div>
      </label>

      <label class="qt-field">
        <span class="qt-label">
          {{ t('tools.password-strength-analyser.ui.userContext') }} <span class="pw-strength__optional">{{ t('tools.password-strength-analyser.ui.optional') }}</span>
        </span>
        <input
          type="text"
          class="qt-input"
          :placeholder="t('tools.password-strength-analyser.ui.userContextPlaceholder')"
          :value="userInputs"
          spellcheck="false"
          autocomplete="off"
          @input="onUserInputsInput"
        />
      </label>
    </ToolInput>

    <ToolOutput
      :title="t('tools.password-strength-analyser.ui.outputTitle')"
      :description="analysis ? t('tools.password-strength-analyser.ui.outputDesc', {
        chars: t('tools.password-strength-analyser.ui.charCount', { n: charCount }, charCount),
        ms: analysis.calcTime,
      }) : ''"
    >
      <p v-if="error" class="qt-alert qt-alert--error">
        <AlertCircle :size="14" />
        <span>{{ error }}</span>
      </p>
      <p v-else-if="!analysis" class="qt-alert qt-alert--empty">
        {{ t('tools.password-strength-analyser.ui.empty') }}
      </p>
      <div v-else class="qt-stack" style="--qt-stack-gap:14px">
        <!-- Strength meter -->
        <div class="qt-stack">
          <div class="pw-strength__meter-bar">
            <span
              v-for="seg in meterSegments"
              :key="seg.value"
              class="pw-strength__meter-seg"
              :class="{ 'pw-strength__meter-seg--active': seg.active }"
              :style="seg.active ? { background: `var(${seg.colorVar})` } : undefined"
            />
          </div>
          <div class="qt-row qt-row--center" style="--qt-row-gap:8px">
            <ShieldAlert :size="15" :style="{ color: `var(${scoreInfo.colorVar})` }" />
            <span class="pw-strength__score-label" :style="{ color: `var(${scoreInfo.colorVar})` }">
              {{ scoreLabel(currentScore) }}
            </span>
            <span class="qt-hint">{{ scoreHint(currentScore) }}</span>
          </div>
        </div>

        <!-- Key metrics -->
        <div class="qt-grid" style="--qt-grid-min:120px; --qt-grid-gap:8px">
          <div class="qt-result">
            <span class="pw-strength__metric-label">{{ t('tools.password-strength-analyser.ui.score') }}</span>
            <span class="pw-strength__metric-value">{{ analysis.score }} / 4</span>
          </div>
          <div class="qt-result">
            <span class="pw-strength__metric-label">{{ t('tools.password-strength-analyser.ui.entropy') }}</span>
            <span class="pw-strength__metric-value">{{ t('common.bits', { n: entropyBits }) }}</span>
          </div>
          <div class="qt-result">
            <span class="pw-strength__metric-label">{{ t('tools.password-strength-analyser.ui.guesses') }}</span>
            <span class="pw-strength__metric-value pw-strength__metric-mono">{{ guessesDisplay }}</span>
          </div>
          <div class="qt-result">
            <span class="pw-strength__metric-label">log₁₀</span>
            <span class="pw-strength__metric-value pw-strength__metric-mono">
              {{ analysis.guessesLog10.toFixed(2) }}
            </span>
          </div>
        </div>

        <!-- Crack-time scenarios -->
        <div class="qt-stack">
          <h4 class="pw-strength__section-title">{{ t('tools.password-strength-analyser.ui.crackTime') }}</h4>
          <div class="qt-grid" style="--qt-grid-min:220px; --qt-grid-gap:8px">
            <div v-for="ct in analysis.crackTimes" :key="ct.key" class="qt-result">
              <div class="qt-row qt-row--center qt-row--between qt-row--nowrap" style="--qt-row-gap:8px">
                <span class="pw-strength__crack-label">{{ crackLabel(ct.key) }}</span>
                <span class="pw-strength__crack-value">{{ ct.display }}</span>
              </div>
              <span class="qt-hint">{{ crackDesc(ct.key) }}</span>
            </div>
          </div>
        </div>

        <!-- Feedback -->
        <div class="qt-stack">
          <h4 class="pw-strength__section-title">{{ t('tools.password-strength-analyser.ui.feedback') }}</h4>
          <div
            v-if="analysis.feedback.warning"
            class="qt-banner qt-banner--warn"
          >
            <AlertCircle :size="14" />
            <span>{{ analysis.feedback.warning }}</span>
          </div>
          <ul v-if="analysis.feedback.suggestions.length" class="qt-list qt-stack" style="--qt-stack-gap:6px">
            <li v-for="(s, i) in analysis.feedback.suggestions" :key="i" class="pw-strength__suggestion">
              <Lightbulb :size="13" />
              <span>{{ s }}</span>
            </li>
          </ul>
          <p
            v-if="!analysis.feedback.warning && analysis.feedback.suggestions.length === 0"
            class="qt-alert qt-alert--success"
          >
            {{ t('tools.password-strength-analyser.ui.noWarnings') }}
          </p>
        </div>
      </div>
    </ToolOutput>
  </div>
</template>

<style scoped>
/* Kept scoped: patterns unique to this tool (no generic utility). */

/* "(optional)" tag inside a label. */
.pw-strength__optional {
  font-weight: 400;
  color: var(--qt-muted);
  opacity: 0.7;
}
/* Password textarea floor (control + mono via .qt-input--mono). */
.pw-strength__textarea {
  min-height: 72px;
}
/* 5-segment strength meter (active segment bg set inline via :style). */
.pw-strength__meter-bar {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 4px;
  height: 10px;
}
.pw-strength__meter-seg {
  background: var(--qt-border);
  border-radius: 3px;
  transition: background 0.2s ease;
}
/* Score label (color set inline via :style). */
.pw-strength__score-label {
  font-size: 14px;
  font-weight: 700;
}
/* Metric card internals. */
.pw-strength__metric-label {
  font-size: 11.5px;
  color: var(--qt-muted);
  font-weight: 600;
}
.pw-strength__metric-value {
  font-size: 15px;
  font-weight: 700;
  color: var(--qt-text);
}
.pw-strength__metric-mono {
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
  font-size: 13.5px;
  word-break: break-all;
}
/* Section heading. */
.pw-strength__section-title {
  margin: 0;
  font-size: 13px;
  font-weight: 700;
  color: var(--qt-text);
}
/* Crack-time card internals. */
.pw-strength__crack-label {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--qt-text);
}
.pw-strength__crack-value {
  font-size: 13px;
  font-weight: 700;
  color: var(--qt-accent);
  text-align: right;
}
/* Suggestion item (accent lightbulb + muted text). */
.pw-strength__suggestion {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 12.5px;
  color: var(--qt-muted);
}
.pw-strength__suggestion svg {
  color: var(--qt-accent);
  flex-shrink: 0;
  margin-top: 1px;
}
</style>
