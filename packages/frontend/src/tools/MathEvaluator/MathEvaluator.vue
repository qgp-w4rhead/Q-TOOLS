<script setup lang="ts">
/**
 * MathEvaluator - safely evaluate mathematical expressions.
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
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  Calculator,
  History,
  Trash2,
  Loader2,
  ChevronDown,
  ChevronRight,
} from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import ToolField from '@/components/ToolField.vue';
import ToolButton from '@/components/ToolButton.vue';
import ToolAlert from '@/components/ToolAlert.vue';
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

const { t } = useI18n();
const U = 'tools.math-evaluator.ui.';

const showReference = ref<boolean>(false);

const resultText = computed(() => {
  const o = outcome.value;
  if (!o || !o.ok) return '';
  return formatResult(o.result);
});


const referenceSections = computed<Array<{
  title: string;
  items: Array<{ token: string; desc: string }>;
}>>(() => {
  const d = (k: string) => t(`${U}refd.${k}`);
  return [
    {
      title: t(U + 'refOperators'),
      items: [
        { token: '+', desc: d('add') },
        { token: '-', desc: d('sub') },
        { token: '*', desc: d('mul') },
        { token: '/', desc: d('div') },
        { token: '^', desc: d('pow') },
        { token: '%', desc: d('mod') },
        { token: '!', desc: d('fact') },
        { token: '(...)', desc: d('group') },
      ],
    },
    {
      title: t(U + 'refFunctions'),
      items: [
        { token: 'sin(x)', desc: d('sin') },
        { token: 'cos(x)', desc: d('cos') },
        { token: 'tan(x)', desc: d('tan') },
        { token: 'log(x)', desc: d('log') },
        { token: 'ln(x)', desc: d('ln') },
        { token: 'sqrt(x)', desc: d('sqrt') },
        { token: 'abs(x)', desc: d('abs') },
        { token: 'round(x)', desc: d('round') },
        { token: 'floor(x)', desc: d('floor') },
        { token: 'ceil(x)', desc: d('ceil') },
      ],
    },
    {
      title: t(U + 'refConstants'),
      items: [
        { token: 'pi', desc: d('pi') },
        { token: 'e', desc: d('e') },
      ],
    },
  ];
});

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
  <div class="qt-tool">
    <ToolInput
      :title="t(U + 'inputTitle')"
      :description="t(U + 'desc')"
    >
      <template #actions>
        <ToolButton
          variant="primary"
          :disabled="input.trim().length === 0 || loading"
          @click="recompute"
        >
          <Calculator :size="14" />
          <span>{{ t(U + 'evaluate') }}</span>
        </ToolButton>
      </template>

      <ToolField
        v-model="input"
        :label="t(U + 'fieldExpression')"
        as="textarea"
        mono
        id="me-input"
        :placeholder="t(U + 'placeholder')"
        :rows="3"
        spellcheck="false"
        autocomplete="off"
        style="min-height: 72px"
        @keydown.ctrl.enter="recompute"
        @keydown.meta.enter="recompute"
      />

      <button
        type="button"
        class="me__ref-toggle"
        :aria-expanded="showReference"
        @click="showReference = !showReference"
      >
        <component :is="showReference ? ChevronDown : ChevronRight" :size="14" />
        <span>{{ t(U + 'refToggle') }}</span>
      </button>
      <div v-if="showReference" class="qt-panel qt-stack" style="--qt-stack-gap:12px;padding:10px 12px">
        <section
          v-for="section in referenceSections"
          :key="section.title"
        >
          <h4 class="qt-stat-head" style="font-size:12px;margin:0 0 6px">{{ section.title }}</h4>
          <div class="qt-grid" style="--qt-grid-min:180px;--qt-grid-gap:6px">
            <button
              v-for="item in section.items"
              :key="item.token"
              type="button"
              class="me__ref-item"
              :title="item.desc"
              @click="insertToken(item.token)"
            >
              <code class="qt-mono" style="font-size:12.5px;color:var(--qt-accent);white-space:nowrap">{{ item.token }}</code>
              <span style="font-size:12px;color:var(--qt-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{{ item.desc }}</span>
            </button>
          </div>
        </section>
      </div>
    </ToolInput>

    <ToolOutput
      :title="t('common.result')"
      :description="outcome && outcome.ok ? t(U + 'descDone') : t(U + 'descEmpty')"
      :copy-text="resultText"
      :copy-label="t('common.copyResult')"
    >
      <ToolAlert v-if="outcome && !outcome.ok" kind="error">
        {{ outcome.message }}
      </ToolAlert>
      <template v-else>
        <ToolAlert v-if="!outcome && !loading" kind="empty">
          {{ t(U + 'descEmpty') }}
        </ToolAlert>
        <div v-if="outcome && outcome.ok" class="qt-panel" style="padding:10px 12px">
          <div class="qt-row qt-row--center" style="--qt-row-gap:10px">
            <code class="qt-mono" style="font-size:13.5px;color:var(--qt-muted);word-break:break-word">{{ outcome.expression }}</code>
            <span style="font-size:14px;color:var(--qt-muted)">=</span>
            <span class="qt-mono" style="font-size:20px;font-weight:700;color:var(--qt-text);word-break:break-word">{{ resultText }}</span>
            <CopyButton :text="resultText" :label="t('common.copy')" icon-only />
          </div>
        </div>
        <div v-if="loading && !outcome" class="qt-row qt-row--center" style="--qt-row-gap:8px;color:var(--qt-muted);font-size:13px">
          <Loader2 :size="14" class="qt-spin" />
          <span>{{ t(U + 'loadingParser') }}</span>
        </div>
      </template>
    </ToolOutput>

    <section v-if="history.length > 0" class="qt-panel qt-stack" style="--qt-stack-gap:8px;padding:10px 12px">
      <header class="qt-row qt-row--center" style="--qt-row-gap:8px;justify-content:space-between;flex-wrap:nowrap">
        <span class="qt-row qt-row--center" style="--qt-row-gap:6px;font-size:12.5px;font-weight:700;color:var(--qt-text);flex-wrap:nowrap">
          <History :size="14" />
          <span>{{ t(U + 'historyCount', { n: history.length }) }}</span>
        </span>
        <button
          type="button"
          class="me__history-clear"
          @click="clearHistory"
          :title="t(U + 'clearHistoryTitle')"
        >
          <Trash2 :size="13" />
          <span>{{ t('common.clear') }}</span>
        </button>
      </header>
      <ul class="qt-list qt-stack" style="--qt-stack-gap:4px">
        <li
          v-for="(entry, i) in history"
          :key="`${entry.at}-${i}`"
          class="qt-row qt-row--center"
          style="--qt-row-gap:6px;flex-wrap:nowrap"
        >
          <button
            type="button"
            class="me__history-btn"
            :title="t(U + 'rerunTitle', { expr: entry.expression })"
            @click="reuse(entry)"
          >
            <code class="qt-mono" style="font-size:12.5px;color:var(--qt-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{{ entry.expression }}</code>
            <span style="font-size:12.5px;color:var(--qt-muted)">=</span>
            <span class="qt-mono" style="font-size:12.5px;font-weight:600;color:var(--qt-text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{{ formatResult(entry.result) }}</span>
          </button>
          <CopyButton :text="formatResult(entry.result)" :label="t('common.copy')" icon-only />
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
/* Kept scoped: interactive elements with hover states (no generic utility). */

/* Reference toggle — ghost text button. */
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

/* Reference item — bordered token button with accent hover. */
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

/* History clear — pill button that turns danger on hover. */
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

/* History entry — full-width ghost button with subtle hover. */
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
</style>
