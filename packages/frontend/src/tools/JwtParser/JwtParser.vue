<script setup lang="ts">
/**
 * JwtParser - decode and inspect a JSON Web Token.
 *
 * Splits the compact JWS form (`header.payload.signature`), base64url-decodes
 * each segment, parses the header and payload as JSON, and renders the
 * signature as a hex string. The standard registered timestamp claims (`exp`,
 * `iat`, `nbf`) are shown as human-readable local + UTC dates, and the token's
 * temporal validity is colour-coded (green = valid, red = expired, amber =
 * not-yet-valid).
 *
 * No external dependencies - only the native `atob` / `TextDecoder` APIs.
 *
 * Works in embed mode: receives `input` PostMessages to pre-fill the token;
 * sends `output` PostMessages with `{ header, payload, signature, algorithm,
 * validity, exp, iat, nbf }` whenever the result changes.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { AlertTriangle, Clock, KeyRound, ShieldCheck, ShieldX } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import CopyButton from '@/components/CopyButton.vue';
import {
  useJwtParser,
  type JwtValidityStatus,
} from './useJwtParser';

const { token, result, error } = useJwtParser();

const { t } = useI18n();
const U = 'tools.jwt-parser.ui.';

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

const validityLabel = computed(() => {
  const status = result.value?.validity.status ?? 'unknown';
  const map: Record<JwtValidityStatus, string> = {
    valid: t(U + 'statusValid'),
    expired: t(U + 'statusExpired'),
    'not-yet-valid': t(U + 'statusNotYetValid'),
    unknown: t(U + 'statusUnknown'),
  };
  return map[status] ?? t(U + 'statusUnknown');
});

function onToken(e: Event): void {
  token.value = (e.target as HTMLTextAreaElement).value;
}
</script>

<template>
  <div class="qt-tool">
    <ToolInput
      :title="t(U + 'inputTitle')"
      :description="t(U + 'desc')"
    >
      <textarea
        class="qt-input qt-input--mono jwt__textarea"
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
      :title="t(U + 'outputTitle')"
      :description="result ? t(U + 'descDecoded') : t(U + 'descEmpty')"
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
        <!-- Validity badge -->
        <div class="qt-row qt-row--center" style="--qt-row-gap:10px;margin-bottom:12px">
          <span class="jwt__badge" :class="validityClass">
            <component :is="validityIcon" :size="13" />
            <span>{{ validityLabel }}</span>
          </span>
          <span class="qt-muted" style="font-size:13px">{{ result.validity.message }}</span>
        </div>

        <!-- Header meta row -->
        <div class="qt-row jwt__meta" style="--qt-row-gap:8px 16px">
          <div class="qt-row qt-row--center qt-row--nowrap jwt__meta-item" style="--qt-row-gap:6px">
            <KeyRound :size="12" />
            <span class="qt-stat-head">alg</span>
            <code class="qt-mono jwt__meta-value">{{ result.algorithm ?? '-' }}</code>
          </div>
          <div v-if="result.type" class="qt-row qt-row--center qt-row--nowrap jwt__meta-item" style="--qt-row-gap:6px">
            <span class="qt-stat-head">typ</span>
            <code class="qt-mono jwt__meta-value">{{ result.type }}</code>
          </div>
          <div v-if="result.keyId" class="qt-row qt-row--center qt-row--nowrap jwt__meta-item" style="--qt-row-gap:6px">
            <span class="qt-stat-head">kid</span>
            <code class="qt-mono jwt__meta-value">{{ result.keyId }}</code>
          </div>
          <div class="qt-row qt-row--center qt-row--nowrap jwt__meta-item" style="--qt-row-gap:6px">
            <span class="qt-stat-head">sig</span>
            <code class="qt-mono jwt__meta-value">{{ t(U + 'sigBytes', result.signatureLength) }}</code>
          </div>
        </div>

        <!-- Date claims -->
        <div v-if="result.dates.exp || result.dates.iat || result.dates.nbf" class="qt-result jwt__dates">
          <div v-if="result.dates.exp" class="qt-row qt-row--center jwt__date-row" style="--qt-row-gap:8px">
            <Clock :size="12" />
            <span class="jwt__date-label">{{ t(U + 'expLabel') }}</span>
            <span class="qt-mono jwt__date-value">{{ result.dates.exp }}</span>
          </div>
          <div v-if="result.dates.iat" class="qt-row qt-row--center jwt__date-row" style="--qt-row-gap:8px">
            <Clock :size="12" />
            <span class="jwt__date-label">{{ t(U + 'iatLabel') }}</span>
            <span class="qt-mono jwt__date-value">{{ result.dates.iat }}</span>
          </div>
          <div v-if="result.dates.nbf" class="qt-row qt-row--center jwt__date-row" style="--qt-row-gap:8px">
            <Clock :size="12" />
            <span class="jwt__date-label">{{ t(U + 'nbfLabel') }}</span>
            <span class="qt-mono jwt__date-value">{{ result.dates.nbf }}</span>
          </div>
        </div>

        <!-- Header -->
        <section class="jwt__section">
          <header class="qt-row qt-row--center qt-row--between qt-row--nowrap" style="margin-bottom:6px">
            <h3 class="qt-stat-head" style="margin:0">{{ t(U + 'headerTitle') }}</h3>
            <CopyButton
              :text="result.header.pretty || result.header.raw"
              icon-only
            />
          </header>
          <p v-if="result.header.error" class="jwt__part-error">
            {{ result.header.error }}
          </p>
          <pre v-else class="qt-output jwt__json">{{ result.header.pretty }}</pre>
        </section>

        <!-- Payload -->
        <section class="jwt__section">
          <header class="qt-row qt-row--center qt-row--between qt-row--nowrap" style="margin-bottom:6px">
            <h3 class="qt-stat-head" style="margin:0">{{ t(U + 'payloadTitle') }}</h3>
            <CopyButton
              :text="result.payload.pretty || result.payload.raw"
              icon-only
            />
          </header>
          <p v-if="result.payload.error" class="jwt__part-error">
            {{ result.payload.error }}
          </p>
          <pre v-else class="qt-output jwt__json">{{ result.payload.pretty }}</pre>
        </section>

        <!-- Signature -->
        <section class="jwt__section">
          <header class="qt-row qt-row--center qt-row--between qt-row--nowrap" style="margin-bottom:6px">
            <h3 class="qt-stat-head" style="margin:0">{{ t(U + 'signatureTitle') }}</h3>
            <CopyButton :text="result.signatureHex" icon-only />
          </header>
          <code class="qt-mono jwt__sig">{{ result.signatureHex || t(U + 'sigEmpty') }}</code>
        </section>

        <p class="qt-alert qt-alert--note jwt__hint">
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
.jwt__textarea {
  font-size: 13px;
  min-height: 96px;
}
/* Validity status pill — 4 colour-coded states (driven by validityClass). */
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
/* Meta strip — bordered horizontal wrap of label/value items (row via .qt-row). */
.jwt__meta {
  padding: 10px 12px;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  margin-bottom: 12px;
}
.jwt__meta-item {
  font-size: 12.5px;
}
.jwt__meta-item svg {
  color: var(--qt-muted);
}
.jwt__meta-value {
  font-size: 12.5px;
  color: var(--qt-text);
}
/* Date-claims card (base via .qt-result) — exp/iat/nbf rows. */
.jwt__dates {
  gap: 6px;
  margin-bottom: 12px;
}
.jwt__date-row {
  font-size: 12.5px;
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
  color: var(--qt-text);
}
/* Decoded sections — spaced blocks. */
.jwt__section {
  margin-bottom: 12px;
}
.jwt__section:last-of-type {
  margin-bottom: 0;
}
/* Pretty JSON block (base via .qt-output) — capped, scrollable. */
.jwt__json {
  margin: 0;
  font-size: 12.5px;
  max-height: 320px;
  overflow: auto;
}
/* Per-part parse warning — warning-tinted block. */
.jwt__part-error {
  margin: 0;
  padding: 10px 12px;
  background: oklch(from var(--qt-warning) 35% c h / 0.18);
  border: 1px solid oklch(from var(--qt-warning) 60% c h / 0.5);
  border-radius: var(--qt-radius-sm);
  font-size: 12.5px;
  color: var(--qt-text);
}
/* Signature hex block (font via .qt-mono) — bordered, break-all. */
.jwt__sig {
  display: block;
  margin: 0;
  padding: 10px 12px;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  font-size: 12px;
  color: var(--qt-text);
  word-break: break-all;
  white-space: pre-wrap;
}
/* Safety hint (base via .qt-alert--note) — top margin + icon nudge. */
.jwt__hint {
  margin-top: 10px;
  font-size: 12px;
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
