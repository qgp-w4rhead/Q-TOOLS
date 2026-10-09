<script setup lang="ts">
/**
 * BasicAuthGenerator - generate HTTP Basic Authentication headers.
 *
 * Takes a username + password pair and produces an
 * `Authorization: Basic <base64>` header. The base64 encoding is UTF-8 safe
 * (TextEncoder + btoa), so non-ASCII credentials (emojis, CJK, accented
 * letters) work correctly - unlike the naive `btoa(user + ':' + pass)` call
 * which throws on characters outside the Latin-1 range.
 *
 * No external dependencies.
 *
 * Works in embed mode: receives `input` PostMessages to pre-fill the username
 * and password; sends `output` PostMessages with `{ header, token, credentials }`
 * whenever the result changes.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
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

const { t } = useI18n();
const U = 'tools.basic-auth-generator.ui.';

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
  <div class="qt-tool">
    <ToolInput
      :title="t(U + 'inputTitle')"
      :description="t(U + 'desc')"
    >
      <div class="qt-grid" style="--qt-grid-min:240px;--qt-grid-gap:14px">
        <label class="qt-field">
          <span class="qt-label">
            <User :size="13" />
            <span>{{ t(U + 'username') }}</span>
          </span>
          <input
            class="qt-input"
            type="text"
            placeholder="admin"
            :value="username"
            spellcheck="false"
            autocomplete="off"
            autocapitalize="off"
            @input="onUsername"
          />
        </label>

        <label class="qt-field">
          <span class="qt-label">
            <Lock :size="13" />
            <span>{{ t(U + 'password') }}</span>
          </span>
          <div class="qt-input-wrap">
            <input
              class="qt-input qt-input--mono"
              :type="passwordType"
              placeholder="••••••••"
              :value="password"
              spellcheck="false"
              autocomplete="off"
              @input="onPassword"
            />
            <button
              type="button"
              class="qt-input-btn"
              :title="showPassword ? t(U + 'hidePassword') : t(U + 'showPassword')"
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
      :title="t(U + 'outputTitle')"
      :description="result ? t(U + 'descReady') : t(U + 'descEmpty')"
      :copy-text="result?.header ?? ''"
      :copy-label="t(U + 'copyHeader')"
    >
      <template v-if="!hasInput">
        <p class="qt-alert qt-alert--empty">
          {{ t(U + 'empty') }}
        </p>
      </template>
      <template v-else>
        <div class="qt-stack" style="--qt-stack-gap:8px">
          <div class="basic-auth__result-row">
            <span class="qt-stat-head">{{ t(U + 'labelHeader') }}</span>
            <code class="qt-mono basic-auth__code basic-auth__code--header">{{ result?.header ?? '-' }}</code>
            <CopyButton :text="result?.header ?? ''" icon-only />
          </div>
          <div class="basic-auth__result-row">
            <span class="qt-stat-head">{{ t(U + 'labelToken') }}</span>
            <code class="qt-mono basic-auth__code">{{ result?.token ?? '-' }}</code>
            <CopyButton :text="result?.token ?? ''" icon-only />
          </div>
          <div class="basic-auth__result-row">
            <span class="qt-stat-head">{{ t(U + 'labelCredentials') }}</span>
            <code class="qt-mono basic-auth__code">{{ result?.credentials ?? '-' }}</code>
            <CopyButton :text="result?.credentials ?? ''" icon-only />
          </div>
        </div>
        <p class="qt-row qt-row--center qt-hint" style="--qt-row-gap:6px;margin:6px 0 0">
          <KeyRound :size="12" />
          <span>{{ t(U + 'hint') }}</span>
        </p>
      </template>
    </ToolOutput>
  </div>
</template>

<style scoped>
/* Kept scoped: patterns unique to this tool (no generic utility). */

/* Result rows — fixed-label 3-col grid (label / code / copy). */
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
.basic-auth__code {
  margin: 0;
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
@media (max-width: 640px) {
  .basic-auth__result-row {
    grid-template-columns: 80px 1fr auto;
    gap: 8px;
  }
}
</style>
