<script setup lang="ts">
/**
 * MathEvaluator — safely evaluate mathematical expressions.
 *
 * Uses the lazy-loaded `expr-eval` parser to evaluate the input expression.
 * Supports `+ - * / ^ %`, parentheses, the functions `sin cos tan log ln sqrt
 * abs round floor ceil` (plus extras exposed by the library), and the
 * constants `pi` and `e`. The expression is never passed through `eval()`.
 *
 * Maintains a history of previous expressions (most recent first). Clicking a
 * history entry re-runs it. A collapsible reference sidebar lists the
 * available operators, functions, and constants.
 *
 * Works in embed mode: receives `input` PostMessages to pre-fill the
 * expression and sends `output` PostMessages whenever the result changes.
 */
import { computed } from 'vue';
import {
  AlertCircle,
  Calculator,
  History,
  Trash2,
  Loader2,
  ChevronDown,
  ChevronRight,
} from 'lucide-vue-next';
import { ref } from 'vue';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import CopyButton from '@/components/CopyButton.vue';
import {
  useMathEvaluator,
  formatResult,
  type MathHistoryEntry,
} from './useMathEvaluator';

const {
  input,
  outcome,
  loading,
  history,
  recompute,
  clearHistory,
  reuseExpression,
} = useMathEvaluator();

const showReference = ref<boolean>(false);

const resultText = computed(() => {
  const o = outcome.value;
  if (!o || !o.ok) return '';
  return formatResult(o.result);
});

const copyValue = computed(() => resultText.value);

const referenceSections: Array<{
  title: string;
  items: Array<{ token: string; desc: string }>;
}> = [
  {
    title: 'Operators',
    items: [
      { token: '+', desc: 'Addition' },
      { token: '-', desc: 'Subtraction' },
      { token: '*', desc: 'Multiplication' },
      { token: '/', desc: 'Division' },
      { token: '^', desc: 'Power' },
      { token: '%', desc: 'Remainder' },
      { token: '!', desc: 'Factorial' },
      { token: '(...)', desc: 'Grouping' },
    ],
  },
  {
    title: 'Functions',
    items: [
      { token: 'sin(x)', desc: 'Sine' },
      { token: 'cos(x)', desc: 'Cosine' },
      { token: 'tan(x)', desc: 'Tangent' },
      { token: 'log(x)', desc: 'Base-10 logarithm' },
      { token: 'ln(x)', desc: 'Natural logarithm' },
      { token: 'sqrt(x)', desc: 'Square root' },
      { token: 'abs(x)', desc: 'Absolute value' },
      { token: 'round(x)', desc: 'Round to nearest' },
      { token: 'floor(x)', desc: 'Round down' },
      { token: 'ceil(x)', desc: 'Round up' },
    ],
  },
  {
    title: 'Constants',
    items: [
      { token: 'pi', desc: 'π ≈ 3.14159' },
      { token: 'e', desc: 'Euler ≈ 2.71828' },
    ],
  },
];

function onTextInput(e: Event): void {
  input.value = (e.target as HTMLTextAreaElement).value;
}

function insertToken(token: string): void {
  // Insert the token at the cursor (or append) and focus the textarea.
  const el = document.getElementById('me-input') as HTMLTextAreaElement | null;
  if (!el) {
    input.value = input.value + token;
    recompute();
    return;
  }
  const start = el.selectionStart ?? input.value.length;
  const end = el.selectionEnd ?? input.value.length;
  const next = input.value.slice(0, start) + token + input.value.slice(end);
  input.value = next;
  const pos = start + token.length;
  // Defer focus/selection so Vue updates the textarea value first.
  requestAnimationFrame(() => {
    el.focus();
    el.setSelectionRange(pos, pos);
  });
  recompute();
}

function reuse(entry: MathHistoryEntry): void {
  reuseExpression(entry.expression);
}
</script>

