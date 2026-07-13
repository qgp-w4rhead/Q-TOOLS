<script setup lang="ts">
/**
 * JwtParser — decode and inspect a JSON Web Token.
 *
 * Splits the compact JWS form (`header.payload.signature`), base64url-decodes
 * each segment, parses the header and payload as JSON, and renders the
 * signature as a hex string. The standard registered timestamp claims (`exp`,
 * `iat`, `nbf`) are shown as human-readable local + UTC dates, and the token's
 * temporal validity is colour-coded (green = valid, red = expired, amber =
 * not-yet-valid).
 *
 * No external dependencies — only the native `atob` / `TextDecoder` APIs.
 *
 * Works in embed mode: receives `input` PostMessages to pre-fill the token;
 * sends `output` PostMessages with `{ header, payload, signature, algorithm,
 * validity, exp, iat, nbf }` whenever the result changes.
 */
import { computed } from 'vue';
import { AlertTriangle, Clock, KeyRound, ShieldCheck, ShieldX } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import CopyButton from '@/components/CopyButton.vue';
import {
  useJwtParser,
  type JwtValidityStatus,
} from './useJwtParser';

const { token, result, error } = useJwtParser();

const hasInput = computed(() => token.value.trim().length > 0);

const validityClass = computed<`jwt__badge--${JwtValidityStatus}`>(() => {
  const status = result.value?.validity.status ?? 'unknown';
  return `jwt__badge--${status}`;
});

const validityIcon = computed(() => {
  const status = result.value?.validity.status ?? 'unknown';
  if (status === 'valid') return ShieldCheck;
  if (status === 'expired' || status === 'not-yet-valid') return ShieldX;
  return AlertTriangle;
});

function onToken(e: Event): void {
  token.value = (e.target as HTMLTextAreaElement).value;
}
</script>

<template>
  <div class="jwt">
    <ToolInput
      title="JWT token"
      description="Paste a JSON Web Token (compact JWS form: header.payload.signature). Decoding is client-side only — the signature is not verified."
    >
      <textarea
        class="jwt__textarea"
        placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c"
        :value="token"
        spellcheck="false"
        autocomplete="off"
        autocapitalize="off"
        rows="4"
        @input="onToken"
      />
    </ToolInput>

    <ToolOutput
      title="Decoded token"
      :description="result ? 'Header, payload, and signature decoded.' : 'Paste a JWT above to decode it.'"
    >
      <template v-if="!hasInput">
        <p class="jwt__empty">Paste a JWT above to decode it.</p>
      </template>
      <template v-else-if="error">
        <div class="jwt__error">
          <AlertTriangle :size="14" />
          <span>{{ error.message }}</span>
        </div>
      </template>
      <template v-else-if="result">
        <!-- Validity badge -->
        <div class="jwt__validity">
          <span class="jwt__badge" :class="validityClass">
            <component :is="validityIcon" :size="13" />
            <span>{{ result.validity.status }}</span>
          </span>
          <span class="jwt__validity-msg">{{ result.validity.message }}</span>
        </div>

        <!-- Header meta row -->
        <div class="jwt__meta">
          <div class="jwt__meta-item">
            <KeyRound :size="12" />
            <span class="jwt__meta-label">alg</span>
            <code class="jwt__meta-value">{{ result.algorithm ?? '—' }}</code>
          </div>
          <div v-if="result.type" class="jwt__meta-item">
            <span class="jwt__meta-label">typ</span>
            <code class="jwt__meta-value">{{ result.type }}</code>
          </div>
          <div v-if="result.keyId" class="jwt__meta-item">
            <span class="jwt__meta-label">kid</span>
            <code class="jwt__meta-value">{{ result.keyId }}</code>
          </div>
          <div class="jwt__meta-item">
            <span class="jwt__meta-label">sig</span>
            <code class="jwt__meta-value">{{ result.signatureLength }} bytes</code>
          </div>
        </div>

        <!-- Date claims -->
        <div v-if="result.dates.exp || result.dates.iat || result.dates.nbf" class="jwt__dates">
          <div v-if="result.dates.exp" class="jwt__date-row">
            <Clock :size="12" />
            <span class="jwt__date-label">exp (expiry)</span>
            <span class="jwt__date-value">{{ result.dates.exp }}</span>
          </div>
          <div v-if="result.dates.iat" class="jwt__date-row">
            <Clock :size="12" />
            <span class="jwt__date-label">iat (issued at)</span>
            <span class="jwt__date-value">{{ result.dates.iat }}</span>
          </div>
          <div v-if="result.dates.nbf" class="jwt__date-row">
            <Clock :size="12" />
            <span class="jwt__date-label">nbf (not before)</span>
            <span class="jwt__date-value">{{ result.dates.nbf }}</span>
          </div>
        </div>

        <!-- Header -->
        <section class="jwt__section">
          <header class="jwt__section-head">
            <h3 class="jwt__section-title">Header</h3>
            <CopyButton
              :text="result.header.pretty || result.header.raw"
              label="Copy"
              icon-only
            />
          </header>
          <p v-if="result.header.error" class="jwt__part-error">
            {{ result.header.error }}
          </p>
          <pre v-else class="jwt__json">{{ result.header.pretty }}</pre>
        </section>

        <!-- Payload -->
        <section class="jwt__section">
          <header class="jwt__section-head">
            <h3 class="jwt__section-title">Payload</h3>
            <CopyButton
              :text="result.payload.pretty || result.payload.raw"
              label="Copy"
              icon-only
            />
          </header>
          <p v-if="result.payload.error" class="jwt__part-error">
            {{ result.payload.error }}
          </p>
          <pre v-else class="jwt__json">{{ result.payload.pretty }}</pre>
        </section>

        <!-- Signature -->
        <section class="jwt__section">
          <header class="jwt__section-head">
            <h3 class="jwt__section-title">Signature (hex)</h3>
            <CopyButton :text="result.signatureHex" label="Copy" icon-only />
          </header>
          <code class="jwt__sig">{{ result.signatureHex || '(empty — alg=none)' }}</code>
        </section>

        <p class="jwt__hint">
          <AlertTriangle :size="12" />
          <span>
            The signature is decoded and displayed only — it is not
            cryptographically verified. Do not trust token contents without
            verifying against the issuer's public key.
          </span>
        </p>
      </template>
    </ToolOutput>
  </div>
