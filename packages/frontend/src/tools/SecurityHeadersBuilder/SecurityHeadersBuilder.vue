<script setup lang="ts">
/**
 * SecurityHeadersBuilder - generate security HTTP response headers.
 *
 * Configure CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy,
 * Permissions-Policy, and cross-origin headers via a form. Outputs raw header
 * text and Nginx config snippets.
 */
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { RotateCcw } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import ToolField from '@/components/ToolField.vue';
import ToolButton from '@/components/ToolButton.vue';
import SegmentedControl from '@/components/SegmentedControl.vue';
import CopyButton from '@/components/CopyButton.vue';
import {
  useSecurityHeadersBuilder,
  REFERRER_POLICY_OPTIONS,
} from './useSecurityHeadersBuilder';

const { t } = useI18n();
const U = 'tools.security-headers-builder.ui.';

const {
  config,
  headers,
  headerText,
  nginxText,
  reset,
} = useSecurityHeadersBuilder();

type OutputMode = 'headers' | 'nginx';
const outputMode = ref<OutputMode>('headers');
const outputModeOptions = computed<Array<{ id: OutputMode; label: string }>>(() => [
  { id: 'headers', label: t(U + 'modeHeaders') },
  { id: 'nginx', label: t(U + 'modeNginx') },
]);
</script>

