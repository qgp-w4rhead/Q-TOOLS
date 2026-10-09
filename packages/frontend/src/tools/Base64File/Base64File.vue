<script setup lang="ts">
/**
 * Base64File - convert files to and from Base64.
 *
 * Encode mode: drop or pick a file → Base64 string (raw or as a Data URI).
 * Decode mode: paste a Base64 string or Data URI → recover the original
 * bytes and download them.
 *
 * Uses the FileReader API for file reads and a hand-rolled, UTF-8-safe
 * Base64 encoder (shared with the Base64String tool) so no external
 * dependency is required. Shows file size and MIME type in both modes.
 *
 * Works in embed mode: receives `input` PostMessages (mode, base64,
 * dataUri, url, urlSafe, asDataUri) and sends `output` PostMessages with
 * the computed base64 / dataUri / file metadata.
 */
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  AlertCircle,
  ArrowLeftRight,
  Download,
  FileUp,
  Loader2,
  Link2,
  Trash2,
} from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import {
  useBase64File,
  formatFileSize,
  type Base64FileMode,
} from './useBase64File';

const {
  mode,
  file,
  input,
  urlSafe,
  asDataUri,
  base64,
  dataUri,
  decoded,
  error,
  busy,
  onFile,
  decode,
  download,
  clear,
  setMode,
} = useBase64File();

const { t } = useI18n();
const U = 'tools.base64-file-converter.ui.';

const fileInput = ref<HTMLInputElement | null>(null);
const dragOver = ref<boolean>(false);

function onDrop(e: DragEvent): void {
  dragOver.value = false;
  const f = e.dataTransfer?.files?.[0];
  if (f) void onFile(f);
}

function onPickerChange(e: Event): void {
  const f = (e.target as HTMLInputElement).files?.[0];
  if (f) void onFile(f);
  // Reset so picking the same file twice still fires `change`.
  (e.target as HTMLInputElement).value = '';
}

function pickFile(): void {
  fileInput.value?.click();
}

const inputDescription = computed(() =>
  mode.value === 'encode' ? t(U + 'descEncode') : t(U + 'descDecode'),
);

const outputLabel = computed(() =>
  mode.value === 'encode'
    ? asDataUri.value
      ? t('common.dataUri')
      : t('common.base64')
    : t('common.recoveredFile'),
);

const outputDescription = computed(() => {
  if (mode.value === 'encode') {
    if (!file.value) return t(U + 'pickToEncode');
    const mime = file.value.mimeType || t(U + 'unknown');
    return t(U + 'outputDesc', { name: file.value.name || t('common.file'), size: formatFileSize(file.value.size), mime });
  }
  if (!decoded.value) return t(U + 'pasteToRecover');
  return t(U + 'outputDesc', { name: decoded.value.name, size: formatFileSize(decoded.value.size), mime: decoded.value.mimeType });
});

const copyText = computed(() => {
  if (mode.value === 'encode') {
    return asDataUri.value ? dataUri.value : base64.value;
  }
  return input.value;
});

const outputText = computed(() => {
  if (mode.value === 'encode') {
    return asDataUri.value ? dataUri.value : base64.value;
  }
  return '';
});

function onModeChange(m: Base64FileMode): void {
  setMode(m);
}

function swap(): void {
  if (mode.value === 'encode') {
    // Feed the encoded output back as decode input.
    input.value = asDataUri.value ? dataUri.value : base64.value;
    setMode('decode');
  } else {
    // No file to recover in encode mode - just switch.
    setMode('encode');
  }
}
</script>

