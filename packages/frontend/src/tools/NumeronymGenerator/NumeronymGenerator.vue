<script setup lang="ts">
/**
 * NumeronymGenerator - convert words or phrases into numeronyms.
 *
 * A numeronym keeps the first and last letters of a word and replaces the
 * middle with the count of omitted letters (e.g. "internationalization" →
 * "i18n"). Words shorter than the configurable minimum length are left
 * verbatim; non-word separators (whitespace, punctuation) are preserved. An
 * optional toggle controls whether the first/last letters keep their original
 * case.
 *
 * Works in embed mode: receives `input` PostMessages to set the text and
 * options, and sends `output` PostMessages with the generated numeronym and
 * per-word breakdown.
 */
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { RotateCcw } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import CopyButton from '@/components/CopyButton.vue';
import {
  useNumeronymGenerator,
  MIN_LENGTH_FLOOR,
  MIN_LENGTH_CEIL,
} from './useNumeronymGenerator';

const { input, minLength, preserveCase, output, tokens, reset } =
  useNumeronymGenerator();

// Debounce the recompute so typing stays responsive. The composable watches
// `input` directly; we just buffer the textarea value and flush on a timer.
const draft = ref<string>(input.value);
let timer: ReturnType<typeof setTimeout> | null = null;

function onInput(e: Event): void {
  draft.value = (e.target as HTMLTextAreaElement).value;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    input.value = draft.value;
  }, 150);
}

function onMinLength(e: Event): void {
  minLength.value = Number((e.target as HTMLInputElement).value);
}

function onPreserveCase(e: Event): void {
  preserveCase.value = (e.target as HTMLInputElement).checked;
}

function onReset(): void {
  if (timer) clearTimeout(timer);
  reset();
  draft.value = '';
}

function onSwap(): void {
  if (timer) clearTimeout(timer);
  draft.value = output.value;
  input.value = output.value;
}

const { t } = useI18n();
const U = 'tools.numeronym-generator.ui.';

const abbreviatedCount = () => tokens.value.filter((t) => t.abbreviated).length;
const summary = () =>
  t(U + 'summary', { abbr: abbreviatedCount(), total: tokens.value.length });
</script>

<template>
  <div class="qt-tool">
    <ToolInput
      :title="t('common.input')"
      :description="t(U + 'desc')"
    >
      <template #actions>
        <button
          type="button"
          class="qt-btn qt-btn--ghost"
          :title="t(U + 'clearTitle')"
          @click="onReset"
        >
          <RotateCcw :size="14" />
          <span>{{ t('common.clear') }}</span>
        </button>
      </template>

      <textarea
        class="qt-input"
        style="min-height:120px;line-height:1.6;padding:12px 14px"
        spellcheck="false"
        :placeholder="t(U + 'placeholder')"
        :value="draft"
        @input="onInput"
        :aria-label="t(U + 'ariaInput')"
      ></textarea>

      <div class="qt-row qt-row--bottom" style="--qt-row-gap:16px;margin-top:12px">
        <label class="qt-field">
          <span class="qt-label">{{ t(U + 'minWordLength') }}</span>
          <input
            type="number"
            class="qt-input"
            style="width:90px"
            :min="MIN_LENGTH_FLOOR"
            :max="MIN_LENGTH_CEIL"
            :value="minLength"
            @input="onMinLength"
          />
        </label>
        <label class="qt-check">
          <input
            type="checkbox"
            style="width:16px;height:16px"
            :checked="preserveCase"
            @change="onPreserveCase"
          />
          <span class="qt-label">{{ t(U + 'preserveCase') }}</span>
        </label>
      </div>
    </ToolInput>

    <ToolOutput
      :title="t(U + 'outputTitle')"
      :description="summary()"
    >
      <template #actions>
        <button
          type="button"
          class="qt-btn qt-btn--ghost"
          :title="t(U + 'useAsInputTitle')"
          :disabled="output.length === 0"
          @click="onSwap"
        >
          <span>{{ t(U + 'useAsInput') }}</span>
        </button>
      </template>

      <div class="qt-output-wrap">
        <textarea
          class="qt-output"
          style="min-height:120px"
          readonly
          spellcheck="false"
          :value="output"
          :aria-label="t(U + 'ariaOutput')"
        ></textarea>
        <CopyButton
          :text="output"
          :label="t('common.copy')"
          class="qt-copy-float"
        />
      </div>

      <div v-if="tokens.length > 0" style="margin-top:16px">
        <div class="qt-stat-head" style="margin-bottom:8px">{{ t(U + 'breakdown') }}</div>
        <table class="ng__table">
          <thead>
            <tr>
              <th scope="col">{{ t(U + 'colOriginal') }}</th>
              <th scope="col">{{ t(U + 'colNumeronym') }}</th>
              <th scope="col" class="ng__num">{{ t(U + 'colLength') }}</th>
              <th scope="col" class="ng__num">{{ t(U + 'colOmitted') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="token in tokens"
              :key="token.original"
              :class="{ 'ng__row--skip': !token.abbreviated }"
            >
              <td class="qt-mono">{{ token.original }}</td>
              <td class="qt-mono" style="color:var(--qt-accent);font-weight:600">{{ token.numeronym }}</td>
              <td class="ng__num">{{ token.length }}</td>
              <td class="ng__num">
                {{ token.abbreviated ? token.omitted : '-' }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </ToolOutput>
  </div>
</template>

<style scoped>
/* Kept scoped: patterns unique to this tool (no generic utility). */

/* Per-word breakdown table — bordered rows, dimmed non-abbreviated rows. */
.ng__table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13.5px;
}
.ng__table th,
.ng__table td {
  text-align: left;
  padding: 7px 10px;
  border-bottom: 1px solid var(--qt-border);
}
.ng__table th {
  font-size: 11.5px;
  font-weight: 600;
  color: var(--qt-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.ng__table tbody tr:last-child td {
  border-bottom: none;
}
.ng__row--skip {
  opacity: 0.55;
}
.ng__num {
  text-align: right;
  font-variant-numeric: tabular-nums;
}
</style>
