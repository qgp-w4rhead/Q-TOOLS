<script setup lang="ts">
/**
 * HmacGenerator - generate HMAC signatures.
 *
 * Supported algorithms: HMAC-SHA1, HMAC-SHA256, HMAC-SHA384, HMAC-SHA512 - all
 * via the Web Crypto API (`crypto.subtle.importKey` + `crypto.subtle.sign`).
 * No external dependencies.
 *
 * Works in embed mode: receives `input` PostMessages to pre-fill the message,
 * secret, and algorithm, and sends `output` PostMessages whenever the computed
 * signature changes.
 */
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { AlertCircle, Eye, EyeOff, Loader2 } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import CopyButton from '@/components/CopyButton.vue';
import {
  useHmacGenerator,
  ALGORITHMS,
  ALGORITHM_MAP,
  type HmacAlgorithm,
} from './useHmacGenerator';

const { t } = useI18n();

const {
  message,
  secret,
  algorithm,
  result,
  computing,
  error,
  recompute,
  setAlgorithm,
} = useHmacGenerator();

/** Toggle secret visibility (show/hide passphrase). */
const showSecret = ref(false);

/** Char count of the message (for the description line). */
const charCount = computed(() => message.value.length);

function onMessageInput(e: Event): void {
  message.value = (e.target as HTMLTextAreaElement).value;
}

function onSecretInput(e: Event): void {
  secret.value = (e.target as HTMLInputElement).value;
}

function onAlgorithmChange(e: Event): void {
  const value = (e.target as HTMLSelectElement).value as HmacAlgorithm;
  if (value in ALGORITHM_MAP) setAlgorithm(value);
}
</script>

<template>
  <div class="qt-tool">
    <ToolInput
      :title="t('common.input')"
      :description="t('tools.hmac-generator.ui.desc')"
    >
      <template #actions>
        <button
          class="qt-btn qt-btn--primary"
          type="button"
          :disabled="computing || message.length === 0"
          @click="recompute"
        >
          <Loader2 v-if="computing" :size="14" class="qt-spin" />
          <span>{{ computing ? t('tools.hmac-generator.ui.signing') : t('tools.hmac-generator.ui.sign') }}</span>
        </button>
      </template>

      <label class="qt-field">
        <span class="qt-label">{{ t('tools.hmac-generator.ui.message') }}</span>
        <textarea
          class="qt-input qt-input--mono hmac-gen__textarea"
          rows="5"
          :placeholder="t('tools.hmac-generator.ui.messagePlaceholder')"
          :value="message"
          spellcheck="false"
          autocomplete="off"
          @input="onMessageInput"
        />
      </label>

      <label class="qt-field">
        <span class="qt-label">{{ t('tools.hmac-generator.ui.secret') }}</span>
        <div class="qt-input-wrap">
          <input
            :type="showSecret ? 'text' : 'password'"
            class="qt-input"
            :placeholder="t('tools.hmac-generator.ui.secretPlaceholder')"
            :value="secret"
            spellcheck="false"
            autocomplete="off"
            @input="onSecretInput"
          />
          <button
            class="qt-input-btn"
            type="button"
            :title="showSecret ? t('tools.hmac-generator.ui.hideSecret') : t('tools.hmac-generator.ui.showSecret')"
            @click="showSecret = !showSecret"
          >
            <EyeOff v-if="showSecret" :size="16" />
            <Eye v-else :size="16" />
          </button>
        </div>
      </label>

      <label class="qt-field">
        <span class="qt-label">{{ t('tools.hmac-generator.ui.algorithm') }}</span>
        <select
          class="qt-input"
          :value="algorithm"
          @change="onAlgorithmChange"
        >
          <option v-for="a in ALGORITHMS" :key="a.id" :value="a.id">
            {{ a.label }} ({{ t('common.bits', { n: a.bits }) }})
          </option>
        </select>
      </label>
    </ToolInput>

    <ToolOutput
      :title="t('tools.hmac-generator.ui.outputTitle')"
      :description="result ? t('tools.hmac-generator.ui.outputDesc', {
        label: result.label,
        chars: t('tools.hmac-generator.ui.charCount', { n: charCount }, charCount),
      }) : ''"
      :copy-text="result?.hex ?? ''"
      :copy-label="t('tools.hmac-generator.ui.copyHex')"
    >
      <p v-if="error" class="qt-alert qt-alert--error">
        <AlertCircle :size="14" />
        <span>{{ error }}</span>
      </p>
      <p v-else-if="!result" class="qt-alert qt-alert--empty">
        {{ t('tools.hmac-generator.ui.empty') }}
      </p>
      <div v-else class="qt-stack">
        <div class="qt-result">
          <div class="qt-row qt-row--center qt-row--between qt-row--nowrap">
            <span class="hmac-gen__row-label">{{ t('tools.hmac-generator.ui.hex') }}</span>
            <CopyButton :text="result.hex" :label="t('common.copy')" icon-only />
          </div>
          <code class="qt-mono hmac-gen__code">{{ result.hex }}</code>
        </div>
        <div class="qt-result">
          <div class="qt-row qt-row--center qt-row--between qt-row--nowrap">
            <span class="hmac-gen__row-label">{{ t('tools.hmac-generator.ui.base64') }}</span>
            <CopyButton :text="result.base64" :label="t('common.copy')" icon-only />
          </div>
          <code class="qt-mono hmac-gen__code">{{ result.base64 }}</code>
        </div>
      </div>
    </ToolOutput>
  </div>
</template>

<style scoped>
/* Kept scoped: patterns unique to this tool (no generic utility). */

/* Message textarea floor height (control + mono via .qt-input--mono). */
.hmac-gen__textarea {
  min-height: 100px;
}
/* Result-row header label (text-colored, not muted). */
.hmac-gen__row-label {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--qt-text);
}
/* Signature value (font via .qt-mono). */
.hmac-gen__code {
  font-size: 12.5px;
  color: var(--qt-text);
  word-break: break-all;
  white-space: pre-wrap;
}
</style>
