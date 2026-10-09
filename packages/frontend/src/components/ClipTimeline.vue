<script setup lang="ts">
/**
 * ClipTimeline - multi-clip timeline for positioning copies of an audio
 * track against the video's timeline.
 *
 * Renders a track on the same 0→`duration` scale as TrimTimeline, with a
 * draggable clip block per entry in `offsets` (seconds on the video
 * timeline). Clips may extend past either edge (negative offset = audio
 * starts before the video; past the end = audio outlives it) - overflow
 * is clipped visually and indicated by a dashed edge. With `loop` each
 * clip repeats to the end of the timeline (striped fill + repeat icon).
 * Interactions:
 *  - drag a clip    → moves that copy (emits `seek` so the parent can
 *                     scrub the preview to the drag position)
 *  - click track    → seeks the playhead only
 *  - Arrow keys     → nudge ±0.1s (Shift = ±1s), Home/End jump to edges
 *  - Delete/Backspace on a clip → removes that copy
 *
 * Pure presentational component - the parent owns `v-model:offsets`.
 */
import { computed, ref } from 'vue';
import { Repeat } from 'lucide-vue-next';
import { formatDuration } from '@/utils/media';
import { computeTicks } from '@/utils/timeline';

const props = withDefaults(
  defineProps<{
    /** Video timeline duration in seconds. */
    duration: number;
    /** Audio clip duration in seconds (0 = unknown, clip fills to the end). */
    clipDuration?: number;
    /** Clip start positions on the video timeline in seconds (v-model). */
    offsets: number[];
    /** Repeat each clip until the end of the timeline. */
    loop?: boolean;
    /** Playhead position in seconds (e.g. video currentTime). */
    currentTime?: number;
    /** Disable all interaction. */
    disabled?: boolean;
  }>(),
  {
    clipDuration: 0,
    loop: false,
    currentTime: 0,
    disabled: false,
  },
);

const emit = defineEmits<{
  (e: 'update:offsets', secs: number[]): void;
  (e: 'remove-clip', index: number): void;
  (e: 'seek', sec: number): void;
}>();

/** Minimum audible overlap (seconds) a clip must keep with the video. */
const MIN_OVERLAP = 0.05;

const track = ref<HTMLElement | null>(null);
/** Index of the clip currently being dragged (-1 = none). */
const dragIdx = ref<number>(-1);
/** Pointer grab point inside the clip, in seconds. */
let grabOffset = 0;

const dur = computed(() => (Number.isFinite(props.duration) ? props.duration : 0));
/** Effective clip length used for layout/clamping (falls back to video length). */
const clipLen = computed(() =>
  props.clipDuration > 0 ? props.clipDuration : dur.value,
);

const minOffset = computed(() => -(clipLen.value - MIN_OVERLAP));
const maxOffset = computed(() => Math.max(0, dur.value - MIN_OVERLAP));

interface ClipGeom {
  left: number;
  width: number;
  ofLeft: boolean;
  ofRight: boolean;
}

/** Layout for one clip: a looping clip always extends to the end. */
function clipGeom(offset: number): ClipGeom {
  const startPct = pct(offset);
  const endPct = props.loop ? 100 : pct(offset + clipLen.value);
  const left = Math.max(0, startPct);
  return {
    left,
    width: Math.max(0, Math.min(100, endPct) - left),
    ofLeft: startPct < 0,
    ofRight: !props.loop && endPct > 100,
  };
}

const playheadPct = computed(() =>
  props.currentTime > 0
    ? pct(Math.min(dur.value, Math.max(0, props.currentTime)))
    : null,
);

const ticks = computed(() => computeTicks(dur.value));

function signed(sec: number): string {
  const sign = sec < -0.0005 ? '-' : sec > 0.0005 ? '+' : '±';
  return `${sign}${formatDuration(Math.abs(sec), true)}`;
}

function clipLabel(offset: number): string {
  const len =
    props.clipDuration > 0 ? formatDuration(props.clipDuration, true) : '?';
  return `Audio ${signed(offset)} · clip ${len}${props.loop ? ' · loop' : ''}`;
}

const offsetsLabel = computed(() => {
  if (!dur.value || !props.offsets.length) return '';
  const pos = props.offsets.map(signed).join(', ');
  const n = props.offsets.length;
  return `${n > 1 ? `${n} clips · ` : ''}${pos}${props.loop ? ' · loop' : ''}`;
});

/* ------------------------------ helpers -------------------------------- */

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

function pct(sec: number): number {
  return dur.value > 0 ? clamp((sec / dur.value) * 100, -100, 200) : 0;
}

function timeAt(clientX: number): number {
  const el = track.value;
  if (!el || !dur.value) return 0;
  const rect = el.getBoundingClientRect();
  return clamp((clientX - rect.left) / rect.width, 0, 1) * dur.value;
}

function setOffsetAt(index: number, sec: number): void {
  const next = props.offsets.slice();
  next[index] = clamp(sec, minOffset.value, maxOffset.value);
  emit('update:offsets', next);
}

/* --------------------------- pointer interaction ------------------------ */

