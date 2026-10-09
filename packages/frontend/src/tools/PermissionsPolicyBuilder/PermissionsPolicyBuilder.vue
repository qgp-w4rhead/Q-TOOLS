<script setup lang="ts">
/**
 * PermissionsPolicyBuilder - build a `Permissions-Policy` HTTP header from a
 * per-feature form.
 *
 * Each feature gets an allowlist: `*` (all), `()` (none), `self`, or `self`
 * plus specific origins. Emits the header value plus nginx `add_header` and
 * Apache `Header set` snippets. Extends `security-headers-builder`.
 *
 * No external dependencies.
 *
 * Works in embed mode: receives `input` PostMessages with `{ policies:
 * [{feature, enabled, mode, origins}] }`; sends `output` PostMessages with
 * `{ header, nginx, apache }`.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { RotateCcw, ShieldCheck } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import ToolButton from '@/components/ToolButton.vue';
import ToolAlert from '@/components/ToolAlert.vue';
import CopyButton from '@/components/CopyButton.vue';
import {
  usePermissionsPolicyBuilder,
  FEATURES,
  type AllowlistMode,
} from './usePermissionsPolicyBuilder';

const { t } = useI18n();
const U = 'tools.permissions-policy-builder.ui.';

const {
  policies,
  header,
  nginx,
  apache,
  reset,
  setMode,
  setOrigins,
  toggle,
} = usePermissionsPolicyBuilder();

const MODES = computed<Array<{ id: AllowlistMode; label: string }>>(() => [
  { id: 'none', label: '()' },
  { id: 'self', label: 'self' },
  { id: 'all', label: '*' },
  { id: 'custom', label: t(U + 'modeCustom') },
]);

function labelFor(feature: string): string {
  return FEATURES.find((f) => f.feature === feature)?.label ?? feature;
}
function onMode(feature: string, e: Event): void {
  setMode(feature, (e.target as HTMLSelectElement).value as AllowlistMode);
}
function onOrigins(feature: string, e: Event): void {
  setOrigins(feature, (e.target as HTMLInputElement).value);
}
</script>

<template>
  <div class="qt-tool">
    <ToolInput
      :title="t(U + 'inputTitle')"
      :description="t(U + 'desc')"
    >
      <template #actions>
        <ToolButton @click="reset">
          <RotateCcw :size="13" /> {{ t('common.reset') }}
        </ToolButton>
      </template>

      <div class="qt-stack" style="--qt-stack-gap:4px;max-height:420px;overflow-y:auto">
        <div v-for="p in policies" :key="p.feature" class="ppb__row" :class="{ 'ppb__row--off': !p.enabled }">
          <label class="qt-check" style="min-width:0">
            <input type="checkbox" :checked="p.enabled" @change="toggle(p.feature)" />
            <span style="font-size:13px;font-weight:600;color:var(--qt-text)">{{ labelFor(p.feature) }}</span>
            <code class="qt-mono" style="font-size:11px;color:var(--qt-muted)">{{ p.feature }}</code>
          </label>
          <div class="qt-row qt-row--center" style="--qt-row-gap:8px;flex-wrap:nowrap">
            <select
              class="qt-input"
              style="padding:5px 8px;font-size:12.5px"
              :value="p.mode"
              :disabled="!p.enabled"
              @change="onMode(p.feature, $event)"
            >
              <option v-for="m in MODES" :key="m.id" :value="m.id">{{ m.label }}</option>
            </select>
            <input
              v-if="p.mode === 'custom'"
              class="qt-input qt-input--mono"
              style="width:200px;padding:5px 8px;font-size:11.5px"
              type="text"
              :placeholder="t(U + 'phOrigins')"
              :value="p.origins"
              :disabled="!p.enabled"
              spellcheck="false"
              @input="onOrigins(p.feature, $event)"
            />
          </div>
        </div>
      </div>
    </ToolInput>

    <ToolOutput
      :title="t(U + 'outTitle')"
      :description="header ? t(policies.filter(p => p.enabled).length === 1 ? U + 'descDirectivesOne' : U + 'descDirectives', { n: policies.filter(p => p.enabled).length }) : t(U + 'descEmpty')"
      :copy-text="header"
      :copy-label="t(U + 'copyLabel')"
    >
      <template v-if="!header">
        <ToolAlert kind="empty">{{ t(U + 'alertEmpty') }}</ToolAlert>
      </template>
      <template v-else>
        <div class="ppb__out-row">
          <span class="qt-stat-head">{{ t(U + 'rowHeader') }}</span>
          <code class="qt-mono" style="font-size:12px;word-break:break-all;white-space:pre-wrap;min-width:0;color:var(--qt-accent);font-weight:600">Permissions-Policy: {{ header }}</code>
          <CopyButton :text="`Permissions-Policy: ${header}`" :label="t('common.copy')" icon-only />
        </div>
        <div class="ppb__out-row">
          <span class="qt-stat-head">nginx</span>
          <code class="qt-mono" style="font-size:12px;word-break:break-all;white-space:pre-wrap;min-width:0">{{ nginx }}</code>
          <CopyButton :text="nginx" :label="t('common.copy')" icon-only />
        </div>
        <div class="ppb__out-row">
          <span class="qt-stat-head">Apache</span>
          <code class="qt-mono" style="font-size:12px;word-break:break-all;white-space:pre-wrap;min-width:0">{{ apache }}</code>
          <CopyButton :text="apache" :label="t('common.copy')" icon-only />
        </div>
        <p class="qt-hint ppb__hint" style="display:flex;align-items:center;gap:6px;margin-top:4px">
          <ShieldCheck :size="12" />
          <span><code>()</code> {{ t(U + 'hintNone') }}; <code>self</code> {{ t(U + 'hintSelf') }}; <code>*</code> {{ t(U + 'hintAll') }}.</span>
        </p>
      </template>
    </ToolOutput>
  </div>
</template>

<style scoped>
/* Kept scoped: patterns unique to this tool (no generic utility). */

/* Feature row — 2-col grid (feature | controls), dims when disabled. */
.ppb__row {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: 10px;
  padding: 6px 10px;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
}
.ppb__row--off { opacity: 0.55; }

/* Output row — 3-col grid (label | code | copy). */
.ppb__out-row {
  display: grid;
  grid-template-columns: 64px 1fr auto;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
}

/* Inline code inside the hint. */
.ppb__hint code {
  font-family: var(--qt-font-mono);
  font-size: 11px;
}

@media (max-width: 640px) {
  .ppb__row { grid-template-columns: 1fr; }
}
</style>
