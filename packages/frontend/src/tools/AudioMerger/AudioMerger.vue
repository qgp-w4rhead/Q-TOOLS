<script setup lang="ts">
/**
 * AudioMerger - concatenate multiple audio files into a single track
 * entirely in the browser via ffmpeg.wasm (concat demuxer + re-encode).
 *
 * Files can be reordered with up/down buttons and removed individually.
 * Mixed codecs/containers are fine - everything is re-encoded to the
 * chosen output format.
 *
 * Works in embed mode: receives `input` PostMessages (urls, format,
 * bitrate, action) and sends `output` PostMessages with status/progress
 * and result metadata.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Download,
  Loader2,
  Merge,
  Music,
  Trash2,
  X,
} from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import FileDropZone from '@/components/FileDropZone.vue';
import {
  useAudioMerger,
  MERGE_FORMATS,
  AUDIO_BITRATES,
  MAX_FILES,
  MAX_FILE_SIZE,
} from './useAudioMerger';
import { formatBytes } from '@/utils/media';

const {
  items,
  format,
  bitrate,
  status,
  progress,
  error,
  result,
  addFiles,
  removeItem,
  moveItem,
  merge,
  download,
  clear,
} = useAudioMerger();

const { t } = useI18n();
const U = 'tools.audio-merger.ui.';

const busy = computed(() => status.value === 'loading-engine' || status.value === 'processing');
const lossless = computed(
  () => MERGE_FORMATS.find((f) => f.id === format.value)?.lossless ?? false,
);

const statusLabel = computed(() => {
  switch (status.value) {
    case 'loading-engine':
      return t(U + 'statusLoading');
    case 'processing':
      return t(U + 'statusMerging', { pct: Math.round(progress.value * 100) });
    case 'done':
      return t(U + 'statusDone');
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
  if (items.value.length > 0) {
    return t(items.value.length === 1 ? U + 'descQueuedOne' : U + 'descQueued', { n: items.value.length });
  }
  return t(U + 'descEmpty');
});

const totalSize = computed(() => items.value.reduce((s, i) => s + i.size, 0));
</script>

<template>
  <div class="qt-tool">
    <ToolInput
      :title="t(U + 'inputTitle')"
      :description="t(U + 'desc', { max: MAX_FILES, size: formatBytes(MAX_FILE_SIZE) })"
    >
      <template #actions>
        <button
          v-if="items.length || result"
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
        :multiple="true"
        :busy="busy"
        :title="t(U + 'dropTitle')"
        :hint="t(U + 'dropHintLocal')"
        @files="addFiles"
      />

      <ul v-if="items.length" class="qt-list qt-stack" style="--qt-stack-gap:6px">
        <li v-for="(item, idx) in items" :key="item.id" class="qt-panel qt-row qt-row--center" style="--qt-row-gap:8px;flex-wrap:nowrap;padding:7px 10px;font-size:13px">
          <span class="qt-badge" style="border-radius:4px;flex:0 0 20px;justify-content:center;padding:1px 0">{{ idx + 1 }}</span>
          <Music :size="14" style="color:var(--qt-accent);flex-shrink:0" />
          <span style="color:var(--qt-text);font-weight:600;word-break:break-all;min-width:0">{{ item.name }}</span>
          <span class="qt-hint" style="margin-left:auto;font-size:12px;flex-shrink:0">{{ formatBytes(item.size) }}</span>
          <div class="qt-row" style="--qt-row-gap:4px;flex-shrink:0;flex-wrap:nowrap">
            <button
              class="qt-btn qt-btn--ghost qt-btn--icon"
              style="width:24px;height:24px;padding:0;justify-content:center;border-radius:4px"
              type="button"
              :title="t(U + 'moveUpTitle')"
              :disabled="idx === 0"
              @click="moveItem(item.id, -1)"
            >
              <ArrowUp :size="13" />
            </button>
            <button
              class="qt-btn qt-btn--ghost qt-btn--icon"
              style="width:24px;height:24px;padding:0;justify-content:center;border-radius:4px"
              type="button"
              :title="t(U + 'moveDownTitle')"
              :disabled="idx === items.length - 1"
              @click="moveItem(item.id, 1)"
            >
              <ArrowDown :size="13" />
            </button>
            <button
              class="qt-btn qt-btn--ghost qt-btn--icon amerge__icon-btn--danger"
              style="width:24px;height:24px;padding:0;justify-content:center;border-radius:4px"
              type="button"
              :title="t(U + 'removeTitle')"
              @click="removeItem(item.id)"
            >
              <X :size="13" />
            </button>
          </div>
        </li>
      </ul>

      <div v-if="items.length" class="qt-stack" style="--qt-stack-gap:12px">
        <label class="qt-field">
          <span class="qt-label">{{ t(U + 'fmtLabel') }}</span>
          <div class="qt-row" style="--qt-row-gap:6px">
            <button
              v-for="f in MERGE_FORMATS"
              :key="f.id"
              type="button"
              class="qt-chip qt-chip--filled"
              :class="{ 'qt-chip--solid': format === f.id }"
              :aria-pressed="format === f.id"
              style="font-size:12.5px;padding:5px 12px"
              @click="format = f.id"
            >
              {{ f.label }}
            </button>
          </div>
        </label>

        <label v-if="!lossless" class="qt-field">
          <span class="qt-label">{{ t(U + 'bitrateLabel') }}</span>
          <select v-model.number="bitrate" class="qt-input" style="font-size:13.5px;padding:7px 10px;max-width:220px">
            <option v-for="b in AUDIO_BITRATES" :key="b" :value="b">{{ b }} kbps</option>
          </select>
        </label>

        <button
          class="qt-btn qt-btn--primary"
          style="align-self:flex-start"
          type="button"
          :disabled="busy || items.length < 2"
          @click="merge"
        >
          <Loader2 v-if="busy" :size="14" class="qt-spin" />
          <Merge v-else :size="14" />
          <span>{{ busy ? t(U + 'btnWorking') : t(U + 'btnMerge', { n: items.length }) }}</span>
        </button>
      </div>

      <div v-if="busy" class="qt-progress-track" style="height:6px">
        <div class="qt-progress-fill" :style="{ width: `${Math.round(progress * 100)}%` }" />
      </div>
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
            <span class="qt-label" style="flex:0 0 60px;font-size:12.5px">{{ t(U + 'lblFile') }}</span>
            <span style="color:var(--qt-text);word-break:break-all">{{ result.name }}</span>
          </div>
          <div class="qt-row" style="--qt-row-gap:10px;align-items:baseline;font-size:13px">
            <span class="qt-label" style="flex:0 0 60px;font-size:12.5px">{{ t(U + 'lblSize') }}</span>
            <span style="color:var(--qt-text);word-break:break-all">
              {{ formatBytes(result.size) }}
              <template v-if="totalSize">
                ({{ t(U + 'sizeInOut', { inSize: formatBytes(totalSize), outSize: formatBytes(result.size) }) }})
              </template>
            </span>
          </div>
        </div>
        <p v-else class="qt-alert qt-alert--empty">
          {{ items.length ? t(U + 'alertReady') : t(U + 'alertEmpty') }}
        </p>
      </template>
    </ToolOutput>
  </div>
</template>

<style scoped>
/* Kept scoped: danger hover tint on the per-track remove button. */
.amerge__icon-btn--danger:hover:not(:disabled) {
  color: var(--qt-danger);
  border-color: var(--qt-danger);
}
</style>
