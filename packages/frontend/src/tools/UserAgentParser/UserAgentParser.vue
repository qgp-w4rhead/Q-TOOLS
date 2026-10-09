<script setup lang="ts">
/**
 * UserAgentParser - parse a User-Agent string into browser / engine / OS /
 * device / CPU details.
 *
 * The `ua-parser-js` package is lazy-loaded inside the composable so it lands
 * in its own Vite chunk. The input is auto-filled from `navigator.userAgent`
 * on mount (no external dependency for that step), and a "Use my UA" button
 * re-applies it on demand.
 *
 * Works in embed mode: receives `input` PostMessages with `{ userAgent }` (or
 * `{ ua }` / `{ value }`) to pre-fill the string; sends `output` PostMessages
 * with the parsed fields whenever the result changes.
 */
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { Monitor, RefreshCw, Check, Copy, Loader2 } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import CopyButton from '@/components/CopyButton.vue';
import { useUserAgentParser, resultToText } from './useUserAgentParser';

const { userAgent, result, loading, error, useMyUa, recompute } =
  useUserAgentParser();

const { t } = useI18n();
const U = 'tools.user-agent-parser.ui.';

function groupLabel(id: string): string {
  return t(`${U}groups.${id}`);
}
const FIELD_LABEL_KEYS: Record<string, string> = {
  Name: 'name',
  Version: 'version',
  Type: 'type',
  Vendor: 'vendor',
  Model: 'model',
  Architecture: 'architecture',
};
function fieldLabel(label: string): string {
  const k = FIELD_LABEL_KEYS[label];
  return k ? t(`${U}fields.${k}`) : label;
}

const hasInput = computed(() => userAgent.value.trim().length > 0);
const totalFields = computed(() =>
  result.value ? result.value.groups.reduce((s, g) => s + g.fields.length, 0) : 0,
);

const copiedAll = ref(false);

async function onCopyAll(): Promise<void> {
  if (!result.value) return;
  const text = resultToText(result.value);
  try {
    await navigator.clipboard.writeText(text);
    copiedAll.value = true;
    setTimeout(() => {
      copiedAll.value = false;
    }, 1500);
  } catch {
    // CopyButton handles its own feedback; this is a best-effort bulk copy.
  }
}

function onInput(e: Event): void {
  userAgent.value = (e.target as HTMLTextAreaElement).value;
}
</script>

<template>
  <div class="qt-tool">
    <ToolInput
      :title="t(U + 'inputTitle')"
      :description="t(U + 'desc')"
    >
      <template #actions>
        <button class="qt-btn qt-btn--primary" type="button" @click="useMyUa">
          <Monitor :size="14" />
          <span>{{ t(U + 'useMyUa') }}</span>
        </button>
        <button
          class="qt-btn qt-btn--ghost"
          type="button"
          :disabled="!hasInput || loading"
          @click="recompute"
        >
          <RefreshCw :size="14" :class="{ 'qt-spin': loading }" />
          <span>{{ loading ? t(U + 'parsing') : t(U + 'reparse') }}</span>
        </button>
      </template>

      <textarea
        class="qt-input qt-input--mono ua__textarea"
        placeholder="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
        :value="userAgent"
        spellcheck="false"
        autocomplete="off"
        autocapitalize="off"
        rows="3"
        @input="onInput"
      />
    </ToolInput>

    <ToolOutput
      :title="t(U + 'outputTitle')"
      :description="result ? t(U + 'descResult', totalFields) : t(U + 'descEmpty')"
    >
      <template v-if="!hasInput">
        <p class="qt-alert qt-alert--empty">{{ t(U + 'empty') }}</p>
      </template>
      <template v-else-if="loading">
        <div class="qt-row qt-row--center ua__loading" style="--qt-row-gap:8px">
          <Loader2 :size="16" class="qt-spin" />
          <span>{{ t(U + 'loadingParser') }}</span>
        </div>
      </template>
      <template v-else-if="error">
        <div class="qt-banner qt-banner--error">
          <span>{{ error }}</span>
        </div>
      </template>
      <template v-else-if="result">
        <div class="qt-row qt-row--end" style="margin-bottom:10px">
          <button
            class="qt-btn qt-btn--ghost qt-btn--sm"
            type="button"
            @click="onCopyAll"
          >
            <component :is="copiedAll ? Check : Copy" :size="13" />
            <span>{{ copiedAll ? t('common.copiedFeedback') : t('common.copyAll') }}</span>
          </button>
        </div>

        <div class="qt-stack" style="--qt-stack-gap:18px">
          <section
            v-for="group in result.groups"
            :key="group.id"
            class="qt-stack"
            style="--qt-stack-gap:8px"
          >
            <h3 class="qt-stat-head ua__group-title">{{ groupLabel(group.id) }}</h3>
            <dl class="qt-stack" style="--qt-stack-gap:2px;margin:0">
              <div
                v-for="f in group.fields"
                :key="f.key"
                class="ua__row"
                :class="{ 'ua__row--unavailable': f.unavailable }"
              >
                <dt class="qt-label">{{ fieldLabel(f.label) }}</dt>
                <dd class="qt-mono ua__value" :title="f.value">{{ f.value || '-' }}</dd>
                <CopyButton
                  v-if="!f.unavailable"
                  :text="f.value"
                  class="ua__copy"
                />
              </div>
            </dl>
          </section>
        </div>
      </template>
    </ToolOutput>
  </div>
</template>

<style scoped>
/* Kept scoped: patterns unique to this tool (no generic utility). */

/* Input textarea floor (control + mono via .qt-input--mono). */
.ua__textarea {
  font-size: 13px;
  min-height: 72px;
}
/* Loading row (layout via .qt-row) — muted text + accent spinner. */
.ua__loading {
  color: var(--qt-muted);
  font-size: 13.5px;
}
.ua__loading svg {
  color: var(--qt-accent);
}
/* Group heading (base via .qt-stat-head) — bottom rule. */
.ua__group-title {
  margin: 0;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--qt-border);
  width: 100%;
}
/* Field rows — 3-col grid (key / value / copy) with hover reveal. */
.ua__row {
  display: grid;
  grid-template-columns: minmax(140px, 220px) 1fr auto;
  align-items: center;
  gap: 10px;
  padding: 7px 8px;
  border-radius: var(--qt-radius-sm);
  transition: background 0.12s ease;
}
.ua__row:hover {
  background: var(--qt-surface);
}
.ua__row--unavailable {
  opacity: 0.65;
}
.ua__value {
  margin: 0;
  font-size: 13.5px;
  color: var(--qt-text);
  word-break: break-word;
  min-width: 0;
}
.ua__copy {
  opacity: 0;
  transition: opacity 0.12s ease;
}
.ua__row:hover .ua__copy,
.ua__row:focus-within .ua__copy {
  opacity: 1;
}
@media (max-width: 640px) {
  .ua__row {
    grid-template-columns: minmax(110px, 160px) 1fr auto;
    gap: 8px;
  }
  .ua__copy {
    opacity: 1;
  }
}
</style>
