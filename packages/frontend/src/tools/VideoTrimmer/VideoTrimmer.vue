<script setup lang="ts">
/**
 * VideoTrimmer - cut a video clip by start/end timestamp entirely in the
 * browser via ffmpeg.wasm.
 *
 * Stream-copy mode is instant + lossless (keyframe-accurate); re-encode
 * mode is frame-accurate. The `<video>` preview reports the duration and
 * lets the user grab the current frame time into the start/end fields.
 * A scrubbable timeline below the preview mirrors the same range - its
 * handles update the text fields and seek the preview while dragging.
 * An optional audio track can be merged onto the cut: a second timeline
 * lets the user drag the clip across the video timeline, and it either
 * replaces or mixes with the video's own audio.
 *
 * Works in embed mode: receives `input` PostMessages (url, start, end,
 * mode, crf, audioUrl, audioOffset, audioMode, action) and sends `output`
 * PostMessages with status/progress and result metadata.
 */
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  AlertCircle,
  Download,
  Film,
  Loader2,
  Music,
  Plus,
  Repeat,
  Scissors,
  Trash2,
  X,
} from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import FileDropZone from '@/components/FileDropZone.vue';
import TrimTimeline from '@/components/TrimTimeline.vue';
import ClipTimeline from '@/components/ClipTimeline.vue';
import {
  useVideoTrimmer,
  TRIM_MODES,
  AUDIO_MERGE_MODES,
  CRF_MIN,
  CRF_MAX,
  MAX_FILE_SIZE,
  MAX_AUDIO_FILE_SIZE,
} from './useVideoTrimmer';
import {
  formatBytes,
  formatDuration,
  formatTimestamp,
  parseTimestamp,
} from '@/utils/media';

const {
  file,
  duration,
  startText,
  endText,
  mode,
  crf,
  status,
  progress,
  error,
  result,
  audioFile,
  audioDuration,
  audioOffsets,
  audioLoop,
  audioMode,
  onFile,
  onAudioFile,
  removeAudio,
  addAudioClip,
  removeAudioClip,
  setAudioDuration,
  setDuration,
  trim,
  download,
  clear,
} = useVideoTrimmer();

const { t } = useI18n();
const U = 'tools.video-trimmer.ui.';

const videoEl = ref<HTMLVideoElement | null>(null);
const audioEl = ref<HTMLAudioElement | null>(null);
/** One hidden <audio> per clip copy, kept in sync with the video. */
const clipEls: (HTMLAudioElement | null)[] = [];
const currentTime = ref<number>(0);

function setClipEl(el: Element | null, i: number): void {
  clipEls[i] = el as HTMLAudioElement | null;
}
const busy = computed(() => status.value === 'loading-engine' || status.value === 'processing');

/** Selection bounds in seconds, derived from the text fields. */
const startSec = computed(() => {
  const t = startText.value.trim();
  if (!t) return 0;
  const parsed = parseTimestamp(t);
  return parsed === null ? 0 : Math.min(Math.max(0, parsed), duration.value || parsed);
});
const endSec = computed(() => {
  const t = endText.value.trim();
  if (!t) return duration.value;
  const parsed = parseTimestamp(t);
  return parsed === null ? duration.value : Math.min(Math.max(0, parsed), duration.value || parsed);
});

