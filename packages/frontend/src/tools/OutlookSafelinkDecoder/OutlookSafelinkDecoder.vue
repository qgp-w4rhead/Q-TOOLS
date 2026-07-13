<script setup lang="ts">
/**
 * OutlookSafelinkDecoder — recover the original destination URL from a
 * Microsoft Defender for Office 365 (Safe Links) wrapped URL.
 *
 * Safelinks rewrite every hyperlink through a regional scanning host:
 *
 *   https://nam04.safelinks.protection.outlook.com/?url=<encoded>&data=…&sdata=…&reserved=0
 *
 * The original destination is stored percent-encoded (sometimes
 * double-encoded) in the `url` query parameter. This tool decodes it and
 * surfaces the safelink metadata — regional host, recipient email and
 * timestamp embedded in the `data` field, plus the `sdata`/`reserved` params.
 *
 * No external dependencies — only the native `URL` / `decodeURIComponent`
 * APIs.
 *
 * Works in embed mode: receives `input`/`url`/`safelink` PostMessages to
 * pre-fill the input; sends `output` PostMessages with `{ originalUrl, host,
 * region, decodePasses, recipient, timestamp, sdata, reserved }` whenever the
 * result changes.
 */
import { computed } from 'vue';
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

const hasInput = computed(() => input.value.trim().length > 0);

