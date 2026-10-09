<script setup lang="ts">
/**
 * FileChecksumVerifier - hash a local file and compare against a published
 * checksum to verify a download.
 *
 * Supports SHA-256/384/512 via Web Crypto and MD5/SHA-1 via lazy-loaded
 * hash-wasm. The expected checksum accepts a bare hex digest, a
 * `sha256sum`-style line, or `SHA256 (file) = <hash>`; the algorithm is
 * auto-detected from the digest length when set to "auto".
 *
 * Works in embed mode: receives `input` PostMessages with `{ expected,
 * checksum, algorithm }`; sends `output` PostMessages with `{ computed,
 * algorithm, expected, verdict, fileName, fileSize }`.
 */
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { CheckCircle2, FileUp, Loader2, ShieldAlert, X, XCircle } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import ToolField from '@/components/ToolField.vue';
import ToolAlert from '@/components/ToolAlert.vue';
import CopyButton from '@/components/CopyButton.vue';
import {
  useFileChecksumVerifier,
  formatSize,
  CHECKSUM_ALGORITHMS,
} from './useFileChecksumVerifier';

const { t } = useI18n();
const U = 'tools.file-checksum-verifier.ui.';

const {
  algorithm,
  expected,
  fileName,
  fileSize,
  hasFile,
  result,
  busy,
  error,
  setFile,
  clearFile,
} = useFileChecksumVerifier();

const dragOver = ref<boolean>(false);
const fileInput = ref<HTMLInputElement | null>(null);

function pickFile(): void {
  fileInput.value?.click();
}
function onPickerChange(e: Event): void {
  const input = e.target as HTMLInputElement;
  const f = input.files?.[0];
  if (f) setFile(f);
  input.value = '';
}
function onDrop(e: DragEvent): void {
  dragOver.value = false;
  const f = e.dataTransfer?.files?.[0];
  if (f) setFile(f);
}
</script>

<template>
  <div class="qt-tool">
    <ToolInput
      :title="t(U + 'inputTitle')"
      :description="t(U + 'desc')"
    >
      <div
        class="fcv__drop"
        :class="{ 'fcv__drop--over': dragOver }"
        role="button"
        tabindex="0"
        @click="pickFile"
        @keydown.enter="pickFile"
        @keydown.space.prevent="pickFile"
        @dragover.prevent="dragOver = true"
        @dragleave.prevent="dragOver = false"
        @drop.prevent="onDrop"
      >
        <Loader2 v-if="busy" :size="26" class="qt-spin" style="color:var(--qt-accent)" />
        <FileUp v-else :size="26" class="fcv__drop-icon" />
        <p class="fcv__drop-title">
          {{ busy ? t(U + 'dropBusy') : t(U + 'dropTitle') }}
        </p>
        <p class="fcv__drop-hint">{{ t(U + 'dropHint') }}</p>
        <input ref="fileInput" type="file" hidden @change="onPickerChange" />
      </div>
      <div v-if="hasFile" class="qt-result-row" style="padding:7px 10px;font-size:13px;flex-wrap:nowrap">
        <span style="color:var(--qt-text);font-weight:600;word-break:break-all">{{ fileName }}</span>
        <span class="qt-hint" style="margin-left:auto">{{ formatSize(fileSize) }}</span>
        <button type="button" class="qt-icon-btn" :title="t(U + 'clearTitle')" @click="clearFile">
          <X :size="13" />
        </button>
      </div>

      <div class="fcv__opts">
        <ToolField
          v-model="expected"
          :label="t(U + 'expectedLabel')"
          mono
          :placeholder="t(U + 'phExpected')"
          spellcheck="false"
          autocomplete="off"
        />
        <label class="qt-field" style="min-width:0">
          <span class="qt-label">{{ t(U + 'algoLabel') }}</span>
          <select class="qt-input" v-model="algorithm">
            <option v-for="a in CHECKSUM_ALGORITHMS" :key="a" :value="a">
              {{ a === 'auto' ? t(U + 'algoAuto') : a.toUpperCase() }}
            </option>
          </select>
        </label>
      </div>
    </ToolInput>

    <ToolOutput
      :title="t(U + 'outTitle')"
      :description="result ? t(U + 'descResult', { algo: result.algorithm.toUpperCase(), file: result.fileName }) : t(U + 'descEmpty')"
      :copy-text="result?.computed ?? ''"
      :copy-label="t(U + 'copyLabel')"
    >
      <template v-if="error">
        <ToolAlert kind="error">{{ error }}</ToolAlert>
      </template>
      <template v-else-if="!result">
        <ToolAlert kind="empty">{{ t(U + 'alertEmpty') }}</ToolAlert>
      </template>
      <template v-else>
        <div
          v-if="result.verdict !== 'pending'"
          class="qt-banner"
          :class="result.verdict === 'match' ? 'qt-banner--success' : 'qt-banner--error'"
        >
          <CheckCircle2 v-if="result.verdict === 'match'" :size="18" />
          <XCircle v-else :size="18" />
          <span>
            {{ result.verdict === 'match' ? t(U + 'verdictMatch') : t(U + 'verdictMismatch') }}
          </span>
        </div>
        <div v-else class="qt-banner qt-banner--info">
          <ShieldAlert :size="18" />
          <span>{{ t(U + 'verdictPending') }}</span>
        </div>

        <div class="fcv__row">
          <span class="qt-stat-head">{{ t(U + 'rowComputed') }}</span>
          <code class="qt-mono" style="font-size:12.5px;word-break:break-all;white-space:pre-wrap;min-width:0;color:var(--qt-accent);font-weight:600">{{ result.computed }}</code>
          <CopyButton :text="result.computed" :label="t('common.copy')" icon-only />
        </div>
        <div v-if="result.expected" class="fcv__row">
          <span class="qt-stat-head">{{ t(U + 'rowExpected') }}</span>
          <code class="qt-mono" style="font-size:12.5px;word-break:break-all;white-space:pre-wrap;min-width:0">{{ result.expected }}</code>
          <CopyButton :text="result.expected" :label="t('common.copy')" icon-only />
        </div>
      </template>
    </ToolOutput>
  </div>
</template>

<style scoped>
/* Kept scoped: patterns unique to this tool (no generic utility). */

/* Drop zone — dashed border, accent on hover/drag-over. */
.fcv__drop {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 28px 16px;
  border: 1.5px dashed var(--qt-border);
  border-radius: var(--qt-radius);
  background: var(--qt-bg);
  cursor: pointer;
  text-align: center;
  transition: border-color 0.15s ease;
}
.fcv__drop--over,
.fcv__drop:hover {
  border-color: var(--qt-accent);
}
.fcv__drop-icon { color: var(--qt-accent); }
.fcv__drop-title { margin: 0; font-size: 13.5px; color: var(--qt-text); font-weight: 600; }
.fcv__drop-hint { margin: 0; font-size: 12px; color: var(--qt-muted); }

/* Options grid — checksum field + algorithm select side by side. */
.fcv__opts {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 12px;
  align-items: end;
}
@media (max-width: 640px) {
  .fcv__opts { grid-template-columns: 1fr; }
}

/* Digest row — fixed 92px label column + flexible code + copy. */
.fcv__row {
  display: grid;
  grid-template-columns: 92px 1fr auto;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
}
</style>
