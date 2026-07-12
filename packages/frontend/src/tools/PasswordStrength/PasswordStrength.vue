<script setup lang="ts">
/**
 * PasswordStrength — analyse password strength with zxcvbn.
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
import { AlertCircle, Eye, EyeOff, Lightbulb, Loader2, ShieldAlert } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import {
  usePasswordStrength,
  SCORE_INFOS,
  SCORE_MAP,
  type PasswordScore,
} from './usePasswordStrength';

const {
  password,
  userInputs,
  analysis,
  analyzing,
  error,
  recompute,
} = usePasswordStrength();

/** Toggle password visibility (show/hide). */
const showPassword = ref(false);

/** Char count of the password (for the description line). */
const charCount = computed(() => password.value.length);

/** Current score band info (defaults to score 0 when no analysis yet). */
const currentScore = computed<PasswordScore>(() => analysis.value?.score ?? 0);
const scoreInfo = computed(() => SCORE_MAP[currentScore.value]);

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
  analysis.value ? analysis.value.guesses.toLocaleString('en-US') : '—',
);

function onPasswordInput(e: Event): void {
  password.value = (e.target as HTMLTextAreaElement).value;
}

function onUserInputsInput(e: Event): void {
  userInputs.value = (e.target as HTMLInputElement).value;
}
</script>

<template>
  <div class="pw-strength">
    <ToolInput
      title="Input"
      description="Password to analyse. zxcvbn estimates guessability, crack time, and entropy."
    >
      <template #actions>
        <button
          class="pw-strength__btn"
          type="button"
          :disabled="analyzing || password.length === 0"
          @click="recompute"
        >
          <Loader2 v-if="analyzing" :size="14" class="pw-strength__spin" />
          <span>{{ analyzing ? 'Analysing…' : 'Analyse' }}</span>
        </button>
      </template>

      <label class="pw-strength__field">
        <span class="pw-strength__label">Password</span>
        <div class="pw-strength__secret">
          <textarea
            :type="showPassword ? 'text' : 'password'"
            class="pw-strength__textarea"
            rows="3"
            placeholder="Enter password to analyse…"
            :value="password"
            spellcheck="false"
            autocomplete="off"
            @input="onPasswordInput"
          />
          <button
            class="pw-strength__icon-btn"
            type="button"
            :title="showPassword ? 'Hide password' : 'Show password'"
            @click="showPassword = !showPassword"
          >
            <EyeOff v-if="showPassword" :size="16" />
            <Eye v-else :size="16" />
          </button>
        </div>
      </label>

      <label class="pw-strength__field">
        <span class="pw-strength__label">
          User context <span class="pw-strength__optional">(optional)</span>
        </span>
        <input
          type="text"
          class="pw-strength__input"
          placeholder="username, email, app name — penalises passwords containing these"
          :value="userInputs"
          spellcheck="false"
          autocomplete="off"
          @input="onUserInputsInput"
        />
      </label>
    </ToolInput>

    <ToolOutput
      title="Strength analysis"
      :description="analysis ? `${charCount} char${charCount === 1 ? '' : 's'} · analysed in ${analysis.calcTime} ms` : ''"
    >
      <p v-if="error" class="pw-strength__error">
        <AlertCircle :size="14" />
        <span>{{ error }}</span>
      </p>
      <p v-else-if="!analysis" class="pw-strength__empty">
        Enter a password above to analyse its strength.
      </p>
      <div v-else class="pw-strength__results">
        <!-- Strength meter -->
        <div class="pw-strength__meter">
          <div class="pw-strength__meter-bar">
            <span
              v-for="seg in meterSegments"
              :key="seg.value"
              class="pw-strength__meter-seg"
              :class="{ 'pw-strength__meter-seg--active': seg.active }"
              :style="seg.active ? { background: `var(${seg.colorVar})` } : undefined"
            />
          </div>
          <div class="pw-strength__meter-label">
            <ShieldAlert :size="15" :style="{ color: `var(${scoreInfo.colorVar})` }" />
            <span class="pw-strength__score-label" :style="{ color: `var(${scoreInfo.colorVar})` }">
              {{ scoreInfo.label }}
            </span>
            <span class="pw-strength__score-hint">{{ scoreInfo.hint }}</span>
          </div>
        </div>

        <!-- Key metrics -->
        <div class="pw-strength__metrics">
          <div class="pw-strength__metric">
            <span class="pw-strength__metric-label">Score</span>
            <span class="pw-strength__metric-value">{{ analysis.score }} / 4</span>
          </div>
          <div class="pw-strength__metric">
            <span class="pw-strength__metric-label">Entropy</span>
            <span class="pw-strength__metric-value">{{ entropyBits }} bits</span>
          </div>
          <div class="pw-strength__metric">
            <span class="pw-strength__metric-label">Guesses</span>
            <span class="pw-strength__metric-value pw-strength__metric-mono">{{ guessesDisplay }}</span>
          </div>
          <div class="pw-strength__metric">
            <span class="pw-strength__metric-label">log₁₀</span>
            <span class="pw-strength__metric-value pw-strength__metric-mono">
              {{ analysis.guessesLog10.toFixed(2) }}
            </span>
          </div>
        </div>

        <!-- Crack-time scenarios -->
        <div class="pw-strength__section">
          <h4 class="pw-strength__section-title">Estimated crack time</h4>
          <div class="pw-strength__crack-grid">
            <div v-for="ct in analysis.crackTimes" :key="ct.key" class="pw-strength__crack-row">
              <div class="pw-strength__crack-head">
                <span class="pw-strength__crack-label">{{ ct.label }}</span>
                <span class="pw-strength__crack-value">{{ ct.display }}</span>
              </div>
              <span class="pw-strength__crack-desc">{{ ct.description }}</span>
            </div>
          </div>
        </div>

        <!-- Feedback -->
        <div class="pw-strength__section">
          <h4 class="pw-strength__section-title">Feedback</h4>
          <div
            v-if="analysis.feedback.warning"
            class="pw-strength__feedback pw-strength__feedback--warning"
          >
            <AlertCircle :size="14" />
            <span>{{ analysis.feedback.warning }}</span>
          </div>
          <ul v-if="analysis.feedback.suggestions.length" class="pw-strength__suggestions">
            <li v-for="(s, i) in analysis.feedback.suggestions" :key="i" class="pw-strength__suggestion">
              <Lightbulb :size="13" />
              <span>{{ s }}</span>
            </li>
          </ul>
          <p
            v-if="!analysis.feedback.warning && analysis.feedback.suggestions.length === 0"
            class="pw-strength__no-feedback"
          >
            No warnings — this password looks good.
          </p>
        </div>
      </div>
    </ToolOutput>
  </div>
