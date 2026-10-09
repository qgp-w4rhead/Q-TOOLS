<script setup lang="ts">
/**
 * OtpCodeGenerator - generate TOTP (RFC 6238) one-time passwords from a
 * base32 shared secret.
 *
 * Inputs: secret (base32), account label, issuer label, digits (6/8),
 * period (15/30/60s), algorithm (SHA-1/SHA-256/SHA-512). Output: the current
 * TOTP code, a countdown timer, the next code, and an `otpauth://` provisioning
 * URI rendered as a QR code (scannable by Google Authenticator, Authy, 1Password,
 * etc.).
 *
 * Uses the Web Crypto API for HMAC; falls back to a pure-JS SHA-1 if SHA-1 is
 * restricted by the platform. No external dependencies beyond `qrcode` (initial
 * bundle).
 *
 * Works in embed mode: receives `input` PostMessages to pre-fill any field;
 * sends `output` PostMessages with `{ current, next, remaining, period, uri }`
 * whenever the snapshot changes.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { Smartphone, KeyRound, Building2, User, Clock, Hash, RefreshCw } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import CopyButton from '@/components/CopyButton.vue';
import {
  useOtpCodeGenerator,
  ALGORITHMS,
  DIGIT_OPTIONS,
  PERIOD_OPTIONS,
  type OtpAlgorithm,
  type OtpDigits,
  type OtpPeriod,
} from './useOtpCodeGenerator';

const {
  secret,
  account,
  issuer,
  digits,
  period,
  algorithm,
  snapshot,
  uri,
  qrDataUrl,
  error,
  computing,
} = useOtpCodeGenerator();

const { t } = useI18n();
const U = 'tools.otp-code-generator.ui.';

const hasSecret = computed(() => secret.value.trim().length > 0);

function onAlgorithm(e: Event): void {
  algorithm.value = (e.target as HTMLSelectElement).value as OtpAlgorithm;
}
function onDigits(e: Event): void {
  digits.value = Number((e.target as HTMLSelectElement).value) as OtpDigits;
}
function onPeriod(e: Event): void {
  period.value = Number((e.target as HTMLSelectElement).value) as OtpPeriod;
}

/** Generate a random 20-byte (160-bit) secret and base32-encode it. */
async function generateRandomSecret(): Promise<void> {
  // 20 bytes → 32 base32 chars (the canonical TOTP secret length).
  const bytes = new Uint8Array(20);
  crypto.getRandomValues(bytes);
  // Inline base32 encode to avoid importing the pure helper here.
  const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let value = 0;
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    value = (value << 8) | bytes[i]!;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      out += ALPHA[(value >>> bits) & 0x1f]!;
    }
  }
  if (bits > 0) {
    out += ALPHA[(value << (5 - bits)) & 0x1f]!;
  }
  // Group into 4-char blocks for readability.
  secret.value = out.match(/.{1,4}/g)?.join(' ') ?? out;
}

// Re-export for template usage.
const _ALGORITHMS = ALGORITHMS;
const _DIGIT_OPTIONS = DIGIT_OPTIONS;
const _PERIOD_OPTIONS = PERIOD_OPTIONS;
</script>

