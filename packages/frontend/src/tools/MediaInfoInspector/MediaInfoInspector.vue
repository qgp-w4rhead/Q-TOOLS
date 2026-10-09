<script setup lang="ts">
/**
 * MediaInfoInspector - inspect a media file's container, codecs,
 * duration, bitrate, resolution, and streams entirely in the browser via
 * ffprobe (ffmpeg.wasm, lazy-loaded).
 *
 * Shows a flattened summary plus the raw ffprobe JSON for power users.
 *
 * Works in embed mode: receives `input` PostMessages (url) and sends
 * `output` PostMessages with status and the parsed summary.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  AlertCircle,
  FileVideo,
  Info,
  Loader2,
  Trash2,
} from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import FileDropZone from '@/components/FileDropZone.vue';
import CopyButton from '@/components/CopyButton.vue';
import {
  useMediaInfoInspector,
  formatBitrate,
  MAX_FILE_SIZE,
} from './useMediaInfoInspector';
import { formatBytes } from '@/utils/media';

const {
  file,
  summary,
  rawJson,
  status,
  error,
  onFile,
  clear,
} = useMediaInfoInspector();

const { t } = useI18n();
const U = 'tools.media-info-inspector.ui.';

const busy = computed(() => status.value === 'loading-engine' || status.value === 'probing');

const statusLabel = computed(() => {
  switch (status.value) {
    case 'loading-engine':
      return t(U + 'statusLoading');
    case 'probing':
      return t(U + 'statusProbing');
    case 'done':
      return t(U + 'statusDone');
    case 'error':
      return t(U + 'statusFailed');
    default:
      return '';
  }
});

const outputDescription = computed(() => {
  if (summary.value) return summary.value.container;
  if (file.value) return t(U + 'descProbing');
  return t(U + 'descEmpty');
});

const tagEntries = computed(() =>
  summary.value ? Object.entries(summary.value.tags) : [],
);

const summaryText = computed(() => {
  const s = summary.value;
  if (!s || !file.value) return '';
  const lines = [
    t(U + 'sumFile', { name: file.value.name }),
    t(U + 'sumSize', { size: formatBytes(file.value.size) }),
    t(U + 'sumContainer', { c: s.container }),
    t(U + 'sumDuration', { d: s.durationText }),
    t(U + 'sumBitrate', { b: s.bitrateKbps !== null ? formatBitrate(s.bitrateKbps * 1000) : '-' }),
    ...s.streams.map((st) =>
      t(U + 'sumStream', { i: st.index, type: st.type, codec: st.codec, details: st.details.join(', ') }),
    ),
    ...tagEntries.value.map(([k, v]) => `${k}: ${v}`),
  ];
  return lines.join('\n');
});

function onFiles(files: File[]): void {
  const f = files[0];
  if (f) void onFile(f);
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
          v-if="file || summary"
          class="qt-btn qt-btn--ghost"
          type="button"
          @click="clear"
        >
          <Trash2 :size="14" />
          <span>{{ t('common.clear') }}</span>
        </button>
      </template>

      <FileDropZone
        accept="audio/*,video/*,.mp3,.wav,.ogg,.oga,.flac,.aac,.m4a,.opus,.wma,.mp4,.webm,.mov,.avi,.mkv,.m4v,.wmv,.flv,.ts,.mts,.m2ts,.3gp,.mpg,.mpeg,.vob,.ogv,.gif"
        :busy="busy"
        :hint="t(U + 'dropHint', { size: formatBytes(MAX_FILE_SIZE) })"
        @files="onFiles"
      />

      <div v-if="file" class="qt-panel qt-row qt-row--center" style="--qt-row-gap:8px;flex-wrap:nowrap;padding:8px 12px;font-size:13px">
        <FileVideo :size="15" style="color:var(--qt-accent);flex-shrink:0" />
        <span style="color:var(--qt-text);font-weight:600;word-break:break-all;min-width:0">{{ file.name }}</span>
        <span class="qt-hint" style="margin-left:auto;font-size:12.5px;flex-shrink:0">{{ formatBytes(file.size) }}</span>
      </div>

      <p v-if="statusLabel" class="qt-hint" style="display:inline-flex;align-items:center;gap:6px;margin:0;font-size:12.5px">
        <Loader2 v-if="busy" :size="13" class="qt-spin" />
        <span>{{ statusLabel }}</span>
      </p>
    </ToolInput>

    <ToolOutput
      :title="t(U + 'outTitle')"
      :description="outputDescription"
      :copy-text="summaryText"
      :copy-label="t(U + 'copyLabel')"
    >
      <p v-if="error" class="qt-alert qt-alert--error">
        <AlertCircle :size="14" />
        <span style="white-space:pre-wrap;word-break:break-word">{{ error }}</span>
      </p>

      <template v-else>
        <div v-if="summary" class="qt-stack" style="--qt-stack-gap:14px">
          <div class="qt-panel qt-stack" style="--qt-stack-gap:6px;padding:10px 12px">
            <div class="qt-row" style="--qt-row-gap:10px;align-items:baseline;font-size:13px">
              <span class="qt-label" style="flex:0 0 90px;font-size:12.5px">{{ t(U + 'lblContainer') }}</span>
              <span style="color:var(--qt-text);word-break:break-all">{{ summary.container }}</span>
            </div>
            <div class="qt-row" style="--qt-row-gap:10px;align-items:baseline;font-size:13px">
              <span class="qt-label" style="flex:0 0 90px;font-size:12.5px">{{ t(U + 'lblDuration') }}</span>
              <span style="color:var(--qt-text);word-break:break-all">{{ summary.durationText }}</span>
            </div>
            <div class="qt-row" style="--qt-row-gap:10px;align-items:baseline;font-size:13px">
              <span class="qt-label" style="flex:0 0 90px;font-size:12.5px">{{ t(U + 'lblBitrate') }}</span>
              <span style="color:var(--qt-text);word-break:break-all">
                {{ summary.bitrateKbps !== null ? formatBitrate(summary.bitrateKbps * 1000) : '-' }}
              </span>
            </div>
            <div class="qt-row" style="--qt-row-gap:10px;align-items:baseline;font-size:13px">
              <span class="qt-label" style="flex:0 0 90px;font-size:12.5px">{{ t(U + 'lblSize') }}</span>
              <span style="color:var(--qt-text);word-break:break-all">
                {{ summary.sizeBytes !== null ? formatBytes(summary.sizeBytes) : formatBytes(file?.size ?? 0) }}
              </span>
            </div>
            <div v-if="summary.probeScore !== null" class="qt-row" style="--qt-row-gap:10px;align-items:baseline;font-size:13px">
              <span class="qt-label" style="flex:0 0 90px;font-size:12.5px">{{ t(U + 'lblProbeScore') }}</span>
              <span style="color:var(--qt-text);word-break:break-all">{{ summary.probeScore }} / 100</span>
            </div>
          </div>

          <div v-if="summary.streams.length" class="qt-stack" style="--qt-stack-gap:8px">
            <h3 class="qt-stat-head" style="margin:0 0 6px">{{ t(U + 'streamsTitle') }}</h3>
            <div
              v-for="s in summary.streams"
              :key="s.index"
              class="qt-panel"
              style="padding:8px 12px"
            >
              <div class="qt-row qt-row--center" style="--qt-row-gap:8px;font-size:13px">
                <span class="qt-badge" style="border-radius:4px">#{{ s.index }}</span>
                <span style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;color:var(--qt-accent)">{{ s.type }}</span>
                <span style="color:var(--qt-text);font-weight:600">{{ s.codec }}</span>
              </div>
              <p v-if="s.details.length" class="qt-hint" style="margin:4px 0 0;font-size:12.5px">
                {{ s.details.join(' · ') }}
              </p>
            </div>
          </div>

          <div v-if="tagEntries.length" class="qt-panel qt-stack" style="--qt-stack-gap:6px;padding:10px 12px">
            <h3 class="qt-stat-head" style="margin:0 0 6px">{{ t(U + 'tagsTitle') }}</h3>
            <div v-for="[k, v] in tagEntries" :key="k" class="qt-row" style="--qt-row-gap:10px;align-items:baseline;font-size:13px">
              <span class="qt-label" style="flex:0 0 90px;font-size:12.5px">{{ k }}</span>
              <span style="color:var(--qt-text);word-break:break-all">{{ v }}</span>
            </div>
          </div>

          <details v-if="rawJson" class="qt-panel" style="padding:8px 12px">
            <summary class="qt-row qt-row--center" style="--qt-row-gap:8px;font-size:12.5px;font-weight:600;color:var(--qt-muted);cursor:pointer">
              <Info :size="13" />
              <span>{{ t(U + 'rawTitle') }}</span>
              <CopyButton :text="rawJson" :label="t(U + 'copyJson')" />
            </summary>
            <pre class="qt-mono" style="margin:10px 0 0;max-height:320px;overflow:auto;font-size:11.5px;color:var(--qt-text);white-space:pre-wrap;word-break:break-word">{{ rawJson }}</pre>
          </details>
        </div>
        <p v-else class="qt-alert qt-alert--empty">
          {{ file ? t(U + 'alertProbing') : t(U + 'alertEmpty') }}
        </p>
      </template>
    </ToolOutput>
  </div>
</template>