<template>
  <div class="qt-tool">
    <ToolInput
      :title="t(U + 'inputTitle')"
      :description="t(U + 'desc')"
    >
      <template #actions>
        <ToolButton :title="t('common.resetDefaults')" @click="reset">
          <RotateCcw :size="14" />
          <span>{{ t('common.reset') }}</span>
        </ToolButton>
      </template>

      <!-- CSP section -->
      <div class="qt-result" style="padding:12px;--qt-result-gap:10px">
        <label class="qt-check" style="font-size:14px">
          <input type="checkbox" v-model="config.cspEnabled" />
          <span style="font-weight:700;color:var(--qt-text)">Content-Security-Policy</span>
        </label>
        <div v-if="config.cspEnabled" class="shb__grid">
          <ToolField v-model="config.cspDefaultSrc" label="default-src" />
          <ToolField v-model="config.cspScriptSrc" label="script-src" />
          <ToolField v-model="config.cspStyleSrc" label="style-src" />
          <ToolField v-model="config.cspImgSrc" label="img-src" />
          <ToolField v-model="config.cspFontSrc" label="font-src" />
          <ToolField v-model="config.cspConnectSrc" label="connect-src" />
          <ToolField v-model="config.cspFrameSrc" label="frame-src" />
          <ToolField v-model="config.cspObjectSrc" label="object-src" />
          <ToolField v-model="config.cspMediaSrc" label="media-src" />
          <ToolField v-model="config.cspBaseUri" label="base-uri" />
          <ToolField v-model="config.cspFormAction" label="form-action" />
          <ToolField v-model="config.cspFrameAncestors" label="frame-ancestors" />
          <ToolField v-model="config.cspReportUri" label="report-uri" :placeholder="t('common.optional')" />
          <div class="qt-row" style="--qt-row-gap:10px">
            <label class="qt-check" style="font-size:12.5px">
              <input type="checkbox" v-model="config.cspUpgradeInsecure" />
              <span>upgrade-insecure-requests</span>
            </label>
            <label class="qt-check" style="font-size:12.5px">
              <input type="checkbox" v-model="config.cspReportOnly" />
              <span>{{ t(U + 'reportOnly') }}</span>
            </label>
          </div>
        </div>
      </div>

      <!-- HSTS section -->
      <div class="qt-result" style="padding:12px;--qt-result-gap:10px">
        <label class="qt-check" style="font-size:14px">
          <input type="checkbox" v-model="config.hstsEnabled" />
          <span style="font-weight:700;color:var(--qt-text)">Strict-Transport-Security (HSTS)</span>
        </label>
        <div v-if="config.hstsEnabled" class="qt-row qt-row--bottom" style="--qt-row-gap:10px">
          <ToolField v-model.number="config.hstsMaxAge" :label="t(U + 'maxAgeLabel')" type="number" min="0" />
          <label class="qt-check" style="font-size:12.5px">
            <input type="checkbox" v-model="config.hstsIncludeSubdomains" />
            <span>includeSubDomains</span>
          </label>
          <label class="qt-check" style="font-size:12.5px">
            <input type="checkbox" v-model="config.hstsPreload" />
            <span>preload</span>
          </label>
        </div>
      </div>

      <!-- X-Frame-Options -->
      <div class="qt-result" style="padding:12px;--qt-result-gap:10px">
        <label class="qt-check" style="font-size:14px">
          <input type="checkbox" v-model="config.xFrameOptionsEnabled" />
          <span style="font-weight:700;color:var(--qt-text)">X-Frame-Options</span>
        </label>
        <div v-if="config.xFrameOptionsEnabled" class="qt-row qt-row--bottom" style="--qt-row-gap:10px">
          <label class="qt-field">
            <span class="qt-label">{{ t('common.value') }}</span>
            <select class="qt-input" style="padding:6px 8px;font-size:13px" v-model="config.xFrameOptionsValue">
              <option value="DENY">DENY</option>
              <option value="SAMEORIGIN">SAMEORIGIN</option>
              <option value="ALLOW-FROM">ALLOW-FROM</option>
            </select>
          </label>
        </div>
      </div>

      <!-- Other headers -->
      <div class="qt-result" style="padding:12px;--qt-result-gap:10px">
        <div class="qt-row" style="--qt-row-gap:10px">
          <label class="qt-check" style="font-size:12.5px">
            <input type="checkbox" v-model="config.xContentTypeOptions" />
            <span>X-Content-Type-Options: nosniff</span>
          </label>
          <label class="qt-check" style="font-size:12.5px">
            <input type="checkbox" v-model="config.referrerPolicyEnabled" />
            <span>Referrer-Policy</span>
          </label>
          <label class="qt-check" style="font-size:12.5px">
            <input type="checkbox" v-model="config.permissionsPolicyEnabled" />
            <span>Permissions-Policy</span>
          </label>
          <label class="qt-check" style="font-size:12.5px">
            <input type="checkbox" v-model="config.xXssProtection" />
            <span>X-XSS-Protection (legacy)</span>
          </label>
          <label class="qt-check" style="font-size:12.5px">
            <input type="checkbox" v-model="config.coopEnabled" />
            <span>COOP</span>
          </label>
          <label class="qt-check" style="font-size:12.5px">
            <input type="checkbox" v-model="config.coepEnabled" />
            <span>COEP</span>
          </label>
          <label class="qt-check" style="font-size:12.5px">
            <input type="checkbox" v-model="config.corpEnabled" />
            <span>CORP</span>
          </label>
        </div>
        <div v-if="config.referrerPolicyEnabled" class="qt-row qt-row--bottom" style="--qt-row-gap:10px">
          <label class="qt-field">
            <span class="qt-label">{{ t(U + 'refPolicyLabel') }}</span>
            <select class="qt-input" style="padding:6px 8px;font-size:13px" v-model="config.referrerPolicyValue">
              <option v-for="opt in REFERRER_POLICY_OPTIONS" :key="opt" :value="opt">{{ opt }}</option>
            </select>
          </label>
        </div>
        <div v-if="config.permissionsPolicyEnabled" class="qt-row qt-row--bottom" style="--qt-row-gap:10px">
          <ToolField v-model="config.permissionsPolicyValue" :label="t(U + 'permPolicyLabel')" grow />
        </div>
        <div v-if="config.corpEnabled" class="qt-row qt-row--bottom" style="--qt-row-gap:10px">
          <label class="qt-field">
            <span class="qt-label">{{ t(U + 'corpLabel') }}</span>
            <select class="qt-input" style="padding:6px 8px;font-size:13px" v-model="config.corpValue">
              <option value="same-origin">same-origin</option>
              <option value="same-site">same-site</option>
              <option value="cross-origin">cross-origin</option>
            </select>
          </label>
        </div>
      </div>
    </ToolInput>

    <ToolOutput
      :title="t(U + 'outTitle')"
      :description="t(headers.length === 1 ? U + 'descHeadersOne' : U + 'descHeaders', { n: headers.length })"
      :copy-text="outputMode === 'headers' ? headerText : nginxText"
    >
      <template #actions>
        <SegmentedControl v-model="outputMode" :options="outputModeOptions" />
      </template>

      <pre class="qt-output" style="margin:0;max-height:300px">{{ outputMode === 'headers' ? headerText : nginxText }}</pre>

      <div class="qt-stack" style="--qt-stack-gap:6px">
        <div v-for="h in headers" :key="h.name" class="shb__header-row">
          <div class="qt-stack" style="--qt-stack-gap:2px;flex:1;min-width:0">
            <code class="qt-mono" style="font-size:13px;font-weight:700;color:var(--qt-accent)">{{ h.name }}</code>
            <span class="qt-hint">{{ h.description }}</span>
          </div>
          <code class="qt-mono" style="font-size:12px;max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{{ h.value }}</code>
          <CopyButton :text="`${h.name}: ${h.value}`" icon-only :label="t(U + 'copyHeader')" />
        </div>
      </div>
    </ToolOutput>
  </div>
</template>

<style scoped>
/* Kept scoped: patterns unique to this tool (no generic utility). */

/* CSP field grid — 2-col, collapses to stacked on narrow. */
.shb__grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
@media (max-width: 600px) {
  .shb__grid {
    grid-template-columns: 1fr;
  }
}

/* Header row — info stack + value + copy. */
.shb__header-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  background: var(--qt-bg);
}
</style>