<template>
  <div class="qt-tool">
    <ToolInput
      :title="t(U + 'inputTitle')"
      :description="t(U + 'desc')"
    >
      <div class="qt-grid" style="--qt-grid-min:240px;--qt-grid-gap:14px">
        <label class="qt-field otp__field--full">
          <span class="qt-label">
            <KeyRound :size="13" />
            <span>{{ t(U + 'fieldSecret') }}</span>
          </span>
          <div class="qt-row" style="--qt-row-gap:8px">
            <input
              class="qt-input qt-input--mono otp__input"
              type="text"
              placeholder="JBSWY3DPEHPK3PXP"
              :value="secret"
              spellcheck="false"
              autocomplete="off"
              autocapitalize="off"
              @input="secret = ($event.target as HTMLInputElement).value"
            />
            <button
              type="button"
              class="qt-btn qt-btn--ghost"
              :title="t(U + 'generateTitle')"
              @click="generateRandomSecret"
            >
              <RefreshCw :size="14" />
              <span>{{ t('common.generate') }}</span>
            </button>
          </div>
        </label>

        <label class="qt-field">
          <span class="qt-label">
            <Building2 :size="13" />
            <span>{{ t(U + 'fieldIssuer') }}</span>
          </span>
          <input
            class="qt-input"
            type="text"
            placeholder="GitHub"
            :value="issuer"
            spellcheck="false"
            autocomplete="off"
            @input="issuer = ($event.target as HTMLInputElement).value"
          />
        </label>

        <label class="qt-field">
          <span class="qt-label">
            <User :size="13" />
            <span>{{ t(U + 'fieldAccount') }}</span>
          </span>
          <input
            class="qt-input"
            type="text"
            placeholder="user@example.com"
            :value="account"
            spellcheck="false"
            autocomplete="off"
            @input="account = ($event.target as HTMLInputElement).value"
          />
        </label>

        <label class="qt-field">
          <span class="qt-label">
            <Hash :size="13" />
            <span>{{ t(U + 'fieldDigits') }}</span>
          </span>
          <select class="qt-input" :value="digits" @change="onDigits">
            <option v-for="d in _DIGIT_OPTIONS" :key="d" :value="d">{{ t(U + 'digitsOption', d) }}</option>
          </select>
        </label>

        <label class="qt-field">
          <span class="qt-label">
            <Clock :size="13" />
            <span>{{ t(U + 'fieldPeriod') }}</span>
          </span>
          <select class="qt-input" :value="period" @change="onPeriod">
            <option v-for="p in _PERIOD_OPTIONS" :key="p" :value="p">{{ t(U + 'periodOption', p) }}</option>
          </select>
        </label>

        <label class="qt-field">
          <span class="qt-label">
            <Smartphone :size="13" />
            <span>{{ t(U + 'fieldAlgorithm') }}</span>
          </span>
          <select class="qt-input" :value="algorithm" @change="onAlgorithm">
            <option v-for="a in _ALGORITHMS" :key="a.id" :value="a.id">{{ a.label }}</option>
          </select>
        </label>
      </div>
    </ToolInput>

    <ToolOutput
      :title="t(U + 'outputTitle')"
      :description="hasSecret ? t(U + 'descActive') : t(U + 'descEmpty')"
    >
      <template v-if="!hasSecret">
        <p class="qt-alert qt-alert--empty">{{ t(U + 'empty') }}</p>
      </template>
      <template v-else-if="error">
        <p class="qt-alert qt-alert--error">{{ error }}</p>
      </template>
      <template v-else>
        <div class="qt-stack" style="--qt-stack-gap:12px">
          <div class="qt-row qt-row--center" style="--qt-row-gap:14px">
            <span class="qt-mono otp__code" :class="{ 'otp__code--low': snapshot && snapshot.remaining <= 5 }">
              {{ snapshot?.current ?? '····' }}
            </span>
            <CopyButton
              v-if="snapshot"
              :text="snapshot.current"
              :label="t(U + 'copyCode')"
            />
          </div>
          <div class="qt-stack" style="--qt-stack-gap:6px" v-if="snapshot">
            <div class="otp__countdown-bar">
              <div
                class="otp__countdown-fill"
                :style="{ width: `${(snapshot.progress * 100).toFixed(1)}%` }"
              ></div>
            </div>
            <span class="qt-row qt-row--center qt-hint" style="--qt-row-gap:5px">
              <Clock :size="12" />
              <span>{{ t(U + 'remaining', snapshot.remaining) }}</span>
              <span class="otp__countdown-dot" v-if="computing">·</span>
            </span>
          </div>
        </div>

        <div class="qt-panel qt-row qt-row--center" style="--qt-row-gap:10px" v-if="snapshot">
          <span class="qt-stat-head">{{ t(U + 'nextCode', { period: snapshot.period }) }}</span>
          <span class="qt-mono otp__next-code">{{ snapshot.next }}</span>
          <CopyButton :text="snapshot.next" :label="t(U + 'copyNext')" />
        </div>
      </template>
    </ToolOutput>

    <ToolOutput
      v-if="hasSecret && !error"
      :title="t(U + 'qrTitle')"
      :description="t(U + 'qrDesc')"
      :copy-text="uri"
      :copy-label="t(U + 'copyUri')"
    >
      <div class="qt-stack" style="--qt-stack-gap:12px;align-items:flex-start">
        <img v-if="qrDataUrl" :src="qrDataUrl" :alt="t(U + 'qrAlt')" class="otp__qr-img" />
        <div v-else class="otp__qr-placeholder">{{ t(U + 'qrGenerating') }}</div>
        <pre class="qt-output otp__uri"><code>{{ uri }}</code></pre>
      </div>
    </ToolOutput>
  </div>
</template>

<style scoped>
/* Kept scoped: patterns unique to this tool (no generic utility). */

/* Full-width field spanning both grid columns (layout via .qt-field). */
.otp__field--full {
  grid-column: 1 / -1;
}
/* Secret input grows inside its row (control + mono via .qt-input--mono). */
.otp__input {
  flex: 1;
}
/* Big TOTP code (font via .qt-mono) — tabular, letter-spaced, low-time danger. */
.otp__code {
  font-size: 36px;
  font-weight: 700;
  letter-spacing: 0.18em;
  color: var(--qt-text);
  font-variant-numeric: tabular-nums;
  line-height: 1;
  padding: 4px 0;
  transition: color 0.2s ease;
}
.otp__code--low {
  color: var(--qt-danger);
}
/* Thin countdown bar + fill (turns danger when the code is about to roll). */
.otp__countdown-bar {
  width: 100%;
  height: 4px;
  background: var(--qt-border);
  border-radius: 999px;
  overflow: hidden;
}
.otp__countdown-fill {
  height: 100%;
  background: var(--qt-accent);
  border-radius: 999px;
  transition: width 1s linear, background 0.2s ease;
}
.otp__code--low ~ .qt-stack .otp__countdown-fill {
  background: var(--qt-danger);
}
/* Next-code value (font via .qt-mono) — tabular, letter-spaced. */
.otp__next-code {
  font-size: 18px;
  font-weight: 700;
  letter-spacing: 0.12em;
  color: var(--qt-text);
  font-variant-numeric: tabular-nums;
}
/* QR code image + generating placeholder (fixed 240px square). */
.otp__qr-img {
  width: 240px;
  height: 240px;
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  background: #ffffff;
  display: block;
}
.otp__qr-placeholder {
  width: 240px;
  height: 240px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  background: var(--qt-surface);
  color: var(--qt-muted);
  font-size: 13px;
}
/* otpauth URI block (base via .qt-output) — capped, scrollable, break-all. */
.otp__uri {
  margin: 0;
  max-height: 120px;
  overflow-y: auto;
  word-break: break-all;
  font-size: 12.5px;
}
.otp__uri code {
  font-family: inherit;
}
@media (max-width: 640px) {
  .otp__code {
    font-size: 30px;
  }
}
</style>
