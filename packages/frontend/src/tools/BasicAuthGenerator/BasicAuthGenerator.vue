<script setup lang="ts">
/**
 * BasicAuthGenerator — generate HTTP Basic Authentication headers.
 *
 * Takes a username + password pair and produces an
 * `Authorization: Basic <base64>` header. The base64 encoding is UTF-8 safe
 * (TextEncoder + btoa), so non-ASCII credentials (emojis, CJK, accented
 * letters) work correctly — unlike the naive `btoa(user + ':' + pass)` call
 * which throws on characters outside the Latin-1 range.
 *
 * No external dependencies.
 *
 * Works in embed mode: receives `input` PostMessages to pre-fill the username
 * and password; sends `output` PostMessages with `{ header, token, credentials }`
 * whenever the result changes.
 */
import { computed } from 'vue';
import { Eye, EyeOff, KeyRound, User, Lock } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import CopyButton from '@/components/CopyButton.vue';
import { useBasicAuthGenerator } from './useBasicAuthGenerator';

const {
  username,
  password,
  showPassword,
  result,
} = useBasicAuthGenerator();

const hasInput = computed(
  () => username.value.length > 0 || password.value.length > 0,
);

const passwordType = computed(() => (showPassword.value ? 'text' : 'password'));

function onUsername(e: Event): void {
  username.value = (e.target as HTMLInputElement).value;
}
function onPassword(e: Event): void {
  password.value = (e.target as HTMLInputElement).value;
}
</script>

<template>
  <div class="basic-auth">
    <ToolInput
      title="Credentials"
      description="Enter a username and password to generate an HTTP Basic Authentication header. Encoding is UTF-8 safe."
    >
      <div class="basic-auth__grid">
        <label class="basic-auth__field">
          <span class="basic-auth__label">
            <User :size="13" />
            <span>Username</span>
          </span>
          <input
            class="basic-auth__input"
            type="text"
            placeholder="admin"
            :value="username"
            spellcheck="false"
            autocomplete="off"
            autocapitalize="off"
            @input="onUsername"
          />
        </label>

        <label class="basic-auth__field">
          <span class="basic-auth__label">
            <Lock :size="13" />
            <span>Password</span>
          </span>
          <div class="basic-auth__pw">
            <input
              class="basic-auth__input basic-auth__input--pw"
              :type="passwordType"
              placeholder="••••••••"
              :value="password"
              spellcheck="false"
              autocomplete="off"
              @input="onPassword"
            />
            <button
              type="button"
              class="basic-auth__pw-btn"
              :title="showPassword ? 'Hide password' : 'Show password'"
              :aria-pressed="showPassword"
              @click="showPassword = !showPassword"
            >
              <component :is="showPassword ? EyeOff : Eye" :size="14" />
            </button>
          </div>
        </label>
      </div>
    </ToolInput>

    <ToolOutput
      title="Authorization header"
      :description="result ? 'Ready to copy into your HTTP client.' : 'Enter a username or password above to generate the header.'"
      :copy-text="result?.header ?? ''"
      copy-label="Copy header"
    >
      <template v-if="!hasInput">
        <p class="basic-auth__empty">
          Enter a username or password above to generate the header.
        </p>
      </template>
      <template v-else>
        <div class="basic-auth__result">
          <div class="basic-auth__result-row">
            <span class="basic-auth__result-label">Header</span>
            <code class="basic-auth__code basic-auth__code--header">{{ result?.header ?? '—' }}</code>
            <CopyButton :text="result?.header ?? ''" label="Copy" icon-only />
          </div>
          <div class="basic-auth__result-row">
            <span class="basic-auth__result-label">Token</span>
            <code class="basic-auth__code">{{ result?.token ?? '—' }}</code>
            <CopyButton :text="result?.token ?? ''" label="Copy" icon-only />
          </div>
          <div class="basic-auth__result-row">
            <span class="basic-auth__result-label">Credentials</span>
            <code class="basic-auth__code">{{ result?.credentials ?? '—' }}</code>
            <CopyButton :text="result?.credentials ?? ''" label="Copy" icon-only />
          </div>
        </div>
        <p class="basic-auth__hint">
          <KeyRound :size="12" />
          <span>UTF-8 safe — non-ASCII characters (emojis, CJK, accents) are encoded correctly.</span>
        </p>
      </template>
    </ToolOutput>
  </div>
</template>

<style scoped>
.basic-auth {
  display: flex;
  flex-direction: column;
  gap: var(--qt-gap);
  max-width: var(--qt-max-content);
  margin: 0 auto;
}
.basic-auth__grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}
.basic-auth__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.basic-auth__label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--qt-muted);
}
.basic-auth__input {
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
.basic-auth__input:focus {
  border-color: var(--qt-accent);
  outline: none;
  box-shadow: 0 0 0 2px oklch(from var(--qt-accent) 90% c h / 0.25);
}
.basic-auth__pw {
  position: relative;
  display: flex;
  align-items: center;
}
.basic-auth__input--pw {
  padding-right: 38px;
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
}
.basic-auth__pw-btn {
  position: absolute;
  right: 6px;
  top: 50%;
  transform: translateY(-50%);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border: none;
  background: transparent;
  color: var(--qt-muted);
  border-radius: var(--qt-radius-sm);
  cursor: pointer;
  transition: color 0.15s ease, background 0.15s ease;
}
.basic-auth__pw-btn:hover {
  color: var(--qt-accent);
  background: var(--qt-surface);
}
.basic-auth__empty {
  margin: 0;
  color: var(--qt-muted);
  font-size: 13.5px;
}
.basic-auth__result {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.basic-auth__result-row {
  display: grid;
  grid-template-columns: 92px 1fr auto;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
}
.basic-auth__result-label {
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--qt-muted);
}
.basic-auth__code {
  margin: 0;
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
  font-size: 13.5px;
  color: var(--qt-text);
  word-break: break-all;
  white-space: pre-wrap;
  min-width: 0;
}
.basic-auth__code--header {
  font-weight: 600;
  color: var(--qt-accent);
}
.basic-auth__hint {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 6px 0 0;
  font-size: 12px;
  color: var(--qt-muted);
}
@media (max-width: 640px) {
  .basic-auth__grid {
    grid-template-columns: 1fr;
  }
  .basic-auth__result-row {
    grid-template-columns: 80px 1fr auto;
    gap: 8px;
  }
}
</style>
