<script setup lang="ts">
/**
 * UserAgentParser — parse a User-Agent string into browser / engine / OS /
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
import { Monitor, RefreshCw, Check, Copy, Loader2 } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import CopyButton from '@/components/CopyButton.vue';
import { useUserAgentParser, resultToText } from './useUserAgentParser';

const { userAgent, result, loading, error, useMyUa, recompute } =
  useUserAgentParser();

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
  <div class="ua">
    <ToolInput
      title="User-agent string"
      description="Paste a User-Agent string to decode it into browser, engine, OS, device, and CPU details. Your current browser's UA is auto-filled on load."
    >
      <template #actions>
        <button class="ua__btn" type="button" @click="useMyUa">
          <Monitor :size="14" />
          <span>Use my UA</span>
        </button>
        <button
          class="ua__btn ua__btn--ghost"
          type="button"
          :disabled="!hasInput || loading"
          @click="recompute"
        >
          <RefreshCw :size="14" :class="{ 'ua__spin': loading }" />
          <span>{{ loading ? 'Parsing…' : 'Re-parse' }}</span>
        </button>
      </template>

      <textarea
        class="ua__textarea"
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
      title="Parsed result"
      :description="result ? `${totalFields} fields detected` : 'Paste a User-Agent above to parse it.'"
    >
      <template v-if="!hasInput">
        <p class="ua__empty">Paste a User-Agent above to parse it.</p>
      </template>
      <template v-else-if="loading">
        <div class="ua__loading">
          <Loader2 :size="16" class="ua__spin" />
          <span>Loading parser…</span>
        </div>
      </template>
      <template v-else-if="error">
        <div class="ua__error">
          <span>{{ error }}</span>
        </div>
      </template>
      <template v-else-if="result">
        <div class="ua__toolbar">
          <button
            class="ua__btn ua__btn--ghost ua__btn--sm"
            type="button"
            @click="onCopyAll"
          >
            <component :is="copiedAll ? Check : Copy" :size="13" />
            <span>{{ copiedAll ? 'Copied!' : 'Copy all' }}</span>
          </button>
        </div>

        <div class="ua__groups">
          <section
            v-for="group in result.groups"
            :key="group.id"
            class="ua__group"
          >
            <h3 class="ua__group-title">{{ group.label }}</h3>
            <dl class="ua__grid">
              <div
                v-for="f in group.fields"
                :key="f.key"
                class="ua__row"
                :class="{ 'ua__row--unavailable': f.unavailable }"
              >
                <dt class="ua__key">{{ f.label }}</dt>
                <dd class="ua__value" :title="f.value">{{ f.value || '—' }}</dd>
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
.ua {
  display: flex;
  flex-direction: column;
  gap: var(--qt-gap);
  max-width: var(--qt-max-content);
  margin: 0 auto;
}
.ua__btn {
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
.ua__btn:hover:not(:disabled) {
  transform: translateY(-1px);
}
.ua__btn:active:not(:disabled) {
  transform: translateY(0);
}
.ua__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.ua__btn--ghost {
  background: transparent;
  color: var(--qt-text);
  border-color: var(--qt-border);
}
.ua__btn--ghost:hover:not(:disabled) {
  border-color: var(--qt-accent);
  color: var(--qt-accent);
}
.ua__btn--sm {
  font-size: 12px;
  padding: 5px 10px;
}
.ua__spin {
  animation: ua-spin 0.8s linear infinite;
}
@keyframes ua-spin {
  to {
    transform: rotate(360deg);
  }
}
.ua__textarea {
  width: 100%;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  color: var(--qt-text);
  font: inherit;
  font-size: 13px;
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
  padding: 10px 12px;
  resize: vertical;
  min-height: 72px;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;
  will-change: border-color;
}
.ua__textarea:focus {
  border-color: var(--qt-accent);
  outline: none;
  box-shadow: 0 0 0 2px oklch(from var(--qt-accent) 90% c h / 0.25);
}
.ua__empty {
  margin: 0;
  color: var(--qt-muted);
  font-size: 13.5px;
}
.ua__loading {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--qt-muted);
  font-size: 13.5px;
}
.ua__loading svg {
  color: var(--qt-accent);
}
.ua__error {
  padding: 10px 12px;
  background: oklch(from var(--qt-danger) 35% c h / 0.18);
  border: 1px solid oklch(from var(--qt-danger) 60% c h / 0.5);
  border-radius: var(--qt-radius-sm);
  color: var(--qt-text);
  font-size: 13.5px;
}
.ua__toolbar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 10px;
}
.ua__groups {
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.ua__group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.ua__group-title {
  margin: 0;
  font-size: 12.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--qt-muted);
  padding-bottom: 6px;
  border-bottom: 1px solid var(--qt-border);
}
.ua__grid {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin: 0;
}
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
.ua__key {
  font-size: 13px;
  font-weight: 600;
  color: var(--qt-muted);
}
.ua__value {
  margin: 0;
  font-size: 13.5px;
  color: var(--qt-text);
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
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
