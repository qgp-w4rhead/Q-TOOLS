<script setup lang="ts">
/**
 * AudioMetadataEditor - view and edit ID3 / Vorbis / MP4 tags plus cover
 * art entirely in the browser via ffmpeg.wasm.
 *
 * Tags are read via ffprobe JSON and written with `-c copy` (lossless
 * remux - no re-encode). Cover art is extracted for preview and can be
 * replaced or removed.
 *
 * Works in embed mode: receives `input` PostMessages (url, tags, action)
 * and sends `output` PostMessages with status, tags, and result metadata.
 */
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  AlertCircle,
  Download,
  ImagePlus,
  Loader2,
  Music,
  Save,
  Trash2,
  X,
} from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import FileDropZone from '@/components/FileDropZone.vue';
import {
  useAudioMetadataEditor,
  TAG_FIELDS,
  MAX_FILE_SIZE,
} from './useAudioMetadataEditor';
import { formatBytes } from '@/utils/media';

const {
  file,
  tags,
  extraTags,
  hasCover,
  coverUrl,
  status,
  error,
  result,
  onFile,
  setCover,
  removeCover,
  save,
  download,
  clear,
} = useAudioMetadataEditor();

const { t } = useI18n();
const U = 'tools.audio-metadata-editor.ui.';

const coverInput = ref<HTMLInputElement | null>(null);
const busy = computed(
  () =>
    status.value === 'loading-engine' ||
    status.value === 'reading' ||
    status.value === 'writing',
);

const statusLabel = computed(() => {
  switch (status.value) {
    case 'loading-engine':
      return t(U + 'statusLoading');
    case 'reading':
      return t(U + 'statusReading');
    case 'writing':
      return t(U + 'statusWriting');
    case 'done':
      return t(U + 'statusSaved');
    case 'error':
      return t(U + 'statusFailed');
    default:
      return '';
  }
});

const outputDescription = computed(() => {
  if (result.value) {
    return `${result.value.name} · ${formatBytes(result.value.size)}`;
  }
  if (file.value) return t(U + 'descReady');
  return t(U + 'descEmpty');
});

const extraTagEntries = computed(() => Object.entries(extraTags.value));

function onFiles(files: File[]): void {
  const f = files[0];
  if (f) void onFile(f);
}

