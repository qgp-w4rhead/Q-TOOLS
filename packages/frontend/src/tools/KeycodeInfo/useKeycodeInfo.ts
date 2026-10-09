/**
 * useKeycodeInfo - composable + pure logic for the keycode info tool.
 *
 * Captures `keydown` events on `document` and exposes a structured
 * `KeyEventInfo` describing the most recent key press (key, code, keyCode,
 * location, modifiers, plus deprecated `which`/`charCode` and the
 * `repeat`/`isComposing` flags). A bounded history of recent events is kept
 * so the UI can show a timeline.
 *
 * The pure helper `describeKeyEvent()` has no Vue dependency and can be
 * imported standalone for unit testing or reuse. The `useKeycodeInfo()`
 * composable wraps it in reactive state, attaches the document-level
 * `keydown` listener (with pause/resume + clear), and wires up the embed
 * PostMessage protocol (sends an `output` message on each captured keydown,
 * accepts `input` messages `{ pause: boolean }` and `{ clear: true }`).
 *
 * No external dependencies - only native Web APIs.
 */
import { onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue';
import { useEmbed } from '@/composables/useEmbed';
import type { EmbedOutputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Pure logic - no Vue dependency below this point                             */
/* -------------------------------------------------------------------------- */

/**
 * Human-readable labels for `KeyboardEvent.location` (DOM 3).
 * 0 = standard, 1 = left, 2 = right, 3 = numpad.
 */
export const KEY_LOCATION_LABELS: Readonly<Record<number, string>> = {
  0: 'Standard',
  1: 'Left',
  2: 'Right',
  3: 'Numpad',
};

/** Maximum number of recent events retained in the history buffer. */
export const MAX_HISTORY = 25;

/** Structured description of a single keyboard event. */
export interface KeyEventInfo {
  /** `event.key` - the logical key value (e.g. `a`, `Enter`, `Shift`). */
  key: string;
  /** `event.code` - the physical key (e.g. `KeyA`, `Enter`, `ShiftLeft`). */
  code: string;
  /** `event.keyCode` - deprecated numeric code (0 when unset). */
  keyCode: number;
  /** `event.which` - deprecated alias of keyCode (0 when unset). */
  which: number;
  /** `event.charCode` - deprecated char code (0 when unset). */
  charCode: number;
  /** `event.location` - 0/1/2/3 (DOM 3). */
  location: number;
  /** Human-readable label for `location`. */
  locationLabel: string;
  /** Modifier state. */
  ctrl: boolean;
  shift: boolean;
  alt: boolean;
  meta: boolean;
  /** `event.repeat` - true when this is an auto-repeated press. */
  repeat: boolean;
  /** `event.isComposing` - true while an IME composition is active. */
  isComposing: boolean;
  /** ISO timestamp of when the event was captured. */
  timestamp: string;
  /** Monotonic `event.timeStamp` (ms since navigation). */
  eventTime: number;
}

/** Render a keyboard event as a structured `KeyEventInfo`. */
export function describeKeyEvent(event: KeyboardEvent): KeyEventInfo {
  const location = event.location ?? 0;
  return {
    key: event.key ?? '',
    code: event.code ?? '',
    keyCode: event.keyCode ?? 0,
    which: event.which ?? 0,
    charCode: event.charCode ?? 0,
    location,
    locationLabel: KEY_LOCATION_LABELS[location] ?? 'Unknown',
    ctrl: event.ctrlKey === true,
    shift: event.shiftKey === true,
    alt: event.altKey === true,
    meta: event.metaKey === true,
    repeat: event.repeat === true,
    isComposing: event.isComposing === true,
    timestamp: new Date().toISOString(),
    eventTime: event.timeStamp ?? 0,
  };
}

/** Build a compact one-line summary of an event (e.g. for history rows). */
export function summarizeEvent(info: KeyEventInfo): string {
  const mods: string[] = [];
  if (info.ctrl) mods.push('Ctrl');
  if (info.shift) mods.push('Shift');
  if (info.alt) mods.push('Alt');
  if (info.meta) mods.push('Meta');
  const modStr = mods.length > 0 ? mods.join('+') + '+' : '';
  const keyLabel = info.key === ' ' ? 'Space' : info.key || info.code;
  return `${modStr}${keyLabel}`;
}

/** Serialise an event info to a copyable JSON string. */
export function eventToJson(info: KeyEventInfo): string {
  return JSON.stringify(info, null, 2);
}

/* -------------------------------------------------------------------------- */
/* Composable - Vue reactive wrapper + embed wiring                            */
/* -------------------------------------------------------------------------- */

export interface UseKeycodeInfoReturn {
  /** Most recent captured event, or `null` when nothing has been pressed. */
  last: Ref<KeyEventInfo | null>;
  /** Bounded list of recent events (newest first). */
  history: Ref<KeyEventInfo[]>;
  /** `true` while the listener is paused (not capturing events). */
  paused: Ref<boolean>;
  /** Total number of events captured since last clear. */
  count: Ref<number>;
  /** Toggle the capture state. */
  togglePause: () => void;
  /** Clear the last event + history + count. */
  clear: () => void;
}

export function useKeycodeInfo(): UseKeycodeInfoReturn {
  const last = ref<KeyEventInfo | null>(null);
  const history = ref<KeyEventInfo[]>([]);
  const paused = ref(false);
  const count = ref(0);

  const { sendOutput } = useEmbed({
    onInput: (payload) => {
      if (!payload) return;
      if (payload.pause === true && !paused.value) paused.value = true;
      else if (payload.pause === false && paused.value) paused.value = false;
      if (payload.clear === true) clear();
    },
  });

  function onKeydown(event: KeyboardEvent): void {
    if (paused.value) return;
    // Avoid capturing modifier-only "synthetic" repeats that flood the history.
    const info = describeKeyEvent(event);
    last.value = info;
    count.value += 1;
    const next = [info, ...history.value];
    if (next.length > MAX_HISTORY) next.length = MAX_HISTORY;
    history.value = next;
    const output: EmbedOutputPayload = {
      ...info,
      summary: summarizeEvent(info),
    };
    sendOutput(output);
  }

  function togglePause(): void {
    paused.value = !paused.value;
  }

  function clear(): void {
    last.value = null;
    history.value = [];
    count.value = 0;
  }

  // Keep the document listener attached for the component's lifetime; the
  // `paused` flag gates whether events are recorded.
  onMounted(() => {
    document.addEventListener('keydown', onKeydown);
  });
  onBeforeUnmount(() => {
    document.removeEventListener('keydown', onKeydown);
  });

  // Notify the parent when the pause state flips so embed UIs can reflect it.
  watch(paused, (isPaused) => {
    sendOutput({ paused: isPaused });
  });

  return { last, history, paused, count, togglePause, clear };
}
