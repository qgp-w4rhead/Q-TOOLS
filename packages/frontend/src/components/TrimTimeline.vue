<script setup lang="ts">
/**
 * TrimTimeline - scrubbable timeline for picking a [start, end] range.
 *
 * Renders a track with a highlighted selection, two draggable handles,
 * an optional playhead (bound to a media element's `currentTime`), and a
 * tick ruler. Interactions:
 *  - drag a handle           → moves that bound (emits `seek` so the
 *                              parent can scrub the preview)
 *  - drag the selection body → moves the whole range, length preserved
 *  - click the track         → moves the nearest bound + seeks
 *  - Arrow keys on a handle  → nudge ±0.1s (Shift = ±1s), Home/End jump
 *
 * Pure presentational component - the parent owns the values via
 * `v-model:start` / `v-model:end`.
 */
import { computed, ref } from 'vue';
import { formatDuration } from '@/utils/media';
import { computeTicks } from '@/utils/timeline';

const props = withDefaults(
  defineProps<{
    /** Total media duration in seconds. */
    duration: number;
    /** Selection start in seconds (v-model). */
    start: number;
    /** Selection end in seconds (v-model). */
    end: number;
    /** Playhead position in seconds (e.g. video currentTime). */
    currentTime?: number;
    /** Disable all interaction. */
    disabled?: boolean;
  }>(),
  {
    currentTime: 0,
    disabled: false,
  },
);

const emit = defineEmits<{
  (e: 'update:start', sec: number): void;
  (e: 'update:end', sec: number): void;
  (e: 'seek', sec: number): void;
}>();

/** Smallest allowed gap between start and end. */
const MIN_GAP = 0.01;

const track = ref<HTMLElement | null>(null);
/** Which part is being dragged, if any. */
const dragging = ref<'start' | 'end' | 'range' | null>(null);
/** Grab offset inside the selection when dragging the range body. */
let rangeGrabOffset = 0;

const dur = computed(() => (Number.isFinite(props.duration) ? props.duration : 0));
const selStart = computed(() => clamp(props.start, 0, dur.value));
const selEnd = computed(() => clamp(props.end, 0, dur.value));

const startPct = computed(() => pct(selStart.value));
const endPct = computed(() => pct(selEnd.value));
const playheadPct = computed(() =>
  props.currentTime > 0 ? pct(clamp(props.currentTime, 0, dur.value)) : null,
);

const selectionLabel = computed(() => {
  if (!dur.value) return '';
  const sel = Math.max(0, selEnd.value - selStart.value);
  return `${formatDuration(selStart.value, true)} → ${formatDuration(selEnd.value, true)} · ${formatDuration(sel, true)} selected`;
});

/* ------------------------------- ticks --------------------------------- */

const ticks = computed(() => computeTicks(dur.value));

/* ------------------------------ helpers -------------------------------- */

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

function pct(sec: number): number {
  return dur.value > 0 ? clamp((sec / dur.value) * 100, 0, 100) : 0;
}

function timeAt(clientX: number): number {
  const el = track.value;
  if (!el || !dur.value) return 0;
  const rect = el.getBoundingClientRect();
  const ratio = clamp((clientX - rect.left) / rect.width, 0, 1);
  return ratio * dur.value;
}

function setStart(sec: number): void {
  emit('update:start', clamp(sec, 0, selEnd.value - MIN_GAP));
}

function setEnd(sec: number): void {
  emit('update:end', clamp(sec, selStart.value + MIN_GAP, dur.value));
}

/* --------------------------- pointer interaction ------------------------ */

