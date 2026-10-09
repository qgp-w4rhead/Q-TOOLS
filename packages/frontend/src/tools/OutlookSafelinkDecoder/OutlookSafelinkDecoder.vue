<script setup lang="ts">
/**
 * OutlookSafelinkDecoder - recover the original destination URL from a
 * Microsoft Defender for Office 365 (Safe Links) wrapped URL.
 *
 * Safelinks rewrite every hyperlink through a regional scanning host:
 *
 *   https://nam04.safelinks.protection.outlook.com/?url=<encoded>&data=…&sdata=…&reserved=0
 *
 * The original destination is stored percent-encoded (sometimes
 * double-encoded) in the `url` query parameter. This tool decodes it and
 * surfaces the safelink metadata - regional host, recipient email and
 * timestamp embedded in the `data` field, plus the `sdata`/`reserved` params.
 *
 * No external dependencies - only the native `URL` / `decodeURIComponent`
 * APIs.
 *
 * Works in embed mode: receives `input`/`url`/`safelink` PostMessages to
 * pre-fill the input; sends `output` PostMessages with `{ originalUrl, host,
 * region, decodePasses, recipient, timestamp, sdata, reserved }` whenever the
 * result changes.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  AlertTriangle,
  Clock,
  Mail,
  ExternalLink,
  Globe,
  ShieldCheck,
} from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import CopyButton from '@/components/CopyButton.vue';
import { useOutlookSafelinkDecoder } from './useOutlookSafelinkDecoder';

const { input, result, error } = useOutlookSafelinkDecoder();

const { t } = useI18n();
const U = 'tools.outlook-safelink-decoder.ui.';

const hasInput = computed(() => input.value.trim().length > 0);

const timestampDisplay = computed(() => {
  const ms = result.value?.data?.timestamp ?? null;
  if (ms === null) return null;
  const d = new Date(ms);
  if (!Number.isFinite(d.getTime())) return null;
  const pad = (n: number): string => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}:${pad(d.getSeconds())} ${t(U + 'localSuffix')}`;
});

function onInput(e: Event): void {
  input.value = (e.target as HTMLTextAreaElement).value;
}
</script>

<template>
  <div class="qt-tool">
    <ToolInput
      :title="t(U + 'inputTitle')"
      :description="t(U + 'desc')"
    >
      <textarea
        class="qt-input qt-input--mono sl__textarea"
        placeholder="https://nam04.safelinks.protection.outlook.com/?url=https%3A%2F%2Fexample.com%2F&data=05%7C01%7Cuser%40example.com%7C…&sdata=…&reserved=0"
        :value="input"
        spellcheck="false"
        autocomplete="off"
        autocapitalize="off"
        rows="4"
        @input="onInput"
      />
    </ToolInput>

    <ToolOutput
      :title="t(U + 'outputTitle')"
      :description="result ? t(U + 'descResult') : t(U + 'descEmpty')"
    >
      <template v-if="!hasInput">
        <p class="qt-alert qt-alert--empty">{{ t(U + 'empty') }}</p>
      </template>
      <template v-else-if="error">
        <div class="qt-banner qt-banner--error">
          <AlertTriangle :size="14" />
          <span>{{ error.message }}</span>
        </div>
      </template>
      <template v-else-if="result">
        <!-- Original URL -->
        <div class="sl__result">
          <div class="qt-row qt-row--center qt-row--between qt-row--nowrap" style="--qt-row-gap:8px;margin-bottom:6px">
            <span class="qt-stat-head sl__result-label">{{ t(U + 'originalUrl') }}</span>
            <div class="qt-row qt-row--center qt-row--nowrap" style="--qt-row-gap:6px">
              <a
                v-if="result.originalUrl"
                class="qt-btn qt-btn--ghost qt-btn--sm"
                :href="result.originalUrl"
                target="_blank"
                rel="noopener noreferrer"
                :title="t(U + 'openTitle')"
              >
                <ExternalLink :size="13" />
                <span>{{ t(U + 'open') }}</span>
              </a>
              <CopyButton :text="result.originalUrl" icon-only />
            </div>
          </div>
          <code class="qt-mono sl__code sl__code--primary">{{ result.originalUrl || '-' }}</code>
        </div>

        <!-- Meta row -->
        <div class="qt-row sl__meta" style="--qt-row-gap:8px 16px">
          <div class="qt-row qt-row--center qt-row--nowrap sl__meta-item" style="--qt-row-gap:6px">
            <Globe :size="12" />
            <span class="qt-stat-head">{{ t(U + 'host') }}</span>
            <code class="qt-mono sl__meta-value">{{ result.host }}</code>
          </div>
          <div v-if="result.region" class="qt-row qt-row--center qt-row--nowrap sl__meta-item" style="--qt-row-gap:6px">
            <span class="qt-stat-head">{{ t(U + 'region') }}</span>
            <code class="qt-mono sl__meta-value">{{ result.region }}</code>
          </div>
          <div class="qt-row qt-row--center qt-row--nowrap sl__meta-item" style="--qt-row-gap:6px">
            <ShieldCheck :size="12" />
            <span class="qt-stat-head">{{ t(U + 'decodePasses') }}</span>
            <code class="qt-mono sl__meta-value">{{ result.decodePasses }}</code>
          </div>
          <div v-if="result.reserved !== null" class="qt-row qt-row--center qt-row--nowrap sl__meta-item" style="--qt-row-gap:6px">
            <span class="qt-stat-head">{{ t(U + 'reserved') }}</span>
            <code class="qt-mono sl__meta-value">{{ result.reserved }}</code>
          </div>
        </div>

        <!-- Recipient + timestamp from data field -->
        <div
          v-if="result.data && (result.data.recipient || timestampDisplay)"
          class="qt-result sl__data"
        >
          <div v-if="result.data.recipient" class="qt-row qt-row--center sl__data-row" style="--qt-row-gap:8px">
            <Mail :size="12" />
            <span class="sl__data-label">{{ t(U + 'recipient') }}</span>
            <span class="qt-mono sl__data-value">{{ result.data.recipient }}</span>
          </div>
          <div v-if="timestampDisplay" class="qt-row qt-row--center sl__data-row" style="--qt-row-gap:8px">
            <Clock :size="12" />
            <span class="sl__data-label">{{ t(U + 'timestamp') }}</span>
            <span class="qt-mono sl__data-value">{{ timestampDisplay }}</span>
          </div>
        </div>

        <!-- sdata -->
        <section v-if="result.sdata" class="sl__section">
          <header class="qt-row qt-row--center qt-row--between qt-row--nowrap" style="margin-bottom:6px">
            <h3 class="qt-stat-head" style="margin:0">{{ t(U + 'sdataTitle') }}</h3>
            <CopyButton :text="result.sdata" icon-only />
          </header>
          <code class="qt-mono sl__code">{{ result.sdata }}</code>
        </section>

        <!-- raw data field -->
        <section v-if="result.data && result.data.raw" class="sl__section">
          <header class="qt-row qt-row--center qt-row--between qt-row--nowrap" style="margin-bottom:6px">
            <h3 class="qt-stat-head" style="margin:0">{{ t(U + 'dataRawTitle') }}</h3>
            <CopyButton :text="result.data.raw" icon-only />
          </header>
          <code class="qt-mono sl__code">{{ result.data.raw }}</code>
        </section>

        <p class="qt-alert qt-alert--note sl__hint">
          <AlertTriangle :size="12" />
          <span>{{ t(U + 'hint') }}</span>
        </p>
      </template>
    </ToolOutput>
  </div>
</template>

<style scoped>
/* Kept scoped: patterns unique to this tool (no generic utility). */

