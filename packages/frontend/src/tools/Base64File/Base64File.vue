<script setup lang="ts">
/**
 * Base64File — convert files to and from Base64.
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
  mode.value === 'encode'
    ? 'Drop a file or click to browse — it will be encoded to Base64 locally. Nothing leaves your browser.'
    : 'Paste a Base64 string or Data URI to recover the original file. The result is offered as a download.',
);

const outputLabel = computed(() =>
  mode.value === 'encode'
    ? asDataUri.value
      ? 'Data URI'
      : 'Base64'
    : 'Recovered file',
);

const outputDescription = computed(() => {
  if (mode.value === 'encode') {
    if (!file.value) return 'Pick a file above to encode.';
    const mime = file.value.mimeType || 'unknown';
    return `${file.value.name || 'file'} · ${formatFileSize(file.value.size)} · ${mime}`;
  }
  if (!decoded.value) return 'Paste Base64 above to recover the file.';
  return `${decoded.value.name} · ${formatFileSize(decoded.value.size)} · ${decoded.value.mimeType}`;
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
    // No file to recover in encode mode — just switch.
    setMode('encode');
  }
}
</script>

<template>
  <div class="b64f">
    <ToolInput
      :title="mode === 'encode' ? 'File' : 'Base64'"
      :description="inputDescription"
    >
      <template #actions>
        <button
          v-if="file || input || decoded"
          class="b64f__btn b64f__btn--ghost"
          type="button"
          @click="clear"
        >
          <Trash2 :size="14" />
          <span>Clear</span>
        </button>
        <button
          class="b64f__btn b64f__btn--ghost"
          type="button"
          title="Swap direction"
          @click="swap"
        >
          <ArrowLeftRight :size="14" />
          <span>Swap</span>
        </button>
      </template>

      <div class="b64f__mode-row">
        <span class="b64f__label">Direction</span>
        <div class="b64f__mode-toggle">
          <button
            type="button"
            class="b64f__mode-opt"
            :class="{ 'b64f__mode-opt--active': mode === 'encode' }"
            :aria-pressed="mode === 'encode'"
            @click="onModeChange('encode')"
          >
            File → Base64
          </button>
          <button
            type="button"
            class="b64f__mode-opt"
            :class="{ 'b64f__mode-opt--active': mode === 'decode' }"
            :aria-pressed="mode === 'decode'"
            @click="onModeChange('decode')"
          >
            Base64 → File
          </button>
        </div>
        <button
          type="button"
          class="b64f__urlsafe"
          :class="{ 'b64f__urlsafe--active': urlSafe }"
          :aria-pressed="urlSafe"
          title="Use URL-safe alphabet (-_ instead of +/, no padding)"
          @click="urlSafe = !urlSafe"
        >
          <Link2 :size="13" />
          <span>URL-safe</span>
        </button>
      </div>

      <!-- Encode mode: drop zone -->
      <div v-if="mode === 'encode'">
        <div
          class="b64f__drop"
          :class="{ 'b64f__drop--over': dragOver }"
          role="button"
          tabindex="0"
          @click="pickFile"
          @keydown.enter="pickFile"
          @keydown.space.prevent="pickFile"
          @dragover.prevent="dragOver = true"
          @dragleave.prevent="dragOver = false"
          @drop.prevent="onDrop"
        >
          <Loader2 v-if="busy" :size="28" class="b64f__spin" />
          <FileUp v-else :size="28" class="b64f__drop-icon" />
          <p class="b64f__drop-title">
            {{ busy ? 'Reading file…' : 'Drop a file here or click to browse' }}
          </p>
          <p class="b64f__drop-hint">Max 32 MiB · processed locally</p>
          <input
            ref="fileInput"
            type="file"
            hidden
            @change="onPickerChange"
          />
        </div>

        <div v-if="file" class="b64f__file-meta">
          <div class="b64f__meta-row">
            <span class="b64f__meta-key">Name</span>
            <span class="b64f__meta-val">{{ file.name || '—' }}</span>
          </div>
          <div class="b64f__meta-row">
            <span class="b64f__meta-key">Size</span>
            <span class="b64f__meta-val">{{ formatFileSize(file.size) }}</span>
          </div>
          <div class="b64f__meta-row">
            <span class="b64f__meta-key">MIME</span>
            <span class="b64f__meta-val"><code>{{ file.mimeType || 'unknown' }}</code></span>
          </div>
        </div>

        <div v-if="file" class="b64f__toggle-row">
          <button
            type="button"
            class="b64f__urlsafe"
            :class="{ 'b64f__urlsafe--active': asDataUri }"
            :aria-pressed="asDataUri"
            title="Output as a Data URI (data:<mime>;base64,...)"
            @click="asDataUri = !asDataUri"
          >
            <Link2 :size="13" />
            <span>Data URI</span>
          </button>
        </div>
      </div>

      <!-- Decode mode: textarea -->
      <div v-else>
        <label class="b64f__field">
          <span class="b64f__label">Base64 or Data URI</span>
          <textarea
            class="b64f__textarea b64f__textarea--mono"
            placeholder="Paste Base64 or a data: URI here…"
            :value="input"
            rows="8"
            spellcheck="false"
            autocomplete="off"
            @input="input = ($event.target as HTMLTextAreaElement).value"
          />
        </label>
        <button
          class="b64f__btn"
          type="button"
          :disabled="input.trim().length === 0"
          @click="decode"
        >
          <span>Decode</span>
        </button>
      </div>
    </ToolInput>

    <ToolOutput
      :title="outputLabel"
      :description="outputDescription"
      :copy-text="copyText"
      :copy-label="mode === 'encode' ? 'Copy output' : 'Copy input'"
    >
      <template #actions>
        <button
          v-if="mode === 'decode' && decoded"
          class="b64f__btn"
          type="button"
          @click="download"
        >
          <Download :size="14" />
          <span>Download</span>
        </button>
      </template>

      <p v-if="error" class="b64f__error">
        <AlertCircle :size="14" />
        <span>{{ error }}</span>
      </p>

      <template v-else>
        <!-- Encode output -->
        <div v-if="mode === 'encode' && outputText" class="b64f__result">
          <code class="b64f__code">{{ outputText }}</code>
        </div>

        <!-- Decode output -->
        <div v-if="mode === 'decode' && decoded" class="b64f__decoded">
          <div class="b64f__meta-row">
            <span class="b64f__meta-key">Filename</span>
            <span class="b64f__meta-val">{{ decoded.name }}</span>
          </div>
          <div class="b64f__meta-row">
            <span class="b64f__meta-key">Size</span>
            <span class="b64f__meta-val">{{ formatFileSize(decoded.size) }}</span>
          </div>
          <div class="b64f__meta-row">
            <span class="b64f__meta-key">MIME</span>
            <span class="b64f__meta-val"><code>{{ decoded.mimeType }}</code></span>
          </div>
          <button
            class="b64f__btn b64f__btn--ghost"
            type="button"
            @click="download"
          >
            <Download :size="14" />
            <span>Download file</span>
          </button>
        </div>

        <p
          v-if="(mode === 'encode' && !outputText) || (mode === 'decode' && !decoded)"
          class="b64f__empty"
        >
          {{ mode === 'encode' ? 'Pick a file above to encode.' : 'Paste Base64 above to recover the file.' }}
        </p>
      </template>
    </ToolOutput>
  </div>
</template>

<style scoped>
.b64f {
  display: flex;
  flex-direction: column;
  gap: var(--qt-gap);
  max-width: var(--qt-max-content);
  margin: 0 auto;
}
.b64f__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.b64f__label {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--qt-muted);
}
.b64f__textarea {
  width: 100%;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  color: var(--qt-text);
  font: inherit;
  font-size: 14px;
  padding: 10px 12px;
  resize: vertical;
  min-height: 140px;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;
  will-change: border-color;
}
.b64f__textarea--mono {
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
}
.b64f__textarea:focus {
  border-color: var(--qt-accent);
  outline: none;
  box-shadow: 0 0 0 2px oklch(from var(--qt-accent) 90% c h / 0.25);
}
.b64f__mode-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
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
  will-change: color, background;
}
.b64f__mode-opt--active {
  color: var(--qt-bg);
  background: var(--qt-accent);
}
.b64f__urlsafe {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: 999px;
  color: var(--qt-muted);
  font: inherit;
  font-size: 12.5px;
  font-weight: 600;
  padding: 5px 11px;
  cursor: pointer;
  transition:
    color 0.15s ease,
    border-color 0.15s ease,
    background 0.15s ease;
  will-change: color, border-color;
}
.b64f__urlsafe--active {
  color: var(--qt-bg);
  background: var(--qt-accent);
  border-color: var(--qt-accent);
}
.b64f__btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: var(--qt-accent);
  border: 1px solid var(--qt-accent);
  border-radius: var(--qt-radius-sm);
  color: var(--qt-bg);
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  padding: 7px 12px;
  cursor: pointer;
  transition:
    transform 0.1s ease,
    opacity 0.15s ease;
  will-change: transform;
}
.b64f__btn:hover:not(:disabled) {
  transform: translateY(-1px);
}
.b64f__btn:active:not(:disabled) {
  transform: translateY(0);
}
.b64f__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.b64f__btn--ghost {
  background: transparent;
  color: var(--qt-text);
  border-color: var(--qt-border);
}
.b64f__btn--ghost:hover:not(:disabled) {
  border-color: var(--qt-accent);
  color: var(--qt-accent);
}
.b64f__drop {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 28px 16px;
  border: 1.5px dashed var(--qt-border);
  border-radius: var(--qt-radius);
  background: var(--qt-bg);
  color: var(--qt-muted);
  cursor: pointer;
  text-align: center;
  transition:
    border-color 0.15s ease,
    background 0.15s ease;
  will-change: border-color;
}
.b64f__drop:hover,
.b64f__drop--over {
  border-color: var(--qt-accent);
  background: oklch(from var(--qt-accent) 95% c h / 0.08);
}
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
.b64f__spin {
  color: var(--qt-accent);
  animation: b64f-spin 0.9s linear infinite;
}
@keyframes b64f-spin {
  to {
    transform: rotate(360deg);
  }
}
.b64f__file-meta,
.b64f__decoded {
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
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
.b64f__toggle-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.b64f__result {
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  padding: 10px 12px;
  max-height: 320px;
  overflow: auto;
}
.b64f__code {
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
  font-size: 13px;
  color: var(--qt-text);
  word-break: break-all;
  white-space: pre-wrap;
}
.b64f__error {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: var(--qt-danger);
  font-size: 13.5px;
}
.b64f__empty {
  margin: 0;
  color: var(--qt-muted);
  font-size: 13.5px;
}
</style>