</template>

<style scoped>
.pw-strength {
  display: flex;
  flex-direction: column;
  gap: var(--qt-gap);
  max-width: var(--qt-max-content);
  margin: 0 auto;
}
.pw-strength__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.pw-strength__label {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--qt-muted);
}
.pw-strength__optional {
  font-weight: 400;
  color: var(--qt-muted);
  opacity: 0.7;
}
.pw-strength__secret {
  position: relative;
  display: flex;
  align-items: flex-end;
}
.pw-strength__secret .pw-strength__textarea {
  padding-right: 38px;
}
.pw-strength__textarea,
.pw-strength__input {
  width: 100%;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  color: var(--qt-text);
  font: inherit;
  font-size: 14px;
  padding: 10px 12px;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;
  will-change: border-color;
}
.pw-strength__textarea {
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
  resize: vertical;
  min-height: 72px;
}
.pw-strength__textarea:focus,
.pw-strength__input:focus {
  border-color: var(--qt-accent);
  outline: none;
  box-shadow: 0 0 0 2px oklch(from var(--qt-accent) 90% c h / 0.25);
}
.pw-strength__icon-btn {
  position: absolute;
  right: 6px;
  bottom: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  color: var(--qt-muted);
  cursor: pointer;
  padding: 4px;
  border-radius: var(--qt-radius-sm);
  transition: color 0.15s ease;
}
.pw-strength__icon-btn:hover {
  color: var(--qt-text);
}
.pw-strength__btn {
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
.pw-strength__btn:hover:not(:disabled) {
  transform: translateY(-1px);
}
.pw-strength__btn:active:not(:disabled) {
  transform: translateY(0);
}
.pw-strength__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.pw-strength__spin {
  animation: pw-strength-spin 0.8s linear infinite;
}
@keyframes pw-strength-spin {
  to {
    transform: rotate(360deg);
  }
}
.pw-strength__error {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: var(--qt-danger);
  font-size: 13.5px;
}
.pw-strength__empty {
  margin: 0;
  color: var(--qt-muted);
  font-size: 13.5px;
}
.pw-strength__results {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

/* Meter */
.pw-strength__meter {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
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
.pw-strength__meter-seg--active {
  /* background set inline via :style */
}
.pw-strength__meter-label {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.pw-strength__score-label {
  font-size: 14px;
  font-weight: 700;
}
.pw-strength__score-hint {
  font-size: 12px;
  color: var(--qt-muted);
}

/* Metrics grid */
.pw-strength__metrics {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 8px;
}
.pw-strength__metric {
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
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

/* Sections */
.pw-strength__section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.pw-strength__section-title {
  margin: 0;
  font-size: 13px;
  font-weight: 700;
  color: var(--qt-text);
}

/* Crack-time grid */
.pw-strength__crack-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 8px;
}
.pw-strength__crack-row {
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.pw-strength__crack-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
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
.pw-strength__crack-desc {
  font-size: 11.5px;
  color: var(--qt-muted);
}

/* Feedback */
.pw-strength__feedback {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 8px 10px;
  border-radius: var(--qt-radius-sm);
  font-size: 13px;
}
.pw-strength__feedback--warning {
  background: oklch(from var(--qt-warning) 25% c h / 0.18);
  border: 1px solid oklch(from var(--qt-warning) 60% c h / 0.5);
  color: var(--qt-text);
}
.pw-strength__feedback--warning svg {
  color: var(--qt-warning);
  flex-shrink: 0;
  margin-top: 1px;
}
.pw-strength__suggestions {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
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
.pw-strength__no-feedback {
  margin: 0;
  font-size: 13px;
  color: var(--qt-success);
}
</style>