/* Input textarea floor (control + mono via .qt-input--mono). */
.sl__textarea {
  font-size: 13px;
  min-height: 96px;
}
/* Recovered-URL card — success-tinted callout. */
.sl__result {
  background: oklch(from var(--qt-success) 35% c h / 0.12);
  border: 1px solid oklch(from var(--qt-success) 60% c h / 0.45);
  border-radius: var(--qt-radius-sm);
  padding: 10px 12px;
  margin-bottom: 12px;
}
.sl__result-label {
  font-size: 12.5px;
  color: var(--qt-success);
}
/* Mono output block (font via .qt-mono) — bordered, break-all, pre-wrapped. */
.sl__code {
  display: block;
  font-size: 13px;
  color: var(--qt-text);
  word-break: break-all;
  white-space: pre-wrap;
  padding: 10px 12px;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
}
.sl__code--primary {
  font-size: 14px;
  font-weight: 600;
}
/* Meta strip — bordered horizontal wrap of label/value items (row via .qt-row). */
.sl__meta {
  padding: 10px 12px;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  margin-bottom: 12px;
}
.sl__meta-item {
  font-size: 12.5px;
}
.sl__meta-item svg {
  color: var(--qt-muted);
}
.sl__meta-value {
  font-size: 12.5px;
  color: var(--qt-text);
}
/* Data card (base via .qt-result) — recipient/timestamp rows. */
.sl__data {
  gap: 6px;
  margin-bottom: 12px;
}
.sl__data-row {
  font-size: 12.5px;
}
.sl__data-row svg {
  color: var(--qt-muted);
  flex-shrink: 0;
}
.sl__data-label {
  font-weight: 700;
  color: var(--qt-muted);
  min-width: 90px;
}
.sl__data-value {
  color: var(--qt-text);
  word-break: break-all;
}
/* Code sections — spaced blocks. */
.sl__section {
  margin-bottom: 12px;
}
.sl__section:last-of-type {
  margin-bottom: 0;
}
/* Safety hint (base via .qt-alert--note) — top margin + icon nudge. */
.sl__hint {
  margin-top: 10px;
  font-size: 12px;
  line-height: 1.5;
}
.sl__hint svg {
  flex-shrink: 0;
  margin-top: 1px;
}
@media (max-width: 640px) {
  .sl__data-label {
    min-width: 0;
  }
}
</style>
