/**
 * useDeviceInformation - composable + pure logic for the device information
 * tool.
 *
 * Snapshots the browser/device environment via the standard `navigator`,
 * `screen`, `window`, and `document` APIs and presents it as a structured
 * `DeviceInfo` object grouped by category (Browser, Screen, Viewport,
 * Hardware, Capabilities).
 *
 * The pure helper `collectDeviceInfo()` has no Vue dependency and can be
 * imported standalone for unit testing or reuse. The `useDeviceInformation()`
 * composable wraps it in reactive state, keeps the viewport + online status
 * live (resize + online/offline listeners), and wires up the embed
 * PostMessage protocol (sends an `output` snapshot whenever the info changes).
 *
 * No external dependencies - only native Web APIs.
 */
import { onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue';
import { useEmbed } from '@/composables/useEmbed';
import type { EmbedOutputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Pure logic - no Vue dependency below this point                             */
/* -------------------------------------------------------------------------- */

/** A single displayed key/value row. */
export interface InfoField {
  /** Stable machine key (used for copy + react keys). */
  key: string;
  /** Human-readable label shown in the UI. */
  label: string;
  /** Display value (always a string; `-` denotes "not available"). */
  value: string;
  /** `true` when the underlying API reported the value as unavailable. */
  unavailable: boolean;
}

/** A named group of fields (e.g. "Browser", "Screen"). */
export interface InfoGroup {
  id: string;
  label: string;
  fields: InfoField[];
}

/** Full device snapshot returned by `collectDeviceInfo()`. */
export interface DeviceInfo {
  groups: InfoGroup[];
  /** Flat `{ key: value }` map for embed output / copy-all. */
  map: Record<string, string>;
  /** ISO timestamp of when the snapshot was taken. */
  collectedAt: string;
}

/** Sentinel shown for unavailable values. */
export const UNAVAILABLE = '-';

/**
 * Format a maybe-undefined value as a display string.
 * `undefined` / `null` → `UNAVAILABLE`; everything else → `String(value)`.
 */
function fmt(value: unknown): { value: string; unavailable: boolean } {
  if (value === undefined || value === null) {
    return { value: UNAVAILABLE, unavailable: true };
  }
  if (typeof value === 'boolean') return { value: value ? 'Yes' : 'No', unavailable: false };
  if (Array.isArray(value)) {
    if (value.length === 0) return { value: UNAVAILABLE, unavailable: true };
    return { value: value.join(', '), unavailable: false };
  }
  const s = String(value);
  if (s.length === 0) return { value: UNAVAILABLE, unavailable: true };
  return { value: s, unavailable: false };
}

/** Build a single field, marking unavailable values. */
function field(key: string, label: string, raw: unknown): InfoField {
  const { value, unavailable } = fmt(raw);
  return { key, label, value, unavailable };
}

/**
 * Detect "touch support". A device is considered touch-capable when
 * `maxTouchPoints > 0`, or when the legacy `'ontouchstart' in window` is true,
 * or when the (deprecated) `navigator.maxTouchPoints` is undefined but the
 * CSS `pointer: coarse` media query matches.
 */
function detectTouch(): boolean {
  if (typeof navigator === 'undefined') return false;
  const nav = navigator as Navigator & { maxTouchPoints?: number };
  if (typeof nav.maxTouchPoints === 'number') return nav.maxTouchPoints > 0;
  if (typeof window !== 'undefined' && 'ontouchstart' in window) return true;
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    return window.matchMedia('(pointer: coarse)').matches;
  }
  return false;
}

/** Render the screen orientation as a human-readable string. */
function orientationLabel(screen: Screen | undefined, win: Window): string {
  const oriented =
    (screen?.orientation as { type?: string } | undefined) ??
    (win as unknown as { screen?: { orientation?: { type?: string } } }).screen?.orientation;
  if (oriented?.type) return oriented.type;
  // Legacy fallback: compare width vs height.
  if (screen && screen.width && screen.height) {
    return screen.width > screen.height ? 'landscape' : 'portrait';
  }
  return UNAVAILABLE;
}

/**
 * Snapshot the current device/browser environment into a `DeviceInfo`.
 *
 * Pure with respect to Vue - it only reads the global `navigator`, `screen`,
 * `window`, and `document` objects. Safe to call in any browser context.
 */
export function collectDeviceInfo(): DeviceInfo {
  const nav = navigator as Navigator & {
    deviceMemory?: number;
    userLanguage?: string;
    browserLanguage?: string;
    doNotTrack?: string;
    maxTouchPoints?: number;
    userAgentData?: { platform?: string };
    pdfViewerEnabled?: boolean;
    connection?: { effectiveType?: string; downlink?: number; rtt?: number; saveData?: boolean };
  };
  const screenObj: Screen | undefined =
    typeof screen !== 'undefined' ? screen : undefined;
  const win: Window = typeof window !== 'undefined' ? window : ({} as Window);
  const doc: Document | undefined =
    typeof document !== 'undefined' ? document : undefined;

  const language = nav.language || nav.userLanguage || nav.browserLanguage;
  const languages = nav.languages && nav.languages.length > 0 ? nav.languages : language;

  const groups: InfoGroup[] = [
    {
      id: 'browser',
      label: 'Browser',
      fields: [
        field('userAgent', 'User agent', nav.userAgent),
        field('platform', 'Platform', nav.userAgentData?.platform ?? nav.platform),
        field('vendor', 'Vendor', nav.vendor),
        field('language', 'Language', language),
        field('languages', 'Languages', languages),
        field('cookieEnabled', 'Cookies enabled', nav.cookieEnabled),
        field('doNotTrack', 'Do Not Track', nav.doNotTrack),
        field('pdfViewer', 'PDF viewer', nav.pdfViewerEnabled),
      ],
    },
    {
      id: 'screen',
      label: 'Screen',
      fields: [
        field('screenResolution', 'Screen resolution', screenObj ? `${screenObj.width} × ${screenObj.height}` : undefined),
        field('availableResolution', 'Available resolution', screenObj ? `${screenObj.availWidth} × ${screenObj.availHeight}` : undefined),
        field('colorDepth', 'Color depth', screenObj?.colorDepth != null ? `${screenObj.colorDepth}-bit` : undefined),
        field('pixelDepth', 'Pixel depth', screenObj?.pixelDepth != null ? `${screenObj.pixelDepth}-bit` : undefined),
        field('orientation', 'Orientation', orientationLabel(screenObj, win)),
      ],
    },
    {
      id: 'viewport',
      label: 'Viewport',
      fields: [
        field('viewport', 'Viewport size', win.innerWidth != null && win.innerHeight != null ? `${win.innerWidth} × ${win.innerHeight}` : undefined),
        field('documentSize', 'Document size', doc?.documentElement ? `${doc.documentElement.scrollWidth} × ${doc.documentElement.scrollHeight}` : undefined),
        field('pixelRatio', 'Device pixel ratio', win.devicePixelRatio ?? undefined),
        field('scrollPosition', 'Scroll position', win.scrollX != null && win.scrollY != null ? `${Math.round(win.scrollX)}, ${Math.round(win.scrollY)}` : undefined),
      ],
    },
    {
      id: 'hardware',
      label: 'Hardware',
      fields: [
        field('cpuCores', 'CPU cores', nav.hardwareConcurrency),
        field('deviceMemory', 'Device memory', nav.deviceMemory != null ? `${nav.deviceMemory} GB` : undefined),
        field('maxTouchPoints', 'Max touch points', nav.maxTouchPoints),
      ],
    },
    {
      id: 'capabilities',
      label: 'Capabilities',
      fields: [
        field('online', 'Online status', nav.onLine),
        field('touchSupport', 'Touch support', detectTouch()),
        field('serviceWorker', 'Service worker', 'serviceWorker' in nav),
        field('webgl', 'WebGL', (() => {
          if (!doc) return undefined;
          try {
            const canvas = doc.createElement('canvas');
            return !!(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
          } catch {
            return false;
          }
        })()),
        field('webAssembly', 'WebAssembly', typeof WebAssembly === 'object' && typeof WebAssembly.compile === 'function'),
        field('connectionType', 'Connection type', nav.connection?.effectiveType),
        field('downlink', 'Downlink', nav.connection?.downlink != null ? `${nav.connection.downlink} Mbps` : undefined),
        field('saveData', 'Save-Data', nav.connection?.saveData),
      ],
    },
  ];

  const map: Record<string, string> = {};
  for (const group of groups) {
    for (const f of group.fields) {
      map[f.key] = f.value;
    }
  }

  return { groups, map, collectedAt: new Date().toISOString() };
}

/* -------------------------------------------------------------------------- */
/* Composable - Vue reactive wrapper + embed wiring                            */
/* -------------------------------------------------------------------------- */

export interface UseDeviceInformationReturn {
  /** Reactive device snapshot. */
  info: Ref<DeviceInfo>;
  /** `true` while the snapshot is being (re)collected. */
  refreshing: Ref<boolean>;
  /** Re-snapshot the device environment. */
  refresh: () => void;
  /** Copy the entire snapshot as a `key: value` block. */
  copyAllText: () => string;
}

export function useDeviceInformation(): UseDeviceInformationReturn {
  const info = ref<DeviceInfo>(collectDeviceInfo());
  const refreshing = ref(false);

  const { sendOutput } = useEmbed({
    onInput: (payload) => {
      // The device-info tool has no user inputs to pre-fill, but it accepts
      // a `refresh: true` signal to re-snapshot on demand from the parent.
      if (payload && payload.refresh === true) refresh();
    },
  });

  function refresh(): void {
    refreshing.value = true;
    // Defer to the next microtask so the UI can show the refreshing state.
    queueMicrotask(() => {
      info.value = collectDeviceInfo();
      refreshing.value = false;
    });
  }

  function copyAllText(): string {
    const lines: string[] = [`# Device information - ${info.value.collectedAt}`];
    for (const group of info.value.groups) {
      lines.push('', `## ${group.label}`);
      for (const f of group.fields) {
        lines.push(`${f.label}: ${f.value}`);
      }
    }
    return lines.join('\n');
  }

  // Keep viewport + online status live.
  let resizeRaf = 0;
  function onResize(): void {
    if (resizeRaf) cancelAnimationFrame(resizeRaf);
    resizeRaf = requestAnimationFrame(() => {
      resizeRaf = 0;
      info.value = collectDeviceInfo();
    });
  }
  function onOnline(): void {
    info.value = collectDeviceInfo();
  }

  // Send an output snapshot to the parent whenever the info changes.
  watch(
    info,
    (snapshot) => {
      const output: EmbedOutputPayload = { ...snapshot.map };
      sendOutput(output);
    },
    { deep: true, immediate: true },
  );

  onMounted(() => {
    window.addEventListener('resize', onResize);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOnline);
    // Re-snapshot once on mount in case SSR/early-build values differed.
    info.value = collectDeviceInfo();
  });

  onBeforeUnmount(() => {
    if (resizeRaf) cancelAnimationFrame(resizeRaf);
    window.removeEventListener('resize', onResize);
    window.removeEventListener('online', onOnline);
    window.removeEventListener('offline', onOnline);
  });

  return { info, refreshing, refresh, copyAllText };
}