<template>
  <div class="qt-tool">
    <ToolInput
      :title="mode === 'encode' ? t('common.file') : t('common.base64')"
      :description="inputDescription"
    >
      <template #actions>
        <button
          v-if="file || input || decoded"
          class="qt-btn qt-btn--ghost"
          type="button"
          @click="clear"
        >
          <Trash2 :size="14" />
          <span>{{ t('common.clear') }}</span>
        </button>
        <button
          class="qt-btn qt-btn--ghost"
          type="button"
          :title="t('common.swapTitle')"
          @click="swap"
        >
          <ArrowLeftRight :size="14" />
          <span>{{ t('common.swap') }}</span>
        </button>
      </template>

      <div class="qt-row qt-row--center" style="--qt-row-gap:10px">
        <span class="qt-label">{{ t('common.direction') }}</span>
        <div class="b64f__mode-toggle">
          <button
            type="button"
            class="b64f__mode-opt"
            :class="{ 'b64f__mode-opt--active': mode === 'encode' }"
            :aria-pressed="mode === 'encode'"
            @click="onModeChange('encode')"
          >
            {{ t(U + 'fileToBase64') }}
          </button>
          <button
            type="button"
            class="b64f__mode-opt"
            :class="{ 'b64f__mode-opt--active': mode === 'decode' }"
            :aria-pressed="mode === 'decode'"
            @click="onModeChange('decode')"
          >
            {{ t(U + 'base64ToFile') }}
          </button>
        </div>
        <button
          type="button"
          class="qt-chip qt-chip--filled"
          :class="{ 'qt-chip--solid': urlSafe }"
          :aria-pressed="urlSafe"
          :title="t('common.urlSafeTitle')"
          @click="urlSafe = !urlSafe"
        >
          <Link2 :size="13" />
          <span>{{ t('common.urlSafe') }}</span>
        </button>
      </div>

      <!-- Encode mode: drop zone -->
      <div v-if="mode === 'encode'">
        <div
          class="qt-drop"
          :class="{ 'qt-drop--over': dragOver }"
          role="button"
          tabindex="0"
          @click="pickFile"
          @keydown.enter="pickFile"
          @keydown.space.prevent="pickFile"
          @dragover.prevent="dragOver = true"
          @dragleave.prevent="dragOver = false"
          @drop.prevent="onDrop"
        >
          <Loader2 v-if="busy" :size="28" class="qt-spin b64f__spin" />
          <FileUp v-else :size="28" class="b64f__drop-icon" />
          <p class="b64f__drop-title">
            {{ busy ? t('common.readingFile') : t('common.dropFile') }}
          </p>
          <p class="b64f__drop-hint">{{ t('common.dropFileHint') }}</p>
          <input
            ref="fileInput"
            type="file"
            hidden
            @change="onPickerChange"
          />
        </div>

        <div v-if="file" class="qt-result">
          <div class="b64f__meta-row">
            <span class="b64f__meta-key">{{ t('common.name') }}</span>
            <span class="b64f__meta-val">{{ file.name || '-' }}</span>
          </div>
          <div class="b64f__meta-row">
            <span class="b64f__meta-key">{{ t('common.size') }}</span>
            <span class="b64f__meta-val">{{ formatFileSize(file.size) }}</span>
          </div>
          <div class="b64f__meta-row">
            <span class="b64f__meta-key">{{ t(U + 'metaMime') }}</span>
            <span class="b64f__meta-val"><code>{{ file.mimeType || t(U + 'unknown') }}</code></span>
          </div>
        </div>

        <div v-if="file" class="qt-row qt-row--center" style="--qt-row-gap:10px">
          <button
            type="button"
            class="qt-chip qt-chip--filled"
            :class="{ 'qt-chip--solid': asDataUri }"
            :aria-pressed="asDataUri"
            :title="t('common.dataUriTitle')"
            @click="asDataUri = !asDataUri"
          >
            <Link2 :size="13" />
            <span>{{ t('common.dataUri') }}</span>
          </button>
        </div>
      </div>

      <!-- Decode mode: textarea -->
      <div v-else>
        <label class="qt-field">
          <span class="qt-label">{{ t(U + 'base64OrDataUri') }}</span>
          <textarea
            class="qt-input qt-input--mono b64f__textarea"
            :placeholder="t('common.pasteBase64')"
            :value="input"
            rows="8"
            spellcheck="false"
            autocomplete="off"
            @input="input = ($event.target as HTMLTextAreaElement).value"
          />
        </label>
        <button
          class="qt-btn qt-btn--primary"
          type="button"
          :disabled="input.trim().length === 0"
          @click="decode"
        >
          <span>{{ t('common.decode') }}</span>
        </button>
      </div>
    </ToolInput>

    <ToolOutput
      :title="outputLabel"
      :description="outputDescription"
      :copy-text="copyText"
      :copy-label="mode === 'encode' ? t('common.copyOutput') : t('common.copyInput')"
    >
      <template #actions>
        <button
          v-if="mode === 'decode' && decoded"
          class="qt-btn qt-btn--primary"
          type="button"
          @click="download"
        >
          <Download :size="14" />
          <span>{{ t('common.download') }}</span>
        </button>
      </template>

      <p v-if="error" class="qt-alert qt-alert--error">
        <AlertCircle :size="14" />
        <span>{{ error }}</span>
      </p>

      <template v-else>
        <!-- Encode output -->
        <div v-if="mode === 'encode' && outputText" class="qt-result b64f__result">
          <code class="qt-mono b64f__code">{{ outputText }}</code>
        </div>

        <!-- Decode output -->
        <div v-if="mode === 'decode' && decoded" class="qt-result">
          <div class="b64f__meta-row">
            <span class="b64f__meta-key">{{ t('common.filename') }}</span>
            <span class="b64f__meta-val">{{ decoded.name }}</span>
          </div>
          <div class="b64f__meta-row">
            <span class="b64f__meta-key">{{ t('common.size') }}</span>
            <span class="b64f__meta-val">{{ formatFileSize(decoded.size) }}</span>
          </div>
          <div class="b64f__meta-row">
            <span class="b64f__meta-key">{{ t(U + 'metaMime') }}</span>
            <span class="b64f__meta-val"><code>{{ decoded.mimeType }}</code></span>
          </div>
          <button
            class="qt-btn qt-btn--ghost"
            type="button"
            @click="download"
          >
            <Download :size="14" />
            <span>{{ t('common.downloadFile') }}</span>
          </button>
        </div>

        <p
          v-if="(mode === 'encode' && !outputText) || (mode === 'decode' && !decoded)"
          class="qt-alert qt-alert--empty"
        >
          {{ mode === 'encode' ? t(U + 'pickToEncode') : t(U + 'pasteToRecover') }}
        </p>
      </template>
    </ToolOutput>
  </div>