function onCoverPicked(e: Event): void {
  const input = e.target as HTMLInputElement;
  const f = input.files?.[0];
  if (f) setCover(f);
  input.value = '';
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
          v-if="file || result"
          class="qt-btn qt-btn--ghost"
          type="button"
          @click="clear"
        >
          <Trash2 :size="14" />
          <span>{{ t('common.clear') }}</span>
        </button>
      </template>

      <FileDropZone
        accept="audio/*,.mp3,.wav,.ogg,.oga,.flac,.aac,.m4a,.opus,.wma,.aiff,.aif,.mka"
        :busy="busy"
        :hint="t(U + 'dropHint', { size: formatBytes(MAX_FILE_SIZE) })"
        @files="onFiles"
      />

      <div v-if="file" class="qt-panel qt-row qt-row--center" style="--qt-row-gap:8px;flex-wrap:nowrap;padding:8px 12px;font-size:13px">
        <Music :size="15" style="color:var(--qt-accent);flex-shrink:0" />
        <span style="color:var(--qt-text);font-weight:600;word-break:break-all;min-width:0">{{ file.name }}</span>
        <span class="qt-hint" style="margin-left:auto;font-size:12.5px;flex-shrink:0">{{ formatBytes(file.size) }}</span>
      </div>

      <template v-if="file && !busy">
        <div class="qt-row" style="--qt-row-gap:16px">
          <div class="qt-stack" style="--qt-stack-gap:8px;flex:0 0 140px">
            <div v-if="coverUrl" style="position:relative;width:140px;height:140px">
              <img :src="coverUrl" :alt="t(U + 'coverAlt')" style="width:140px;height:140px;object-fit:cover;border-radius:var(--qt-radius-sm);border:1px solid var(--qt-border);display:block" />
              <button
                class="qt-btn qt-btn--outline ameta__cover-remove"
                type="button"
                :title="t(U + 'coverRemoveTitle')"
                @click="removeCover"
              >
                <X :size="13" />
              </button>
            </div>
            <button
              v-else
              class="qt-drop"
              style="width:140px;height:140px;padding:0;font-size:12px;border-width:1.5px"
              type="button"
              @click="coverInput?.click()"
            >
              <ImagePlus :size="20" />
              <span>{{ hasCover ? t(U + 'coverReplace') : t(U + 'coverAdd') }}</span>
            </button>
            <button
              v-if="coverUrl"
              class="qt-btn qt-btn--ghost qt-btn--sm"
              type="button"
              @click="coverInput?.click()"
            >
              <ImagePlus :size="13" />
              <span>{{ t(U + 'replaceLabel') }}</span>
            </button>
            <input
              ref="coverInput"
              type="file"
              hidden
              accept="image/jpeg,image/png,image/webp"
              @change="onCoverPicked"
            />
          </div>

          <div class="qt-grid" style="--qt-grid-min:220px;--qt-grid-gap:10px 14px;flex:1 1 280px">
            <label v-for="f in TAG_FIELDS" :key="f.key" class="qt-field" style="gap:4px">
              <span class="qt-label" style="font-size:12px">{{ f.label }}</span>
              <input
                v-model="tags[f.key]"
                type="text"
                class="qt-input"
                style="font-size:13.5px;padding:7px 10px"
                spellcheck="false"
              />
            </label>
          </div>
        </div>

        <details v-if="extraTagEntries.length" class="qt-panel" style="padding:8px 12px">
          <summary style="font-size:12.5px;font-weight:600;color:var(--qt-muted);cursor:pointer">
            {{ t(extraTagEntries.length === 1 ? U + 'otherTagsOne' : U + 'otherTags', { n: extraTagEntries.length }) }}
          </summary>
          <div class="qt-stack" style="--qt-stack-gap:4px;margin-top:8px">
            <div v-for="[k, v] in extraTagEntries" :key="k" class="qt-row" style="--qt-row-gap:10px;align-items:baseline;font-size:13px">
              <span class="qt-label" style="flex:0 0 90px;font-size:12.5px;word-break:break-all">{{ k }}</span>
              <span style="color:var(--qt-text);word-break:break-all">{{ v }}</span>
            </div>
          </div>
        </details>

        <button class="qt-btn qt-btn--primary" style="align-self:flex-start" type="button" :disabled="busy" @click="save">
          <Loader2 v-if="busy" :size="14" class="qt-spin" />
          <Save v-else :size="14" />
          <span>{{ busy ? t(U + 'btnWorking') : t(U + 'btnSave') }}</span>
        </button>
      </template>

      <p v-if="statusLabel" class="qt-hint" style="margin:0;font-size:12.5px">{{ statusLabel }}</p>
    </ToolInput>

    <ToolOutput
      :title="t(U + 'outTitle')"
      :description="outputDescription"
      :hide-copy="true"
    >
      <template #actions>
        <button
          v-if="result"
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
        <span style="white-space:pre-wrap;word-break:break-word">{{ error }}</span>
      </p>

      <template v-else>
        <div v-if="result" class="qt-panel qt-stack" style="--qt-stack-gap:10px;padding:10px 12px">
          <audio :src="result.url" controls style="width:100%;height:40px" />
          <div class="qt-row" style="--qt-row-gap:10px;align-items:baseline;font-size:13px">
            <span class="qt-label" style="flex:0 0 90px;font-size:12.5px;word-break:break-all">{{ t(U + 'lblFile') }}</span>
            <span style="color:var(--qt-text);word-break:break-all">{{ result.name }}</span>
          </div>
          <div class="qt-row" style="--qt-row-gap:10px;align-items:baseline;font-size:13px">
            <span class="qt-label" style="flex:0 0 90px;font-size:12.5px;word-break:break-all">{{ t(U + 'lblSize') }}</span>
            <span style="color:var(--qt-text);word-break:break-all">{{ formatBytes(result.size) }}</span>
          </div>
        </div>
        <p v-else class="qt-alert qt-alert--empty">
          {{ file ? t(U + 'alertReady') : t(U + 'alertEmpty') }}
        </p>
      </template>
    </ToolOutput>
  </div>
</template>

<style scoped>
/* Kept scoped: absolute-positioned remove button over the cover thumbnail
   with a danger hover tint. */
.ameta__cover-remove {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 24px;
  height: 24px;
  padding: 0;
  justify-content: center;
  border-radius: 4px;
  background: var(--qt-bg);
}
.ameta__cover-remove:hover:not(:disabled) {
  color: var(--qt-danger);
  border-color: var(--qt-danger);
}
</style>
