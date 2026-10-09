<script setup lang="ts">
/**
 * EmailNormalizer - normalize an email address for comparison.
 *
 * Parses the input, validates it, and produces a canonical normalized form:
 * lowercased, with the `+suffix` sub-address tag stripped (all providers) and
 * dots stripped from the local part for Gmail-equivalent domains. The tool
 * also reports the local part, domain, validity, disposable-provider status,
 * and the human-readable provider name.
 *
 * No external dependencies.
 *
 * Works in embed mode: receives `email`/`input`/`value`/`address` PostMessages
 * to pre-fill the field; sends `output` PostMessages with
 * `{ normalized, localPart, domain, isValid, isDisposable, provider, … }`
 * whenever the result changes.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  AlertTriangle,
  AtSign,
  CheckCircle2,
  Mail,
  ShieldAlert,
  Tag,
  Trash2,
} from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import { useEmailNormalizer } from './useEmailNormalizer';

const { input, result } = useEmailNormalizer();

const { t } = useI18n();
const U = 'tools.email-normalizer.ui.';

const hasInput = computed(() => input.value.trim().length > 0);

function onInput(e: Event): void {
  input.value = (e.target as HTMLInputElement).value;
}
</script>

<template>
  <div class="qt-tool">
    <ToolInput
      :title="t(U + 'inputTitle')"
      :description="t(U + 'desc')"
    >
      <div class="qt-input-wrap">
        <Mail :size="16" class="emn__field-icon" />
        <input
          class="qt-input"
          style="padding:10px 12px 10px 36px"
          type="email"
          :placeholder="t(U + 'phEmail')"
          :value="input"
          spellcheck="false"
          autocomplete="off"
          autocapitalize="off"
          @input="onInput"
        />
      </div>
    </ToolInput>

    <ToolOutput
      :title="t(U + 'outTitle')"
      :description="result ? t(U + 'descOk') : t(U + 'descEmpty')"
      :copy-text="result?.isValid ? result.normalized : ''"
      :copy-label="t('common.copy')"
    >
      <template v-if="!hasInput">
        <p class="qt-alert qt-alert--empty">{{ t(U + 'alertEmpty') }}</p>
      </template>
      <template v-else-if="result">
        <!-- Validity + disposable badges -->
        <div class="qt-row" style="--qt-row-gap:8px;margin-bottom:12px">
          <span
            class="qt-badge"
            style="text-transform:uppercase"
            :class="result.isValid ? 'qt-badge--success' : 'qt-badge--error'"
          >
            <component
              :is="result.isValid ? CheckCircle2 : AlertTriangle"
              :size="13"
            />
            <span>{{ result.isValid ? t(U + 'valid') : t(U + 'invalid') }}</span>
          </span>
          <span
            v-if="result.isValid"
            class="qt-badge"
            style="text-transform:uppercase"
            :class="result.isDisposable ? 'qt-badge--warn' : 'qt-badge--success'"
          >
            <component
              :is="result.isDisposable ? ShieldAlert : CheckCircle2"
              :size="13"
            />
            <span>{{
              result.isDisposable ? t(U + 'disposable') : t(U + 'notDisposable')
            }}</span>
          </span>
          <span v-if="result.isGmail" class="qt-badge qt-badge--info" style="text-transform:uppercase">
            <AtSign :size="13" />
            <span>{{ t(U + 'gmailEquiv') }}</span>
          </span>
        </div>

        <!-- Validation error -->
        <p v-if="!result.isValid && result.error" class="qt-banner qt-banner--error" style="margin:0 0 12px">
          <AlertTriangle :size="13" />
          <span>{{ result.error }}</span>
        </p>

        <!-- Normalized output -->
        <div class="qt-result" style="padding:12px 14px;margin-bottom:12px">
          <span class="qt-stat-head" style="font-size:11px;letter-spacing:0.06em">{{ t(U + 'normalized') }}</span>
          <code class="qt-value" style="font-size:15px;word-break:break-all">{{ result.normalized || '-' }}</code>
        </div>

        <!-- Transformation chips -->
        <div v-if="result.isValid" class="qt-row" style="--qt-row-gap:8px;margin-bottom:12px">
          <span
            v-if="result.plusStripped"
            class="qt-badge qt-badge--info"
            :title="t(U + 'plusStrippedTitle')"
          >
            <Tag :size="12" />
            <span>{{ t(U + 'plusStripped') }}</span>
          </span>
          <span
            v-if="result.dotsStripped"
            class="qt-badge qt-badge--info"
            :title="t(U + 'dotsStrippedTitle')"
          >
            <Trash2 :size="12" />
            <span>{{ t(U + 'dotsStripped') }}</span>
          </span>
          <span
            v-if="!result.plusStripped && !result.dotsStripped"
            class="qt-badge"
            style="font-style:italic;font-weight:500"
          >
            <span>{{ t(U + 'noTransforms') }}</span>
          </span>
        </div>

        <!-- Breakdown grid -->
        <div v-if="result.isValid" class="emn__grid">
          <div class="qt-result" style="padding:10px 12px;min-width:0">
            <span class="qt-stat-head" style="font-size:11px;letter-spacing:0.06em">{{ t(U + 'localPart') }}</span>
            <code class="qt-value qt-value--sm" style="font-size:13px;word-break:break-all">{{ result.localPart || '-' }}</code>
          </div>
          <div class="qt-result" style="padding:10px 12px;min-width:0">
            <span class="qt-stat-head" style="font-size:11px;letter-spacing:0.06em">{{ t(U + 'domain') }}</span>
            <code class="qt-value qt-value--sm" style="font-size:13px;word-break:break-all">{{ result.domain || '-' }}</code>
          </div>
          <div class="qt-result" style="padding:10px 12px;min-width:0">
            <span class="qt-stat-head" style="font-size:11px;letter-spacing:0.06em">{{ t(U + 'provider') }}</span>
            <span style="font-size:13.5px;color:var(--qt-text);word-break:break-all">{{
              result.provider || '-'
            }}</span>
          </div>
          <div class="qt-result" style="padding:10px 12px;min-width:0">
            <span class="qt-stat-head" style="font-size:11px;letter-spacing:0.06em">{{ t(U + 'disposableLabel') }}</span>
            <span
              style="font-size:13.5px;font-weight:600;word-break:break-all"
              :style="result.isDisposable ? 'color:var(--qt-warning)' : 'color:var(--qt-success)'"
            >
              {{ result.isDisposable ? t(U + 'yes') : t(U + 'no') }}
            </span>
          </div>
        </div>
      </template>
    </ToolOutput>
  </div>
</template>

<style scoped>
/* Kept scoped: patterns unique to this tool (no generic utility). */

/* Leading icon inside .qt-input-wrap (the wrap only pads for a right button). */
.emn__field-icon {
  position: absolute;
  left: 12px;
  color: var(--qt-muted);
  pointer-events: none;
}

/* Breakdown — fixed 2-col grid (collapses on narrow). */
.emn__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}
@media (max-width: 560px) {
  .emn__grid {
    grid-template-columns: 1fr;
  }
}
</style>
