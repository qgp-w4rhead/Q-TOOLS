<script setup lang="ts">
/**
 * SecurityTxtGenerator - build an RFC 9116 security.txt file from a form.
 *
 * `Contact` and `Expires` are required by the spec; the rest are optional.
 * Repeatable fields accept one value per line. The file is published at
 * `/.well-known/security.txt`.
 *
 * No external dependencies.
 *
 * Works in embed mode: receives `input` PostMessages with `{ config, contact,
 * expires }`; sends `output` PostMessages with `{ content, valid, issues }`.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { AlertTriangle, FileText, RotateCcw, XCircle } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import ToolField from '@/components/ToolField.vue';
import ToolButton from '@/components/ToolButton.vue';
import { useSecurityTxtGenerator } from './useSecurityTxtGenerator';

const { t } = useI18n();
const U = 'tools.security-txt-generator.ui.';

const { config, output, issues, reset } = useSecurityTxtGenerator();

const hasErrors = computed(() => issues.value.some((i) => i.level === 'error'));

function download(): void {
  const blob = new Blob([output.value], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'security.txt';
  a.click();
  URL.revokeObjectURL(url);
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

      <ToolField
        v-model="config.contact"
        :label="t(U + 'contactLabel')"
        as="textarea"
        mono
        :rows="2"
        placeholder="mailto:security@example.com"
        spellcheck="false"
      />

      <ToolField
        v-model="config.expires"
        :label="t(U + 'expiresLabel')"
        mono
        placeholder="2027-01-01T00:00:00Z"
        spellcheck="false"
      />

      <div class="stxt__row">
        <ToolField
          v-model="config.encryption"
          :label="t(U + 'encLabel')"
          as="textarea"
          mono
          :rows="2"
          placeholder="https://example.com/pgp-key.txt"
          spellcheck="false"
        />
        <ToolField
          v-model="config.acknowledgments"
          :label="t(U + 'ackLabel')"
          as="textarea"
          mono
          :rows="2"
          placeholder="https://example.com/hall-of-fame"
          spellcheck="false"
        />
      </div>

      <div class="stxt__row">
        <ToolField
          v-model="config.preferredLanguages"
          :label="t(U + 'langLabel')"
          placeholder="en, de"
          spellcheck="false"
        />
        <ToolField
          v-model="config.canonical"
          :label="t(U + 'canonLabel')"
          mono
          placeholder="https://example.com/.well-known/security.txt"
          spellcheck="false"
        />
      </div>

      <div class="stxt__row">
        <ToolField
          v-model="config.policy"
          :label="t(U + 'policyLabel')"
          mono
          placeholder="https://example.com/security-policy"
          spellcheck="false"
        />
        <ToolField
          v-model="config.hiring"
          :label="t(U + 'hiringLabel')"
          mono
          placeholder="https://example.com/jobs"
          spellcheck="false"
        />
      </div>

      <ToolField
        v-model="config.csaf"
        :label="t(U + 'csafLabel')"
        mono
        placeholder="https://example.com/.well-known/csaf/provider-metadata.json"
        spellcheck="false"
      />

      <ul v-if="issues.length" class="qt-stack" style="--qt-stack-gap:5px;list-style:none;margin:0;padding:0">
        <li v-for="(iss, i) in issues" :key="i" class="stxt__issue" :class="`stxt__issue--${iss.level}`">
          <XCircle v-if="iss.level === 'error'" :size="13" />
          <AlertTriangle v-else :size="13" />
          <span>{{ iss.message }}</span>
        </li>
      </ul>
    </ToolInput>

    <ToolOutput
      title="security.txt"
      :description="hasErrors ? t(U + 'descError') : t(U + 'descOk')"
      :copy-text="output"
      :copy-label="t(U + 'copyLabel')"
    >
      <template #actions>
        <ToolButton :disabled="!output" @click="download">
          <FileText :size="13" /> {{ t('common.download') }}
        </ToolButton>
      </template>
      <pre class="qt-output" style="margin:0;word-break:break-all">{{ output || t(U + 'preEmpty') }}</pre>
    </ToolOutput>
  </div>
</template>

<style scoped>
/* Kept scoped: patterns unique to this tool (no generic utility). */

/* 2-col field grid — collapses to stacked on narrow. */
.stxt__row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
@media (max-width: 640px) {
  .stxt__row { grid-template-columns: 1fr; }
}

/* Issue line — boxed icon + message colored by severity. */
.stxt__issue {
  display: flex;
  align-items: flex-start;
  gap: 7px;
  font-size: 12.5px;
  padding: 6px 9px;
  border-radius: var(--qt-radius-sm);
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
}
.stxt__issue--error { color: var(--qt-danger); }
.stxt__issue--warning { color: var(--qt-warning); }
</style>
