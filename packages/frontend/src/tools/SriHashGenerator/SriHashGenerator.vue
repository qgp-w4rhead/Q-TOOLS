<script setup lang="ts">
/**
 * SriHashGenerator - generate Subresource Integrity (SRI) hashes.
 *
 * Hash a local file or pasted text with SHA-256/384/512 via Web Crypto and
 * get the `integrity` attribute value plus a ready-to-paste `<script>` or
 * `<link>` tag with `crossorigin="anonymous"`.
 *
 * No external dependencies.
 *
 * Works in embed mode: receives `input` PostMessages with `{ text, url, tag,
 * algorithm }`; sends `output` PostMessages with `{ integrity, tag, sha256,
 * sha384, sha512 }`.
 */
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { FileUp, Loader2, ShieldCheck, X } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import ToolField from '@/components/ToolField.vue';
import ToolAlert from '@/components/ToolAlert.vue';
import SegmentedControl from '@/components/SegmentedControl.vue';
import CopyButton from '@/components/CopyButton.vue';
import {
  useSriHashGenerator,
  formatSize,
  SRI_ALGORITHMS,
  type SriInputMode,
} from './useSriHashGenerator';

const { t } = useI18n();
const U = 'tools.sri-hash-generator.ui.';

const {
  mode,
  text,
  url,
  tagKind,
  algorithm,
  fileName,
  fileSize,
  result,
  busy,
  error,
  setFile,
  clearFile,
} = useSriHashGenerator();

const modeOptions = computed<Array<{ id: SriInputMode; label: string }>>(() => [
  { id: 'text', label: t(U + 'modeText') },
  { id: 'file', label: t(U + 'modeFile') },
]);

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
      <SegmentedControl v-model="mode" :options="modeOptions" />

      <ToolField
        v-if="mode === 'text'"
        v-model="text"
        as="textarea"
        mono
        :rows="6"
        :placeholder="t(U + 'phText')"
        spellcheck="false"
      />

      <div v-else>
        <div
          class="sri__drop"
          :class="{ 'sri__drop--over': dragOver }"
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
          <FileUp v-else :size="26" class="sri__drop-icon" />
          <p class="sri__drop-title">
            {{ busy ? t(U + 'dropBusy') : t(U + 'dropTitle') }}
          </p>
          <p class="sri__drop-hint">{{ t(U + 'dropHint') }}</p>
          <input ref="fileInput" type="file" hidden @change="onPickerChange" />
        </div>
        <div v-if="fileName" class="qt-result-row" style="margin-top:8px;padding:7px 10px;font-size:13px;flex-wrap:nowrap">
          <span style="color:var(--qt-text);font-weight:600;word-break:break-all">{{ fileName }}</span>
          <span class="qt-hint" style="margin-left:auto">{{ formatSize(fileSize) }}</span>
          <button type="button" class="qt-icon-btn" :title="t(U + 'clearTitle')" @click="clearFile">
            <X :size="13" />
          </button>
        </div>
      </div>

      <div class="sri__opts">
        <ToolField
          v-model="url"
          :label="t(U + 'urlLabel')"
          :placeholder="t(U + 'phUrl')"
          spellcheck="false"
        />
        <label class="qt-field" style="min-width:0">
          <span class="qt-label">{{ t(U + 'tagLabel') }}</span>
          <select class="qt-input" v-model="tagKind">
            <option value="script">&lt;script&gt;</option>
            <option value="link">{{ t(U + 'tagLink') }}</option>
            <option value="none">{{ t(U + 'tagNone') }}</option>
          </select>
        </label>
        <label class="qt-field" style="min-width:0">
          <span class="qt-label">{{ t(U + 'algoLabel') }}</span>
          <select class="qt-input" v-model="algorithm">
            <option v-for="a in SRI_ALGORITHMS" :key="a" :value="a">{{ a }}</option>
          </select>
        </label>
      </div>
    </ToolInput>

    <ToolOutput
      :title="t(U + 'outTitle')"
      :description="result ? t(U + 'descResult', { src: result.sourceLabel, size: formatSize(result.byteSize) }) : t(U + 'descEmpty')"
      :copy-text="result?.integrity ?? ''"
      :copy-label="t(U + 'copyLabel')"
    >
      <template v-if="error">
        <ToolAlert kind="error">{{ error }}</ToolAlert>
      </template>
      <template v-else-if="!result">
        <ToolAlert kind="empty">{{ t(U + 'alertEmpty') }}</ToolAlert>
      </template>
      <template v-else>
        <div class="sri__row">
          <span class="qt-stat-head">integrity</span>
          <code class="qt-mono" style="font-size:12.5px;word-break:break-all;white-space:pre-wrap;min-width:0;color:var(--qt-accent);font-weight:600">{{ result.integrity }}</code>
          <CopyButton :text="result.integrity" :label="t('common.copy')" icon-only />
        </div>
        <div v-if="tagKind !== 'none'" class="sri__row">
          <span class="qt-stat-head">tag</span>
          <code class="qt-mono" style="font-size:12.5px;word-break:break-all;white-space:pre-wrap;min-width:0">{{ result.tag }}</code>
          <CopyButton :text="result.tag" :label="t('common.copy')" icon-only />
        </div>
        <div class="qt-stack" style="--qt-stack-gap:6px">
          <p class="qt-stat-head" style="margin:4px 0 2px"><ShieldCheck :size="13" /> {{ t(U + 'allAlgos') }}</p>
          <div v-for="a in SRI_ALGORITHMS" :key="a" class="sri__row sri__row--sm">
            <span class="qt-stat-head">{{ a }}</span>
            <code class="qt-mono" style="font-size:12.5px;word-break:break-all;white-space:pre-wrap;min-width:0">{{ result.hashes[a] }}</code>
            <CopyButton :text="result.hashes[a]" :label="t('common.copy')" icon-only />
          </div>
        </div>
      </template>
    </ToolOutput>
  </div>
</template>

<style scoped>
/* Kept scoped: patterns unique to this tool (no generic utility). */

/* Drop zone — dashed border, accent on hover/drag-over. */
.sri__drop {
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
.sri__drop--over,
.sri__drop:hover {
  border-color: var(--qt-accent);
}
.sri__drop-icon { color: var(--qt-accent); }
.sri__drop-title { margin: 0; font-size: 13.5px; color: var(--qt-text); font-weight: 600; }
.sri__drop-hint { margin: 0; font-size: 12px; color: var(--qt-muted); }

/* Options grid — URL field + tag select + algorithm select side by side. */
.sri__opts {
  display: grid;
  grid-template-columns: 1fr auto auto;
  gap: 12px;
  align-items: end;
}
@media (max-width: 640px) {
  .sri__opts { grid-template-columns: 1fr; }
}

/* Digest row — fixed 110px label column + flexible code + copy. */
.sri__row {
  display: grid;
  grid-template-columns: 110px 1fr auto;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
}
.sri__row--sm { padding: 6px 10px; }
@media (max-width: 640px) {
  .sri__row { grid-template-columns: 84px 1fr auto; }
}
</style>
