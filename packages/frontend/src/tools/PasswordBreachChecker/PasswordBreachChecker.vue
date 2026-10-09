<script setup lang="ts">
/**
 * PasswordBreachChecker - check if a password has appeared in known data
 * breaches using the HaveIBeenPwned k-anonymity API.
 *
 * The password is never sent to the server - only the first 5 characters of
 * its SHA-1 hash are sent, and the client filters the response.
 */
import { watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { RotateCcw, Eye, EyeOff, ShieldCheck, ShieldAlert, ShieldX, Loader2 } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import ToolButton from '@/components/ToolButton.vue';
import {
  usePasswordBreachChecker,
} from './usePasswordBreachChecker';

const { t } = useI18n();
const U = 'tools.password-breach-checker.ui.';

const {
  password,
  showPassword,
  result,
  isChecking,
  check,
  reset,
} = usePasswordBreachChecker();

const statusIcon = {
  idle: ShieldX,
  checking: Loader2,
  safe: ShieldCheck,
  breached: ShieldAlert,
  error: ShieldX,
};

const statusColor = {
  idle: 'var(--qt-muted)',
  checking: 'var(--qt-accent)',
  safe: 'var(--qt-success)',
  breached: 'var(--qt-danger)',
  error: 'var(--qt-danger)',
};

function onPassword(e: Event): void {
  password.value = (e.target as HTMLInputElement).value;
}

// Auto-check on Enter or debounced
let debounceTimer: ReturnType<typeof setTimeout> | undefined;
watch(password, () => {
  if (debounceTimer) clearTimeout(debounceTimer);
  if (!password.value) {
    reset();
    return;
  }
  debounceTimer = setTimeout(() => check(), 500);
});
</script>

<template>
  <div class="qt-tool">
    <ToolInput
      :title="t(U + 'inputTitle')"
      :description="t(U + 'desc')"
    >
      <template #actions>
        <ToolButton :title="t('common.reset')" @click="reset">
          <RotateCcw :size="14" />
          <span>{{ t('common.reset') }}</span>
        </ToolButton>
      </template>

      <div class="qt-field">
        <span class="qt-label">{{ t(U + 'pwLabel') }}</span>
        <div class="qt-row" style="--qt-row-gap:8px;flex-wrap:nowrap">
          <input
            :type="showPassword ? 'text' : 'password'"
            class="qt-input"
            style="flex:1"
            :placeholder="t(U + 'phPassword')"
            :value="password"
            @input="onPassword"
            @keydown.enter="check"
            autocomplete="off"
            spellcheck="false"
          />
          <button
            type="button"
            class="qt-btn qt-btn--ghost"
            style="padding:8px"
            :title="showPassword ? t(U + 'hideTitle') : t(U + 'showTitle')"
            @click="showPassword = !showPassword"
          >
            <EyeOff v-if="showPassword" :size="16" />
            <Eye v-else :size="16" />
          </button>
        </div>
      </div>

      <div class="qt-row" style="--qt-row-gap:8px">
        <ToolButton
          variant="primary"
          :disabled="!password || isChecking"
          @click="check"
        >
          <Loader2 v-if="isChecking" :size="14" class="qt-spin" />
          <span>{{ isChecking ? t(U + 'btnChecking') : t(U + 'btnCheck') }}</span>
        </ToolButton>
      </div>
    </ToolInput>

    <ToolOutput
      :title="t('common.result')"
      :hide-copy="true"
    >
      <div class="pbc__result" :class="`pbc__result--${result.status}`">
        <component
          :is="statusIcon[result.status]"
          :size="32"
          :class="{ 'qt-spin': result.status === 'checking' }"
          :color="statusColor[result.status]"
        />
        <div class="qt-stack" style="--qt-stack-gap:4px">
          <p style="margin:0;font-size:14px;font-weight:600" :style="{ color: statusColor[result.status] }">
            {{ result.message }}
          </p>
          <p v-if="result.hashSuffix" class="qt-hint pbc__result-meta">
            {{ t(U + 'shaSuffix') }} <code>{{ result.hashSuffix }}</code>
          </p>
          <p v-if="result.error" class="qt-hint" style="color:var(--qt-danger)">{{ result.error }}</p>
        </div>
      </div>

      <div class="qt-note">
        <p class="qt-hint" style="line-height:1.5">
          {{ t(U + 'noteText') }}
        </p>
      </div>
    </ToolOutput>
  </div>
</template>

<style scoped>
/* Kept scoped: patterns unique to this tool (no generic utility). */

/* Status banner — big icon + message, border colored by verdict. */
.pbc__result {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px;
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  background: var(--qt-bg);
}
.pbc__result--safe {
  border-color: var(--qt-success);
}
.pbc__result--breached {
  border-color: var(--qt-danger);
}
.pbc__result--error {
  border-color: var(--qt-danger);
}

/* Inline code inside the meta line. */
.pbc__result-meta code {
  font-family: var(--qt-font-mono);
  font-size: 11.5px;
}
</style>
