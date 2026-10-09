<script setup lang="ts">
/**
 * Ipv6SubnetCalculator - calculate IPv6 subnet details.
 *
 * Enter an IPv6 address and prefix length to see the network address,
 * first/last addresses, total address count, and expanded/compressed forms.
 *
 * Works in embed mode: receives `input` PostMessages to set the address/prefix
 * and sends `output` PostMessages with the result.
 */
import { useI18n } from 'vue-i18n';
import { RotateCcw } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import CopyButton from '@/components/CopyButton.vue';
import { useIpv6SubnetCalculator } from './useIpv6SubnetCalculator';

const { t } = useI18n();
const U = 'tools.ipv6-subnet-calculator.ui.';

const {
  input,
  prefixLength,
  result,
  error,
  reset,
} = useIpv6SubnetCalculator();

function onInput(e: Event): void {
  input.value = (e.target as HTMLInputElement).value;
}
function onPrefix(e: Event): void {
  prefixLength.value = Number((e.target as HTMLInputElement).value);
}
</script>

<template>
  <div class="qt-tool">
    <ToolInput
      :title="t(U + 'inputTitle')"
      :description="t(U + 'desc')"
    >
      <template #actions>
        <button
          type="button"
          class="qt-btn"
          style="color:var(--qt-muted)"
          :title="t(U + 'resetTitle')"
          @click="reset"
        >
          <RotateCcw :size="14" />
          <span>{{ t('common.reset') }}</span>
        </button>
      </template>

      <div class="qt-row">
        <label class="qt-field" style="gap:6px;flex:1;min-width:200px">
          <span class="qt-label">{{ t(U + 'addrLabel') }}</span>
          <input
            type="text"
            class="qt-input qt-input--mono"
            style="font-size:14px"
            :placeholder="t(U + 'phAddr')"
            :value="input"
            @input="onInput"
          />
        </label>
        <label class="qt-field" style="gap:6px">
          <span class="qt-label">{{ t(U + 'prefixLabel') }}</span>
          <input
            type="number"
            class="qt-input qt-input--mono"
            style="font-size:14px;max-width:100px"
            min="0"
            max="128"
            :value="prefixLength"
            @input="onPrefix"
          />
        </label>
      </div>
    </ToolInput>

    <ToolOutput
      :title="t(U + 'outTitle')"
      :description="error ? t(U + 'descError') : t(U + 'descOk')"
    >
      <p v-if="error" style="color:var(--qt-danger);font-size:13.5px;margin:0">{{ error }}</p>
      <div v-else class="i6__output-wrap">
        <textarea
          class="i6__output"
          readonly
          spellcheck="false"
          :value="result"
          :aria-label="t(U + 'ariaOutput')"
        ></textarea>
        <CopyButton
          :text="result"
          :label="t('common.copy')"
          class="i6__copy"
        />
      </div>
    </ToolOutput>
  </div>
</template>

<style scoped>
/* Kept scoped: patterns unique to this tool (no generic utility). */

/* Readonly output — mono block with an overlaid copy button. */
.i6__output-wrap {
  position: relative;
}
.i6__output {
  width: 100%;
  min-height: 180px;
  resize: vertical;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  color: var(--qt-text);
  font-family: var(--qt-font-mono);
  font-size: 13.5px;
  line-height: 1.6;
  padding: 12px 14px;
  white-space: pre;
  overflow-x: auto;
}
.i6__output:focus {
  border-color: var(--qt-accent);
  outline: none;
  box-shadow: 0 0 0 2px oklch(from var(--qt-accent) 90% c h / 0.25);
}
.i6__copy {
  position: absolute;
  top: 8px;
  right: 8px;
}
</style>