function onTrackPointerDown(e: PointerEvent): void {
  if (props.disabled || !dur.value) return;
  const t = timeAt(e.clientX);
  if (t > selStart.value && t < selEnd.value) {
    // Grabbed inside the selection - drag the whole range.
    dragging.value = 'range';
    rangeGrabOffset = t - selStart.value;
  } else {
    // Move the nearest bound to the click point.
    const nearerStart = Math.abs(t - selStart.value) <= Math.abs(t - selEnd.value);
    dragging.value = nearerStart ? 'start' : 'end';
    if (nearerStart) setStart(t);
    else setEnd(t);
    emit('seek', t);
  }
  (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
}

function onHandlePointerDown(e: PointerEvent, which: 'start' | 'end'): void {
  if (props.disabled || !dur.value) return;
  e.stopPropagation();
  dragging.value = which;
  (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
}

function onPointerMove(e: PointerEvent): void {
  if (!dragging.value || props.disabled) return;
  const t = timeAt(e.clientX);
  if (dragging.value === 'start') {
    setStart(t);
    emit('seek', clamp(t, 0, dur.value));
  } else if (dragging.value === 'end') {
    setEnd(t);
    emit('seek', clamp(t, 0, dur.value));
  } else {
    const len = selEnd.value - selStart.value;
    const newStart = clamp(t - rangeGrabOffset, 0, dur.value - len);
    emit('update:start', newStart);
    emit('update:end', newStart + len);
    emit('seek', clamp(t, 0, dur.value));
  }
}

function onPointerUp(): void {
  dragging.value = null;
}

/* ------------------------------ keyboard -------------------------------- */

function onHandleKeydown(e: KeyboardEvent, which: 'start' | 'end'): void {
  if (props.disabled) return;
  const step = e.shiftKey ? 1 : 0.1;
  const cur = which === 'start' ? selStart.value : selEnd.value;
  let next: number | null = null;
  if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') next = cur - step;
  else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') next = cur + step;
  else if (e.key === 'Home') next = 0;
  else if (e.key === 'End') next = dur.value;
  if (next === null) return;
  e.preventDefault();
  if (which === 'start') setStart(next);
  else setEnd(next);
  emit('seek', clamp(next, 0, dur.value));
}
</script>

<template>
  <div class="ttl" :class="{ 'ttl--disabled': disabled }">
    <div
      ref="track"
      class="ttl__track"
      role="presentation"
      @pointerdown="onTrackPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
    >
      <div
        class="ttl__selection"
        :class="{ 'ttl__selection--drag': dragging === 'range' }"
        :style="{ left: `${startPct}%`, width: `${Math.max(0, endPct - startPct)}%` }"
      />
      <div
        v-if="playheadPct !== null"
        class="ttl__playhead"
        :style="{ left: `${playheadPct}%` }"
      />
      <div
        class="ttl__handle ttl__handle--start"
        :class="{ 'ttl__handle--active': dragging === 'start' }"
        :style="{ left: `${startPct}%` }"
        role="slider"
        tabindex="0"
        aria-label="Trim start"
        :aria-valuemin="0"
        :aria-valuemax="dur"
        :aria-valuenow="selStart"
        :aria-valuetext="formatDuration(selStart, true)"
        @pointerdown="onHandlePointerDown($event, 'start')"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointercancel="onPointerUp"
        @keydown="onHandleKeydown($event, 'start')"
      />
      <div
        class="ttl__handle ttl__handle--end"
        :class="{ 'ttl__handle--active': dragging === 'end' }"
        :style="{ left: `${endPct}%` }"
        role="slider"
        tabindex="0"
        aria-label="Trim end"
        :aria-valuemin="0"
        :aria-valuemax="dur"
        :aria-valuenow="selEnd"
        :aria-valuetext="formatDuration(selEnd, true)"
        @pointerdown="onHandlePointerDown($event, 'end')"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointercancel="onPointerUp"
        @keydown="onHandleKeydown($event, 'end')"
      />
    </div>
    <div class="ttl__ticks" aria-hidden="true">
      <span
        v-for="tick in ticks"
        :key="tick.t"
        class="ttl__tick"
        :style="{ left: `${tick.pct}%` }"
      >{{ tick.label }}</span>
    </div>
    <p v-if="selectionLabel" class="ttl__sel">{{ selectionLabel }}</p>
  </div>
</template>

<style scoped>
.ttl {
  display: flex;
  flex-direction: column;
  gap: 4px;
  user-select: none;
}
.ttl--disabled {
  opacity: 0.5;
  pointer-events: none;
}
.ttl__track {
  position: relative;
  height: 44px;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  cursor: crosshair;
  touch-action: none;
  overflow: hidden;
}
.ttl__selection {
  position: absolute;
  top: 0;
  bottom: 0;
  background: oklch(from var(--qt-accent) l c h / 0.22);
  border-top: 2px solid var(--qt-accent);
  border-bottom: 2px solid var(--qt-accent);
  cursor: grab;
}
.ttl__selection--drag {
  cursor: grabbing;
}
.ttl__playhead {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2px;
  margin-left: -1px;
  background: var(--qt-text);
  opacity: 0.75;
  pointer-events: none;
}
.ttl__handle {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 12px;
  margin-left: -6px;
  background: var(--qt-accent);
  border-radius: 3px;
  cursor: ew-resize;
  touch-action: none;
  z-index: 1;
}
.ttl__handle::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 2px;
  height: 16px;
  transform: translate(-50%, -50%);
  background: var(--qt-bg);
  border-radius: 1px;
  opacity: 0.8;
}
.ttl__handle:focus-visible {
  outline: 2px solid var(--qt-accent);
  outline-offset: 1px;
}
.ttl__handle--active {
  filter: brightness(1.15);
}
.ttl__ticks {
  position: relative;
  height: 14px;
  font-size: 10.5px;
  color: var(--qt-muted);
  font-variant-numeric: tabular-nums;
}
.ttl__tick {
  position: absolute;
  transform: translateX(-50%);
  white-space: nowrap;
}
.ttl__tick:first-child {
  transform: none;
}
.ttl__tick:last-child {
  transform: translateX(-100%);
}
.ttl__sel {
  margin: 0;
  font-size: 12px;
  color: var(--qt-muted);
  font-variant-numeric: tabular-nums;
}
</style>