</template>

<style scoped>
/* Kept scoped: patterns unique to this tool (no generic utility). */

/* Direction pill segmented control (solid-accent active). */
.b64f__mode-toggle {
  display: inline-flex;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: 999px;
  padding: 3px;
}
.b64f__mode-opt {
  padding: 5px 12px;
  border-radius: 999px;
  border: none;
  background: transparent;
  color: var(--qt-muted);
  font: inherit;
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  transition:
    color 0.15s ease,
    background 0.15s ease;
}
.b64f__mode-opt--active {
  color: var(--qt-bg);
  background: var(--qt-accent);
}
/* Dropzone internals (container via .qt-drop). */
.b64f__drop-icon {
  color: var(--qt-accent);
}
.b64f__drop-title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--qt-text);
}
.b64f__drop-hint {
  margin: 0;
  font-size: 12px;
}
/* Spinner accent (animation via .qt-spin). */
.b64f__spin {
  color: var(--qt-accent);
}
/* Key/value meta rows (card via .qt-result). */
.b64f__meta-row {
  display: flex;
  align-items: baseline;
  gap: 10px;
  font-size: 13px;
}
.b64f__meta-key {
  flex: 0 0 70px;
  color: var(--qt-muted);
  font-weight: 600;
  font-size: 12.5px;
}
.b64f__meta-val {
  color: var(--qt-text);
  word-break: break-all;
}
.b64f__meta-val code {
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
  font-size: 12.5px;
}
/* Encode output — scrollable (card via .qt-result). */
.b64f__result {
  max-height: 320px;
  overflow: auto;
}
.b64f__code {
  font-size: 13px;
  color: var(--qt-text);
  word-break: break-all;
  white-space: pre-wrap;
}
/* Input textarea floor (control + mono via .qt-input--mono). */
.b64f__textarea {
  min-height: 140px;
}
</style>