const timestampDisplay = computed(() => {
  const ms = result.value?.data?.timestamp ?? null;
  if (ms === null) return null;
  const d = new Date(ms);
  if (!Number.isFinite(d.getTime())) return null;
  const pad = (n: number): string => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}:${pad(d.getSeconds())} local`;
});

function onInput(e: Event): void {
  input.value = (e.target as HTMLTextAreaElement).value;
}
</script>

<template>
  <div class="sl">
    <ToolInput
      title="Safelinks URL"
      description="Paste a Microsoft Defender Safe Links wrapped URL. Decoding is client-side only — no data leaves your browser."
    >
      <textarea
        class="sl__textarea"
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
      title="Decoded URL"
      :description="result ? 'Original destination recovered from the safelink wrapper.' : 'Paste a Safelinks URL above to decode it.'"
    >
      <template v-if="!hasInput">
        <p class="sl__empty">Paste a Safelinks URL above to decode it.</p>
      </template>
      <template v-else-if="error">
        <div class="sl__error">
          <AlertTriangle :size="14" />
          <span>{{ error.message }}</span>
        </div>
      </template>
      <template v-else-if="result">
        <!-- Original URL -->
        <div class="sl__result">
          <div class="sl__result-head">
            <span class="sl__result-label">Original URL</span>
            <div class="sl__result-actions">
              <a
                v-if="result.originalUrl"
                class="sl__btn sl__btn--ghost"
                :href="result.originalUrl"
                target="_blank"
                rel="noopener noreferrer"
                title="Open the original URL in a new tab"
              >
                <ExternalLink :size="13" />
                <span>Open</span>
              </a>
              <CopyButton :text="result.originalUrl" label="Copy" icon-only />
            </div>
          </div>
          <code class="sl__code sl__code--primary">{{ result.originalUrl || '—' }}</code>
        </div>

        <!-- Meta row -->
        <div class="sl__meta">
          <div class="sl__meta-item">
            <Globe :size="12" />
            <span class="sl__meta-label">host</span>
            <code class="sl__meta-value">{{ result.host }}</code>
          </div>
          <div v-if="result.region" class="sl__meta-item">
            <span class="sl__meta-label">region</span>
            <code class="sl__meta-value">{{ result.region }}</code>
          </div>
          <div class="sl__meta-item">
            <ShieldCheck :size="12" />
            <span class="sl__meta-label">decode passes</span>
            <code class="sl__meta-value">{{ result.decodePasses }}</code>
          </div>
          <div v-if="result.reserved !== null" class="sl__meta-item">
            <span class="sl__meta-label">reserved</span>
            <code class="sl__meta-value">{{ result.reserved }}</code>
          </div>
        </div>

        <!-- Recipient + timestamp from data field -->
        <div
          v-if="result.data && (result.data.recipient || timestampDisplay)"
          class="sl__data"
        >
          <div v-if="result.data.recipient" class="sl__data-row">
            <Mail :size="12" />
            <span class="sl__data-label">recipient</span>
            <span class="sl__data-value">{{ result.data.recipient }}</span>
          </div>
          <div v-if="timestampDisplay" class="sl__data-row">
            <Clock :size="12" />
            <span class="sl__data-label">timestamp</span>
            <span class="sl__data-value">{{ timestampDisplay }}</span>
          </div>
        </div>

        <!-- sdata -->
        <section v-if="result.sdata" class="sl__section">
          <header class="sl__section-head">
            <h3 class="sl__section-title">sdata</h3>
            <CopyButton :text="result.sdata" label="Copy" icon-only />
          </header>
          <code class="sl__code">{{ result.sdata }}</code>
        </section>

        <!-- raw data field -->
        <section v-if="result.data && result.data.raw" class="sl__section">
          <header class="sl__section-head">
            <h3 class="sl__section-title">data (raw)</h3>
            <CopyButton :text="result.data.raw" label="Copy" icon-only />
          </header>
          <code class="sl__code sl__code--break">{{ result.data.raw }}</code>
        </section>

        <p class="sl__hint">
          <AlertTriangle :size="12" />
          <span>
            Decoding only recovers the destination — it does not validate that
            the original URL is safe. Follow your organisation's link-checking
            policy before opening recovered links.
          </span>
        </p>
      </template>
    </ToolOutput>
  </div>
</template>

<style scoped>
.sl {
  display: flex;
  flex-direction: column;
  gap: var(--qt-gap);
  max-width: var(--qt-max-content);
  margin: 0 auto;
}
.sl__textarea {
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
  min-height: 96px;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;
  will-change: border-color;
}
.sl__textarea:focus {
  border-color: var(--qt-accent);
  outline: none;
  box-shadow: 0 0 0 2px oklch(from var(--qt-accent) 90% c h / 0.25);
}
.sl__empty {
  margin: 0;
  color: var(--qt-muted);
  font-size: 13.5px;
}
.sl__error {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  background: oklch(from var(--qt-danger) 35% c h / 0.18);
  border: 1px solid oklch(from var(--qt-danger) 60% c h / 0.5);
  border-radius: var(--qt-radius-sm);
  color: var(--qt-text);
  font-size: 13.5px;
}
.sl__error svg {
  color: var(--qt-danger);
  flex-shrink: 0;
}
.sl__result {
  background: oklch(from var(--qt-success) 35% c h / 0.12);
  border: 1px solid oklch(from var(--qt-success) 60% c h / 0.45);
  border-radius: var(--qt-radius-sm);
  padding: 10px 12px;
  margin-bottom: 12px;
}
.sl__result-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 6px;
}
.sl__result-label {
  font-size: 12.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--qt-success);
}
.sl__result-actions {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.sl__code {
  display: block;
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
  font-size: 13px;
  color: var(--qt-text);
  word-break: break-all;
  white-space: pre-wrap;
}
.sl__code--primary {
  font-size: 14px;
  font-weight: 600;
}
.sl__code--break {
  word-break: break-all;
}
.sl__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  padding: 10px 12px;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  margin-bottom: 12px;
}
.sl__meta-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12.5px;
}
.sl__meta-item svg {
  color: var(--qt-muted);
}
.sl__meta-label {
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  font-size: 11px;
  color: var(--qt-muted);
}
.sl__meta-value {
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
  font-size: 12.5px;
  color: var(--qt-text);
}
.sl__data {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px 12px;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  margin-bottom: 12px;
}
.sl__data-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12.5px;
  flex-wrap: wrap;
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
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
  color: var(--qt-text);
  word-break: break-all;
}
.sl__section {
  margin-bottom: 12px;
}
.sl__section:last-of-type {
  margin-bottom: 0;
}
.sl__section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}
.sl__section-title {
  margin: 0;
  font-size: 12.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--qt-muted);
}
.sl__code {
  padding: 10px 12px;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
}
.sl__btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: var(--qt-accent);
  border: 1px solid var(--qt-accent);
  border-radius: var(--qt-radius-sm);
  color: var(--qt-bg);
  font: inherit;
  font-size: 12.5px;
  font-weight: 600;
  padding: 5px 10px;
  cursor: pointer;
  text-decoration: none;
  transition:
    transform 0.1s ease,
    opacity 0.15s ease;
  will-change: transform;
}
.sl__btn:hover {
  transform: translateY(-1px);
}
.sl__btn--ghost {
  background: transparent;
  color: var(--qt-text);
  border-color: var(--qt-border);
}
.sl__btn--ghost:hover {
  border-color: var(--qt-accent);
  color: var(--qt-accent);
}
.sl__hint {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin: 10px 0 0;
  font-size: 12px;
  color: var(--qt-muted);
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
