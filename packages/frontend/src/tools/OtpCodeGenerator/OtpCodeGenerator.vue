<script setup lang="ts">
/**
 * OtpCodeGenerator — generate TOTP (RFC 6238) one-time passwords from a
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
  <div class="otp">
    <ToolInput
      title="Shared secret"
      description="Enter the base32 shared secret from your provider (A–Z, 2–7; spaces and hyphens are ignored), or generate a fresh 160-bit secret."
    >
      <div class="otp__grid">
        <label class="otp__field otp__field--full">
          <span class="otp__label">
            <KeyRound :size="13" />
            <span>Secret (base32)</span>
          </span>
          <div class="otp__row">
            <input
              class="otp__input otp__input--mono"
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
              class="otp__btn otp__btn--ghost"
              title="Generate a random 160-bit secret"
              @click="generateRandomSecret"
            >
              <RefreshCw :size="14" />
              <span>Generate</span>
            </button>
          </div>
        </label>

        <label class="otp__field">
          <span class="otp__label">
            <Building2 :size="13" />
            <span>Issuer (site name)</span>
          </span>
          <input
            class="otp__input"
            type="text"
            placeholder="GitHub"
            :value="issuer"
            spellcheck="false"
            autocomplete="off"
            @input="issuer = ($event.target as HTMLInputElement).value"
          />
        </label>

        <label class="otp__field">
          <span class="otp__label">
            <User :size="13" />
            <span>Account (label)</span>
          </span>
          <input
            class="otp__input"
            type="text"
            placeholder="user@example.com"
            :value="account"
            spellcheck="false"
            autocomplete="off"
            @input="account = ($event.target as HTMLInputElement).value"
          />
        </label>

        <label class="otp__field">
          <span class="otp__label">
            <Hash :size="13" />
            <span>Digits</span>
          </span>
          <select class="otp__input otp__select" :value="digits" @change="onDigits">
            <option v-for="d in _DIGIT_OPTIONS" :key="d" :value="d">{{ d }} digits</option>
          </select>
        </label>

        <label class="otp__field">
          <span class="otp__label">
            <Clock :size="13" />
            <span>Period</span>
          </span>
          <select class="otp__input otp__select" :value="period" @change="onPeriod">
            <option v-for="p in _PERIOD_OPTIONS" :key="p" :value="p">{{ p }} seconds</option>
          </select>
        </label>

        <label class="otp__field">
          <span class="otp__label">
            <Smartphone :size="13" />
            <span>Algorithm</span>
          </span>
          <select class="otp__input otp__select" :value="algorithm" @change="onAlgorithm">
            <option v-for="a in _ALGORITHMS" :key="a.id" :value="a.id">{{ a.label }}</option>
          </select>
        </label>
      </div>
    </ToolInput>

    <ToolOutput
      title="Current code"
      :description="hasSecret ? 'TOTP code refreshes automatically at each period boundary.' : 'Enter a base32 secret to generate a TOTP code.'"
    >
      <template v-if="!hasSecret">
        <p class="otp__empty">Enter a base32 secret above to generate a TOTP code.</p>
      </template>
      <template v-else-if="error">
        <p class="otp__error">{{ error }}</p>
      </template>
      <template v-else>
        <div class="otp__code-block">
          <div class="otp__code-main">
            <span class="otp__code" :class="{ 'otp__code--low': snapshot && snapshot.remaining <= 5 }">
              {{ snapshot?.current ?? '····' }}
            </span>
            <CopyButton
              v-if="snapshot"
              :text="snapshot.current"
              label="Copy code"
            />
          </div>
          <div class="otp__countdown" v-if="snapshot">
            <div class="otp__countdown-bar">
              <div
                class="otp__countdown-fill"
                :style="{ width: `${(snapshot.progress * 100).toFixed(1)}%` }"
              ></div>
            </div>
            <span class="otp__countdown-text">
              <Clock :size="12" />
              <span>{{ snapshot.remaining }}s remaining</span>
              <span class="otp__countdown-dot" v-if="computing">·</span>
            </span>
          </div>
        </div>

        <div class="otp__next" v-if="snapshot">
          <span class="otp__next-label">Next code ({{ snapshot.period }}s)</span>
          <span class="otp__next-code">{{ snapshot.next }}</span>
          <CopyButton :text="snapshot.next" label="Copy next" />
        </div>
      </template>
    </ToolOutput>

    <ToolOutput
      v-if="hasSecret && !error"
      title="Provisioning QR code"
      description="Scan this with Google Authenticator, Authy, 1Password, or any TOTP app to add the account."
      :copy-text="uri"
      copy-label="Copy otpauth URI"
    >
      <div class="otp__qr">
        <img v-if="qrDataUrl" :src="qrDataUrl" alt="OTP provisioning QR code" class="otp__qr-img" />
        <div v-else class="otp__qr-placeholder">Generating QR…</div>
        <pre class="otp__uri"><code>{{ uri }}</code></pre>
      </div>
    </ToolOutput>
  </div>
</template>

<style scoped>
.otp {
  display: flex;
  flex-direction: column;
  gap: var(--qt-gap);
  max-width: var(--qt-max-content);
  margin: 0 auto;
}
.otp__grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}
.otp__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.otp__field--full {
  grid-column: 1 / -1;
}
.otp__label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--qt-muted);
}
.otp__row {
  display: flex;
  gap: 8px;
  align-items: stretch;
}
.otp__input {
  flex: 1;
  width: 100%;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  color: var(--qt-text);
  font: inherit;
  font-size: 14px;
  padding: 9px 12px;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;
  will-change: border-color;
}
.otp__input:focus {
  border-color: var(--qt-accent);
  outline: none;
  box-shadow: 0 0 0 2px oklch(from var(--qt-accent) 90% c h / 0.25);
}
.otp__input--mono {
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
  letter-spacing: 0.02em;
}
.otp__select {
  appearance: none;
  cursor: pointer;
  background-image: url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 10px center;
  padding-right: 30px;
}
.otp__btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0 14px;
  font-size: 13px;
  font-weight: 600;
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  background: var(--qt-surface);
  color: var(--qt-text);
  cursor: pointer;
  white-space: nowrap;
  transition:
    border-color 0.15s ease,
    background 0.15s ease;
  will-change: border-color;
}
.otp__btn:hover {
  border-color: var(--qt-accent);
}
.otp__btn--ghost {
  background: transparent;
}
.otp__empty,
.otp__error {
  margin: 0;
  font-size: 13.5px;
}
.otp__error {
  color: var(--qt-danger);
}
.otp__code-block {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.otp__code-main {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
}
.otp__code {
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
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
.otp__countdown {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
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
.otp__code--low ~ .otp__countdown .otp__countdown-fill {
  background: var(--qt-danger);
}
.otp__countdown-text {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  color: var(--qt-muted);
  font-variant-numeric: tabular-nums;
}
.otp__next {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: var(--qt-surface);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  flex-wrap: wrap;
}
.otp__next-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--qt-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.otp__next-code {
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
  font-size: 18px;
  font-weight: 700;
  letter-spacing: 0.12em;
  color: var(--qt-text);
  font-variant-numeric: tabular-nums;
}
.otp__qr {
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: flex-start;
}
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
.otp__uri {
  margin: 0;
  padding: 10px 12px;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
  font-size: 12.5px;
  line-height: 1.5;
  color: var(--qt-text);
  white-space: pre-wrap;
  word-break: break-all;
  width: 100%;
  max-height: 120px;
  overflow-y: auto;
}
.otp__uri code {
  font-family: inherit;
}
@media (max-width: 640px) {
  .otp__grid {
    grid-template-columns: 1fr;
  }
  .otp__code {
    font-size: 30px;
  }
}
</style>