<template>
  <div class="me">
    <ToolInput
      title="Expression"
      description="Enter a mathematical expression. Uses expr-eval — never eval()."
    >
      <template #actions>
        <button
          class="me__btn"
          type="button"
          :disabled="input.trim().length === 0 || loading"
          @click="recompute"
        >
          <Calculator :size="14" />
          <span>Evaluate</span>
        </button>
      </template>

      <label class="me__field">
        <span class="me__label">Expression</span>
        <textarea
          id="me-input"
          class="me__textarea me__textarea--mono"
          placeholder="e.g.  2 * (3 + 4)^2 - sin(pi/2)"
          :value="input"
          rows="3"
          spellcheck="false"
          autocomplete="off"
          @input="onTextInput"
          @keydown.ctrl.enter="recompute"
          @keydown.meta.enter="recompute"
        />
      </label>

      <button
        type="button"
        class="me__ref-toggle"
        :aria-expanded="showReference"
        @click="showReference = !showReference"
      >
        <component :is="showReference ? ChevronDown : ChevronRight" :size="14" />
        <span>Reference: operators, functions, constants</span>
      </button>
      <div v-if="showReference" class="me__ref">
        <section
          v-for="section in referenceSections"
          :key="section.title"
          class="me__ref-section"
        >
          <h4 class="me__ref-title">{{ section.title }}</h4>
          <div class="me__ref-grid">
            <button
              v-for="item in section.items"
              :key="item.token"
              type="button"
              class="me__ref-item"
              :title="item.desc"
              @click="insertToken(item.token)"
            >
              <code class="me__ref-token">{{ item.token }}</code>
              <span class="me__ref-desc">{{ item.desc }}</span>
            </button>
          </div>
        </section>
      </div>
    </ToolInput>

    <ToolOutput
      title="Result"
      :description="outcome && outcome.ok ? 'Evaluated expression.' : 'Enter an expression above to evaluate.'"
      :copy-text="copyValue"
      copy-label="Copy result"
    >
      <p v-if="outcome && !outcome.ok" class="me__error">
        <AlertCircle :size="14" />
        <span>{{ outcome.message }}</span>
      </p>
      <template v-else>
        <p v-if="!outcome && !loading" class="me__empty">
          Enter an expression above to evaluate.
        </p>
        <div v-if="outcome && outcome.ok" class="me__result">
          <div class="me__result-row">
            <code class="me__result-expr">{{ outcome.expression }}</code>
            <span class="me__result-eq">=</span>
            <span class="me__result-value">{{ resultText }}</span>
            <CopyButton :text="resultText" label="Copy" icon-only />
          </div>
        </div>
        <div v-if="loading && !outcome" class="me__loading">
          <Loader2 :size="14" />
          <span>Loading parser…</span>
        </div>
      </template>
    </ToolOutput>

    <section v-if="history.length > 0" class="me__history">
      <header class="me__history-head">
        <span class="me__history-title">
          <History :size="14" />
          <span>History ({{ history.length }})</span>
        </span>
        <button
          type="button"
          class="me__history-clear"
          @click="clearHistory"
          title="Clear history"
        >
          <Trash2 :size="13" />
          <span>Clear</span>
        </button>
      </header>
      <ul class="me__history-list">
        <li
          v-for="(entry, i) in history"
          :key="`${entry.at}-${i}`"
          class="me__history-item"
        >
          <button
            type="button"
            class="me__history-btn"
            :title="`Re-run: ${entry.expression}`"
            @click="reuse(entry)"
          >
            <code class="me__history-expr">{{ entry.expression }}</code>
            <span class="me__history-eq">=</span>
            <span class="me__history-val">{{ formatResult(entry.result) }}</span>
          </button>
          <CopyButton :text="formatResult(entry.result)" label="Copy" icon-only />
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.me {
  display: flex;
  flex-direction: column;
  gap: var(--qt-gap);
  max-width: var(--qt-max-content);
  margin: 0 auto;
}
.me__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.me__label {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--qt-muted);
}
.me__textarea {
  width: 100%;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  color: var(--qt-text);
  font: inherit;
  font-size: 14px;
  padding: 10px 12px;
  resize: vertical;
  min-height: 72px;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;
  will-change: border-color;
}
.me__textarea--mono {
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
}
.me__textarea:focus {
  border-color: var(--qt-accent);
  outline: none;
  box-shadow: 0 0 0 2px oklch(from var(--qt-accent) 90% c h / 0.25);
}
.me__btn {
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
.me__btn:hover:not(:disabled) {
  transform: translateY(-1px);
}
.me__btn:active:not(:disabled) {
  transform: translateY(0);
}
.me__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.me__ref-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: transparent;
  border: none;
  color: var(--qt-muted);
  font: inherit;
  font-size: 12.5px;
  font-weight: 600;
  padding: 4px 0;
  cursor: pointer;
}
.me__ref-toggle:hover {
  color: var(--qt-text);
}
.me__ref {
  display: flex;
  flex-direction: column;
  gap: 12px;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  padding: 10px 12px;
}
.me__ref-title {
  margin: 0 0 6px;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--qt-muted);
}
.me__ref-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 6px;
}
.me__ref-item {
  display: flex;
  align-items: center;
  gap: 8px;
  background: transparent;
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  padding: 5px 8px;
  cursor: pointer;
  text-align: left;
  transition: border-color 0.15s ease;
  will-change: border-color;
}
.me__ref-item:hover {
  border-color: var(--qt-accent);
}
.me__ref-token {
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
  font-size: 12.5px;
  color: var(--qt-accent);
  white-space: nowrap;
}
.me__ref-desc {
  font-size: 12px;
  color: var(--qt-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.me__error {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 0;
  color: var(--qt-danger);
  font-size: 13.5px;
  line-height: 1.4;
}
.me__empty {
  margin: 0;
  color: var(--qt-muted);
  font-size: 13.5px;
}
.me__loading {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--qt-muted);
  font-size: 13px;
}
.me__loading :deep(svg) {
  animation: me-spin 0.8s linear infinite;
}
@keyframes me-spin {
  to {
    transform: rotate(360deg);
  }
}
.me__result {
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  padding: 10px 12px;
}
.me__result-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.me__result-expr {
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
  font-size: 13.5px;
  color: var(--qt-muted);
  word-break: break-word;
}
.me__result-eq {
  font-size: 14px;
  color: var(--qt-muted);
}
.me__result-value {
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
  font-size: 20px;
  font-weight: 700;
  color: var(--qt-text);
  word-break: break-word;
}
.me__history {
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  padding: 10px 12px;
}
.me__history-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.me__history-title {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12.5px;
  font-weight: 700;
  color: var(--qt-text);
}
.me__history-clear {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background: transparent;
  border: 1px solid var(--qt-border);
  border-radius: 999px;
  color: var(--qt-muted);
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  padding: 4px 9px;
  cursor: pointer;
  transition:
    color 0.15s ease,
    border-color 0.15s ease;
}
.me__history-clear:hover {
  color: var(--qt-danger);
  border-color: var(--qt-danger);
}
.me__history-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.me__history-item {
  display: flex;
  align-items: center;
  gap: 6px;
}
.me__history-btn {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--qt-radius-sm);
  padding: 5px 8px;
  cursor: pointer;
  text-align: left;
  transition: border-color 0.15s ease, background 0.15s ease;
  min-width: 0;
}
.me__history-btn:hover {
  border-color: var(--qt-border);
  background: var(--qt-surface, var(--qt-bg));
}
.me__history-expr {
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
  font-size: 12.5px;
  color: var(--qt-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.me__history-eq {
  font-size: 12.5px;
  color: var(--qt-muted);
}
.me__history-val {
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--qt-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