const statusLabel = computed(() => {
  switch (status.value) {
    case 'loading-engine':
      return t(U + 'statusLoading');
    case 'processing':
      return t(U + 'statusTrimming', { pct: Math.round(progress.value * 100) });
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
  if (file.value) return t(U + 'descReady');
  return t(U + 'descEmpty');
});

function onFiles(files: File[]): void {
  const f = files[0];
  if (f) onFile(f);
}

function onAudioFiles(files: File[]): void {
  const f = files[0];
  if (f) onAudioFile(f);
}

function onAudioLoadedMetadata(e: Event): void {
  const a = e.target as HTMLAudioElement;
  if (a && Number.isFinite(a.duration)) setAudioDuration(a.duration);
}

function onLoadedMetadata(): void {
  const v = videoEl.value;
  if (v && Number.isFinite(v.duration)) setDuration(v.duration);
}

function onTimeUpdate(): void {
  const v = videoEl.value;
  if (v) currentTime.value = v.currentTime;
  syncAudio();
}

/**
 * Keep the merge-audio elements locked to the video preview. Each clip
 * copy sits at its `audioOffsets[i]` position on the video timeline, so
 * audio time = video time - offset; outside the clip's range it stays
 * paused. With `audioLoop` the element loops the file (matching ffmpeg's
 * `-stream_loop -1`) and the drift target wraps modulo the clip length.
 * In 'replace' mode the video's own soundtrack is muted so the preview
 * matches the output.
 */
function syncAudio(): void {
  const v = videoEl.value;
  if (!v) return;
  v.muted = !!audioFile.value && audioMode.value === 'replace';
  // The standalone audition player must not double up with the preview.
  const audition = audioEl.value;
  if (audition && !v.paused && !audition.paused) audition.pause();
  if (!audioFile.value) return;

  const clipDur = audioDuration.value;
  const loop = audioLoop.value && clipDur > 0;
  audioOffsets.value.forEach((off, i) => {
    const a = clipEls[i];
    if (!a) return;
    a.loop = loop;
    const raw = v.currentTime - off;
    const inRange = loop
      ? raw >= 0
      : raw >= 0 && (clipDur <= 0 || raw < clipDur);
    const target = loop ? raw % clipDur : raw;
    if (inRange && Math.abs(a.currentTime - target) > 0.3) {
      try {
        a.currentTime = target;
      } catch {
        /* not seekable yet */
      }
    }
    if (!v.paused && !v.ended && inRange) {
      if (a.playbackRate !== v.playbackRate) a.playbackRate = v.playbackRate;
      if (a.paused) void a.play().catch(() => {});
    } else if (!a.paused) {
      a.pause();
    }
  });
}

// Re-sync when clips are dragged/added/removed or mode/loop changes.
watch([audioFile, audioMode, audioLoop, audioOffsets], syncAudio, {
  deep: true,
});

/** Timeline drag → update the matching text field. */
function onTimelineStart(sec: number): void {
  startText.value = formatTimestamp(sec);
}
function onTimelineEnd(sec: number): void {
  endText.value = formatTimestamp(sec);
}

/** Timeline scrub → move the preview playhead. */
function onTimelineSeek(sec: number): void {
  const v = videoEl.value;
  if (v && Number.isFinite(sec)) v.currentTime = sec;
}

/** Grab the preview's current time into a field. */
function grabCurrent(target: 'start' | 'end'): void {
  const v = videoEl.value;
  if (!v) return;
  const t = formatTimestamp(v.currentTime);
  if (target === 'start') startText.value = t;
  else endText.value = t;
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
        accept="video/*,.mp4,.webm,.mov,.avi,.mkv,.m4v,.wmv,.flv,.ts,.mts,.m2ts,.3gp,.mpg,.mpeg,.vob,.ogv"
        :busy="busy"
        :hint="t(U + 'dropHint', { size: formatBytes(MAX_FILE_SIZE) })"
        @files="onFiles"
      />

      <template v-if="file">
        <div class="qt-panel qt-row qt-row--center" style="--qt-row-gap:8px;flex-wrap:nowrap;padding:8px 12px;font-size:13px">
          <Film :size="15" style="color:var(--qt-accent);flex-shrink:0" />
          <span style="color:var(--qt-text);font-weight:600;word-break:break-all;min-width:0">{{ file.name }}</span>
          <span class="qt-hint" style="margin-left:auto;font-size:12.5px;flex-shrink:0">
            {{ formatBytes(file.size) }}
            <template v-if="duration"> · {{ formatDuration(duration, true) }}</template>
          </span>
        </div>

        <video
          ref="videoEl"
          :src="file.previewUrl"
          controls
          style="width:100%;max-height:280px;background:#000;border-radius:var(--qt-radius-sm)"
          @loadedmetadata="onLoadedMetadata"
          @timeupdate="onTimeUpdate"
          @play="syncAudio"
          @pause="syncAudio"
          @seeked="syncAudio"
          @ratechange="syncAudio"
          @ended="syncAudio"
        />

        <TrimTimeline
          v-if="duration > 0"
          :duration="duration"
          :start="startSec"
          :end="endSec"
          :current-time="currentTime"
          :disabled="busy"
          @update:start="onTimelineStart"
          @update:end="onTimelineEnd"
          @seek="onTimelineSeek"
        />

        <div class="qt-panel qt-stack" style="--qt-stack-gap:10px;padding:10px 12px;background:oklch(from var(--qt-bg) l c h / 0.5)">
          <div class="qt-row qt-row--center qt-row--between" style="--qt-row-gap:8px">
            <span class="qt-label">{{ t(U + 'audioTrackLabel') }}</span>
            <div v-if="audioFile" class="qt-row" style="--qt-row-gap:6px;flex-wrap:nowrap">
              <button
                class="qt-btn qt-btn--ghost qt-btn--sm"
                type="button"
                :title="t(U + 'addClipTitle')"
                @click="addAudioClip(currentTime)"
              >
                <Plus :size="13" />
                <span>{{ t(U + 'addClipLabel') }}</span>
              </button>
              <button
                class="qt-btn qt-btn--ghost qt-btn--sm"
                type="button"
                :title="t(U + 'removeTitle')"
                @click="removeAudio"
              >
                <X :size="13" />
                <span>{{ t(U + 'removeLabel') }}</span>
              </button>
            </div>
          </div>

          <FileDropZone
            v-if="!audioFile"
            accept="audio/*,video/*,.mp3,.wav,.ogg,.oga,.flac,.aac,.m4a,.opus,.wma,.aiff,.aif,.mka"
            :busy="busy"
            :compact="true"
            :title="t(U + 'audioDropTitle')"
            :hint="t(U + 'audioDropHint', { size: formatBytes(MAX_AUDIO_FILE_SIZE) })"
            @files="onAudioFiles"
          />

          <template v-else>
            <div class="qt-panel qt-row qt-row--center" style="--qt-row-gap:8px;flex-wrap:nowrap;padding:8px 12px;font-size:13px">
              <Music :size="15" style="color:var(--qt-accent);flex-shrink:0" />
              <span style="color:var(--qt-text);font-weight:600;word-break:break-all;min-width:0">{{ audioFile.name }}</span>
              <span class="qt-hint" style="margin-left:auto;font-size:12.5px;flex-shrink:0">
                {{ formatBytes(audioFile.size) }}
                <template v-if="audioDuration">
                  · {{ formatDuration(audioDuration, true) }}
                </template>
              </span>
            </div>

            <audio
              ref="audioEl"
              :src="audioFile.previewUrl"
              controls
              preload="auto"
              style="width:100%;height:36px"
              @loadedmetadata="onAudioLoadedMetadata"
            />

            <!-- One hidden element per clip copy, synced to the video. -->
            <audio
              v-for="i in audioOffsets.length"
              :key="i"
              :ref="(el) => setClipEl(el as Element | null, i - 1)"
              :src="audioFile.previewUrl"
              preload="auto"
              style="display:none"
            />

            <ClipTimeline
              v-if="duration > 0"
              :duration="duration"
              :clip-duration="audioDuration"
              :offsets="audioOffsets"
              :loop="audioLoop"
              :current-time="currentTime"
              :disabled="busy"
              @update:offsets="audioOffsets = $event"
              @remove-clip="removeAudioClip"
              @seek="onTimelineSeek"
            />

            <div class="qt-field">
              <div class="qt-row" style="--qt-row-gap:6px">
                <button
                  v-for="m in AUDIO_MERGE_MODES"
                  :key="m.id"
                  type="button"
                  class="qt-chip qt-chip--filled"
                  :class="{ 'qt-chip--solid': audioMode === m.id }"
                  :aria-pressed="audioMode === m.id"
                  :title="m.hint"
                  style="font-size:12.5px;padding:5px 12px"
                  @click="audioMode = m.id"
                >
                  {{ m.label }}
                </button>
                <button
                  type="button"
                  class="qt-chip qt-chip--filled"
                  :class="{ 'qt-chip--solid': audioLoop }"
                  :aria-pressed="audioLoop"
                  :title="t(U + 'loopTitle')"
                  style="font-size:12.5px;padding:5px 12px;display:inline-flex;align-items:center;gap:5px"
                  @click="audioLoop = !audioLoop"
                >
                  <Repeat :size="12" />
                  <span>{{ t(U + 'loopLabel') }}</span>
                </button>
              </div>
              <span class="qt-hint" style="font-size:12px">
                {{ AUDIO_MERGE_MODES.find((m) => m.id === audioMode)?.hint }}
              </span>
            </div>
          </template>
        </div>

        <div class="qt-stack" style="--qt-stack-gap:12px">
          <div class="qt-row" style="--qt-row-gap:16px">
            <label class="qt-field" style="flex:1 1 200px">
              <span class="qt-label">{{ t(U + 'startLabel') }}</span>
              <div class="qt-row" style="--qt-row-gap:8px;flex-wrap:nowrap">
                <input
                  v-model="startText"
                  type="text"
                  class="qt-input"
                  style="flex:1;font-size:13.5px;padding:7px 10px"
                  placeholder="0:00"
                  spellcheck="false"
                />
                <button
                  class="qt-btn qt-btn--ghost qt-btn--sm"
                  type="button"
                  :title="t(U + 'grabTitle')"
                  @click="grabCurrent('start')"
                >
                  {{ t(U + 'grabLabel') }}
                </button>
              </div>
            </label>
            <label class="qt-field" style="flex:1 1 200px">
              <span class="qt-label">{{ t(U + 'endLabel') }}</span>
              <div class="qt-row" style="--qt-row-gap:8px;flex-wrap:nowrap">
                <input
                  v-model="endText"
                  type="text"
                  class="qt-input"
                  style="flex:1;font-size:13.5px;padding:7px 10px"
                  :placeholder="duration ? formatTimestamp(duration) : t(U + 'phEnd')"
                  spellcheck="false"
                />
                <button
                  class="qt-btn qt-btn--ghost qt-btn--sm"
                  type="button"
                  :title="t(U + 'grabTitle')"
                  @click="grabCurrent('end')"
                >
                  {{ t(U + 'grabLabel') }}
                </button>
              </div>
            </label>
          </div>

          <label class="qt-field">
            <span class="qt-label">{{ t(U + 'modeLabel') }}</span>
            <div class="qt-row" style="--qt-row-gap:6px">
              <button
                v-for="m in TRIM_MODES"
                :key="m.id"
                type="button"
                class="qt-chip qt-chip--filled"
                :class="{ 'qt-chip--solid': mode === m.id }"
                :aria-pressed="mode === m.id"
                :title="m.hint"
                style="font-size:12.5px;padding:5px 12px"
                @click="mode = m.id"
              >
                {{ m.label }}
              </button>
            </div>
            <span class="qt-hint" style="font-size:12px">
              {{ TRIM_MODES.find((m) => m.id === mode)?.hint }}
            </span>
          </label>

          <label v-if="mode === 'reencode'" class="qt-field">
            <span class="qt-label">{{ t(U + 'qualityLabel', { crf }) }}</span>
            <input
              v-model.number="crf"
              type="range"
              class="qt-range"
              :min="CRF_MIN"
              :max="CRF_MAX"
              step="1"
            />
          </label>

          <button
            class="qt-btn qt-btn--primary"
            style="align-self:flex-start"
            type="button"
            :disabled="busy"
            @click="trim"
          >
            <Loader2 v-if="busy" :size="14" class="qt-spin" />
            <Scissors v-else :size="14" />
            <span>{{ busy ? t(U + 'btnWorking') : t(U + 'btnTrim') }}</span>
          </button>
        </div>
      </template>

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
          <video :src="result.url" controls style="width:100%;max-height:320px;background:#000;border-radius:var(--qt-radius-sm)" />
          <div class="qt-row" style="--qt-row-gap:10px;align-items:baseline;font-size:13px">
            <span class="qt-label" style="flex:0 0 60px;font-size:12.5px">{{ t(U + 'lblFile') }}</span>
            <span style="color:var(--qt-text);word-break:break-all">{{ result.name }}</span>
          </div>
          <div class="qt-row" style="--qt-row-gap:10px;align-items:baseline;font-size:13px">
            <span class="qt-label" style="flex:0 0 60px;font-size:12.5px">{{ t(U + 'lblSize') }}</span>
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