function onClipPointerDown(e: PointerEvent, index: number): void {
  if (props.disabled || !dur.value) return;
  e.stopPropagation();
  dragIdx.value = index;
  grabOffset = timeAt(e.clientX) - (props.offsets[index] ?? 0);
  (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
}

function onTrackPointerDown(e: PointerEvent): void {
  if (props.disabled || !dur.value) return;
  emit('seek', timeAt(e.clientX));
}

function onPointerMove(e: PointerEvent): void {
  if (dragIdx.value < 0 || props.disabled) return;
  const t = timeAt(e.clientX);
  setOffsetAt(dragIdx.value, t - grabOffset);
  emit('seek', t);
}

function onPointerUp(): void {
  dragIdx.value = -1;
}

/* ------------------------------ keyboard -------------------------------- */

function onClipKeydown(e: KeyboardEvent, index: number): void {
  if (props.disabled) return;
  if (e.key === 'Delete' || e.key === 'Backspace') {
    e.preventDefault();
    emit('remove-clip', index);
    return;
  }
  const step = e.shiftKey ? 1 : 0.1;
  const cur = props.offsets[index] ?? 0;
  let next: number | null = null;
  if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') next = cur - step;
  else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') next = cur + step;
  else if (e.key === 'Home') next = minOffset.value;
  else if (e.key === 'End') next = maxOffset.value;
  if (next === null) return;
  e.preventDefault();
  setOffsetAt(index, next);
  emit('seek', clamp(next, 0, dur.value));
}
</script>

<template>
  <div class="ctl" :class="{ 'ctl--disabled': disabled }">
    <div
      ref="track"
      class="ctl__track"
      role="presentation"
      @pointerdown="onTrackPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
    >
      <div
        v-for="(o, i) in offsets"
        :key="i"
        class="ctl__clip"
        :class="{
          'ctl__clip--drag': dragIdx === i,
          'ctl__clip--of-left': clipGeom(o).ofLeft,
          'ctl__clip--of-right': clipGeom(o).ofRight,
          'ctl__clip--loop': loop,
        }"
        :style="{
          left: `${clipGeom(o).left}%`,
          width: `${clipGeom(o).width}%`,
        }"
        role="slider"
        tabindex="0"
        :aria-label="`Audio clip ${i + 1} position`"
        :aria-valuemin="minOffset"
        :aria-valuemax="maxOffset"
        :aria-valuenow="o"
        :aria-valuetext="clipLabel(o)"
        title="Drag to position the audio - Delete to remove"
        @pointerdown="onClipPointerDown($event, i)"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointercancel="onPointerUp"
        @keydown="onClipKeydown($event, i)"
      >
        <Repeat
          v-if="loop && clipGeom(o).width > 8"
          :size="12"
          class="ctl__clip-icon"
        />
      </div>
      <div
        v-if="playheadPct !== null"
        class="ctl__playhead"
        :style="{ left: `${playheadPct}%` }"
      />
    </div>
    <div class="ctl__ticks" aria-hidden="true">
      <span
        v-for="tick in ticks"
        :key="tick.t"
        class="ctl__tick"
        :style="{ left: `${tick.pct}%` }"
      >{{ tick.label }}</span>
    </div>
    <p v-if="offsetsLabel" class="ctl__sel">{{ offsetsLabel }}</p>
  </div>
</template>

<style scoped>
.ctl {
  display: flex;
  flex-direction: column;
  gap: 4px;
  user-select: none;
}
.ctl--disabled {
  opacity: 0.5;
  pointer-events: none;
}
.ctl__track {
  position: relative;
  height: 32px;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  cursor: crosshair;
  touch-action: none;
  overflow: hidden;
}
.ctl__clip {
  position: absolute;
  top: 4px;
  bottom: 4px;
  min-width: 8px;
  background: oklch(from var(--qt-accent) l c h / 0.35);
  border: 1.5px solid var(--qt-accent);
  border-radius: 4px;
  cursor: grab;
  touch-action: none;
  z-index: 1;
}
.ctl__clip--drag {
  cursor: grabbing;
  filter: brightness(1.15);
}
.ctl__clip--of-left {
  border-left-style: dashed;
  border-top-left-radius: 0;
  border-bottom-left-radius: 0;
}
.ctl__clip--of-right {
  border-right-style: dashed;
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
}
.ctl__clip--loop {
  background: repeating-linear-gradient(
    -45deg,
    oklch(from var(--qt-accent) l c h / 0.35) 0 8px,
    oklch(from var(--qt-accent) l c h / 0.18) 8px 16px
  );
}
.ctl__clip-icon {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: var(--qt-accent);
  pointer-events: none;
}
.ctl__clip:focus-visible {
  outline: 2px solid var(--qt-accent);
  outline-offset: 1px;
}
.ctl__playhead {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2px;
  margin-left: -1px;
  background: var(--qt-text);
  opacity: 0.75;
  pointer-events: none;
  z-index: 2;
}
.ctl__ticks {
  position: relative;
  height: 14px;
  font-size: 10.5px;
  color: var(--qt-muted);
  font-variant-numeric: tabular-nums;
}
.ctl__tick {
  position: absolute;
  transform: translateX(-50%);
  white-space: nowrap;
}
.ctl__tick:first-child {
  transform: none;
}
.ctl__tick:last-child {
  transform: translateX(-100%);
}
.ctl__sel {
  margin: 0;
  font-size: 12px;
  color: var(--qt-muted);
  font-variant-numeric: tabular-nums;
}
</style>