</template>

<style scoped>
.jwt {
  display: flex;
  flex-direction: column;
  gap: var(--qt-gap);
  max-width: var(--qt-max-content);
  margin: 0 auto;
}
.jwt__textarea {
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
.jwt__textarea:focus {
  border-color: var(--qt-accent);
  outline: none;
  box-shadow: 0 0 0 2px oklch(from var(--qt-accent) 90% c h / 0.25);
}
.jwt__empty {
  margin: 0;
  color: var(--qt-muted);
  font-size: 13.5px;
}
.jwt__error {
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
.jwt__error svg {
  color: var(--qt-danger);
  flex-shrink: 0;
}
.jwt__validity {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}
.jwt__badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  border: 1px solid transparent;
}
.jwt__badge--valid {
  background: oklch(from var(--qt-success) 35% c h / 0.2);
  border-color: oklch(from var(--qt-success) 60% c h / 0.55);
  color: var(--qt-success);
}
.jwt__badge--expired {
  background: oklch(from var(--qt-danger) 35% c h / 0.2);
  border-color: oklch(from var(--qt-danger) 60% c h / 0.55);
  color: var(--qt-danger);
}
.jwt__badge--not-yet-valid {
  background: oklch(from var(--qt-warning) 35% c h / 0.2);
  border-color: oklch(from var(--qt-warning) 60% c h / 0.55);
  color: var(--qt-warning);
}
.jwt__badge--unknown {
  background: var(--qt-surface);
  border-color: var(--qt-border);
  color: var(--qt-muted);
}
.jwt__validity-msg {
  font-size: 13px;
  color: var(--qt-muted);
}
.jwt__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  padding: 10px 12px;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  margin-bottom: 12px;
}
.jwt__meta-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12.5px;
}
.jwt__meta-item svg {
  color: var(--qt-muted);
}
.jwt__meta-label {
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  font-size: 11px;
  color: var(--qt-muted);
}
.jwt__meta-value {
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
  font-size: 12.5px;
  color: var(--qt-text);
}
.jwt__dates {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px 12px;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  margin-bottom: 12px;
}
.jwt__date-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12.5px;
  flex-wrap: wrap;
}
.jwt__date-row svg {
  color: var(--qt-muted);
  flex-shrink: 0;
}
.jwt__date-label {
  font-weight: 700;
  color: var(--qt-muted);
  min-width: 130px;
}
.jwt__date-value {
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
  color: var(--qt-text);
}
.jwt__section {
  margin-bottom: 12px;
}
.jwt__section:last-of-type {
  margin-bottom: 0;
}
.jwt__section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}
.jwt__section-title {
  margin: 0;
  font-size: 12.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--qt-muted);
}
.jwt__json {
  margin: 0;
  padding: 10px 12px;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
  font-size: 12.5px;
  color: var(--qt-text);
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 320px;
  overflow: auto;
}
.jwt__part-error {
  margin: 0;
  padding: 10px 12px;
  background: oklch(from var(--qt-warning) 35% c h / 0.18);
  border: 1px solid oklch(from var(--qt-warning) 60% c h / 0.5);
  border-radius: var(--qt-radius-sm);
  font-size: 12.5px;
  color: var(--qt-text);
}
.jwt__sig {
  display: block;
  margin: 0;
  padding: 10px 12px;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
  font-size: 12px;
  color: var(--qt-text);
  word-break: break-all;
  white-space: pre-wrap;
}
.jwt__hint {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin: 10px 0 0;
  font-size: 12px;
  color: var(--qt-muted);
  line-height: 1.5;
}
.jwt__hint svg {
  flex-shrink: 0;
  margin-top: 1px;
}
@media (max-width: 640px) {
  .jwt__date-label {
    min-width: 0;
  }
}
</style>
