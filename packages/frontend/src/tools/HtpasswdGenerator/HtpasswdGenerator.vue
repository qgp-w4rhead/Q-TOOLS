<script setup lang="ts">
/**
 * HtpasswdGenerator - build `username:hash` lines for Apache/Nginx
 * `.htpasswd` basic-auth files.
 *
 * Three schemes: bcrypt `$2y$` (recommended, via lazy-loaded hash-wasm),
 * Apache MD5 `$apr1$` (implemented over hash-wasm's md5), and legacy SHA-1
 * `{SHA}` (Web Crypto, weak). bcrypt/apr1 regenerate on a debounce since they
 * are intentionally slow.
 *
 * Works in embed mode: receives `input` PostMessages with `{ username,
 * password, scheme, cost }`; sends `output` PostMessages with `{ line }`.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { Eye, EyeOff, Loader2, Lock } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import ToolField from '@/components/ToolField.vue';
import ToolAlert from '@/components/ToolAlert.vue';
import CopyButton from '@/components/CopyButton.vue';
import {
  useHtpasswdGenerator,
  HTPASSWD_SCHEMES,
  MIN_COST,
  MAX_COST,
} from './useHtpasswdGenerator';

const { t } = useI18n();
const U = 'tools.htpasswd-generator.ui.';

const {
  username,
  password,
  showPassword,
  scheme,
  cost,
  line,
  busy,
  error,
} = useHtpasswdGenerator();

const passwordType = computed(() => (showPassword.value ? 'text' : 'password'));
</script>

<template>
  <div class="qt-tool">
    <ToolInput
      :title="t(U + 'inputTitle')"
      :description="t(U + 'desc')"
    >
      <div class="htp__grid">
        <ToolField
          v-model="username"
          :label="t(U + 'userLabel')"
          placeholder="admin"
          spellcheck="false"
          autocomplete="off"
          autocapitalize="off"
        />
        <label class="qt-field" style="min-width:0">
          <span class="qt-label"><Lock :size="13" /> {{ t(U + 'pwLabel') }}</span>
          <div class="htp__pw">
            <input
              class="qt-input qt-input--mono"
              style="padding-right:38px"
              :type="passwordType"
              placeholder="••••••••"
              v-model="password"
              spellcheck="false"
              autocomplete="off"
            />
            <button
              type="button"
              class="htp__pw-btn"
              :title="showPassword ? t(U + 'hideTitle') : t(U + 'showTitle')"
              :aria-pressed="showPassword"
              @click="showPassword = !showPassword"
            >
              <component :is="showPassword ? EyeOff : Eye" :size="14" />
            </button>
          </div>
        </label>
      </div>

      <div class="qt-row qt-row--bottom" style="--qt-row-gap:14px">
        <label class="qt-field" style="flex:1;min-width:220px">
          <span class="qt-label">{{ t(U + 'schemeLabel') }}</span>
          <select class="qt-input" v-model="scheme">
            <option v-for="s in HTPASSWD_SCHEMES" :key="s.id" :value="s.id">{{ s.label }}</option>
          </select>
        </label>
        <ToolField
          v-if="scheme === 'bcrypt'"
          v-model.number="cost"
          :label="t(U + 'costLabel', { min: MIN_COST, max: MAX_COST })"
          type="number"
          :min="MIN_COST"
          :max="MAX_COST"
          style="flex:0 0 160px;min-width:0"
        />
      </div>
    </ToolInput>

    <ToolOutput
      :title="t(U + 'outTitle')"
      :description="line ? t(U + 'descOk') : t(U + 'descEmpty')"
      :copy-text="line"
      :copy-label="t(U + 'copyLabel')"
    >
      <template v-if="error">
        <ToolAlert kind="error">{{ error }}</ToolAlert>
      </template>
      <template v-else-if="!line">
        <ToolAlert kind="empty">
          <Loader2 v-if="busy" :size="14" class="qt-spin" />
          {{ busy ? t(U + 'alertBusy') : t(U + 'alertEmpty') }}
        </ToolAlert>
      </template>
      <template v-else>
        <div class="qt-result-row" style="flex-wrap:nowrap">
          <code class="qt-mono" style="font-size:12.5px;color:var(--qt-accent);font-weight:600;word-break:break-all;white-space:pre-wrap;min-width:0">{{ line }}</code>
          <CopyButton :text="line" :label="t('common.copy')" icon-only />
        </div>
        <p v-if="scheme === 'sha1'" class="qt-hint" style="color:var(--qt-warning);margin-top:4px">
          {{ t(U + 'sha1Warn') }}
        </p>
      </template>
    </ToolOutput>
  </div>
</template>

<style scoped>
/* Kept scoped: patterns unique to this tool (no generic utility). */

/* 2-col credential grid — collapses to stacked on narrow. */
.htp__grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}
@media (max-width: 640px) {
  .htp__grid { grid-template-columns: 1fr; }
}

/* Password input wrap + eye toggle button. */
.htp__pw { position: relative; display: flex; align-items: center; }
.htp__pw-btn {
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
}
.htp__pw-btn:hover { color: var(--qt-accent); background: var(--qt-surface); }
</style>
