/**
 * useBrowserLeakDemo - composable + pure logic for the browser leak demo tool.
 *
 * Shows what a website can learn about the visitor without any permission
 * prompt: user-agent, platform, languages, screen/viewport geometry, timezone,
 * hardware hints (cores, memory, touch), cookies/DoNotTrack, a canvas
 * fingerprint hash, and local IP addresses via WebRTC ICE candidates (no
 * permission needed - mDNS obfuscation permitting).
 *
 * A rough "fingerprint entropy" estimate sums the bits contributed by each
 * signal so users can see how uniquely identifiable they are.
 *
 * Pure helpers have no Vue dependency and can be imported standalone for
 * unit testing or reuse. The `useBrowserLeakDemo()` composable wraps them in
 * reactive state and wires up the embed PostMessage protocol.
 *
 * No external dependencies - navigator/screen/Intl/RTCPeerConnection/canvas.
 */
import { computed, onBeforeUnmount, onMounted, ref, type Ref } from 'vue';
import { useToolEmbed } from '@/composables/useToolEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Pure logic - no Vue dependency below this point                             */
/* -------------------------------------------------------------------------- */

/** A single leaked attribute. */
export interface LeakItem {
  label: string;
  value: string;
  /** Rough entropy contribution in bits (information-theoretic estimate). */
  bits: number;
}

/** A named group of leak items. */
export interface LeakGroup {
  title: string;
  items: LeakItem[];
}

/**
 * Collect the synchronous fingerprint signals (everything except WebRTC IPs,
 * which are async). Safe to call in any environment - missing APIs render as
 * `-` with 0 bits.
 */
export function collectLeaks(): LeakGroup[] {
  const nav = typeof navigator !== 'undefined' ? navigator : ({} as Navigator);
  const scr = typeof screen !== 'undefined' ? screen : ({} as Screen);
  const win = typeof window !== 'undefined' ? window : ({} as Window);

  const str = (v: unknown): string =>
    v === undefined || v === null || v === '' ? '-' : String(v);

  const groups: LeakGroup[] = [
    {
      title: 'Identity',
      items: [
        { label: 'User-Agent', value: str(nav.userAgent), bits: 10 },
        { label: 'Platform', value: str(nav.platform), bits: 3 },
        { label: 'Language', value: str(nav.language), bits: 4 },
        {
          label: 'Languages',
          value: Array.isArray(nav.languages) ? nav.languages.join(', ') : '-',
          bits: 4,
        },
        { label: 'Cookies enabled', value: str(nav.cookieEnabled), bits: 0.5 },
        {
          label: 'Do Not Track',
          value: str((nav as Navigator & { doNotTrack?: string }).doNotTrack),
          bits: 1,
        },
        {
          label: 'Timezone',
          value:
            typeof Intl !== 'undefined'
              ? Intl.DateTimeFormat().resolvedOptions().timeZone
              : '-',
          bits: 6,
        },
      ],
    },
    {
      title: 'Screen & viewport',
      items: [
        {
          label: 'Screen',
          value: scr.width ? `${scr.width}×${scr.height}` : '-',
          bits: 5,
        },
        {
          label: 'Available screen',
          value: scr.availWidth ? `${scr.availWidth}×${scr.availHeight}` : '-',
          bits: 3,
        },
        { label: 'Color depth', value: scr.colorDepth ? `${scr.colorDepth}-bit` : '-', bits: 2 },
        {
          label: 'Pixel ratio',
          value: win.devicePixelRatio ? `${win.devicePixelRatio}×` : '-',
          bits: 2,
        },
        {
          label: 'Viewport',
          value: win.innerWidth ? `${win.innerWidth}×${win.innerHeight}` : '-',
          bits: 4,
        },
      ],
    },
    {
      title: 'Hardware',
      items: [
        { label: 'CPU cores', value: str(nav.hardwareConcurrency), bits: 3 },
        {
          label: 'Device memory (GB)',
          value: str((nav as Navigator & { deviceMemory?: number }).deviceMemory),
          bits: 2,
        },
        { label: 'Max touch points', value: str(nav.maxTouchPoints), bits: 2 },
        {
          label: 'Touch support',
          value:
            typeof window !== 'undefined'
              ? 'ontouchstart' in window || nav.maxTouchPoints > 0
                ? 'yes'
                : 'no'
              : '-',
          bits: 1,
        },
      ],
    },
    {
      title: 'Fingerprint',
      items: [{ label: 'Canvas hash', value: canvasFingerprint(), bits: 8 }],
    },
  ];
  return groups;
}

/**
 * Render a fixed string to an offscreen canvas and hash the resulting pixels.
 * Subtle GPU/driver/font differences make this a stable per-device signal.
 * Returns a short hex hash, or `-` when canvas is unavailable.
 */
export function canvasFingerprint(): string {
  try {
    if (typeof document === 'undefined') return '-';
    const canvas = document.createElement('canvas');
    canvas.width = 220;
    canvas.height = 30;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '-';
    ctx.textBaseline = 'top';
    ctx.font = "14px 'Arial'";
    ctx.fillStyle = '#f60';
    ctx.fillRect(0, 0, 220, 30);
    ctx.fillStyle = '#069';
    ctx.fillText('Q-Tools fingerprint 🎯', 4, 6);
    const data = canvas.toDataURL();
    // FNV-1a 32-bit hash of the data URL.
    let h = 0x811c9dc5;
    for (let i = 0; i < data.length; i++) {
      h ^= data.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return (h >>> 0).toString(16).padStart(8, '0');
  } catch {
    return '-';
  }
}

/**
 * Gather local IP addresses via WebRTC ICE candidates. Creates a throwaway
 * `RTCPeerConnection` with a data channel, collects `candidate` strings for
 * `timeoutMs`, then resolves with the deduped host addresses found. Modern
 * browsers often return mDNS `.local` names instead of real IPs - those are
 * reported too. Resolves to an empty array when WebRTC is unavailable or
 * yields nothing.
 */
export function gatherWebRtcIps(timeoutMs = 1500): Promise<string[]> {
  return new Promise((resolve) => {
    if (typeof RTCPeerConnection === 'undefined') {
      resolve([]);
      return;
    }
    const ips = new Set<string>();
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      try {
        pc.close();
      } catch {
        /* noop */
      }
      resolve([...ips]);
    };
    const pc = new RTCPeerConnection({ iceServers: [] });
    const timer = setTimeout(finish, timeoutMs);
    pc.onicecandidate = (e) => {
      if (!e.candidate) {
        clearTimeout(timer);
        finish();
        return;
      }
      // candidate string: "candidate:... <ip> <port> typ host ..."
      const cand = e.candidate.candidate;
      const parts = cand.split(' ');
      const addr = parts[4];
      if (addr && !addr.includes(':')) {
        // IPv4 or mDNS .local
        ips.add(addr);
      }
    };
    try {
      pc.createDataChannel('x');
      void pc.createOffer().then((o) => pc.setLocalDescription(o));
    } catch {
      clearTimeout(timer);
      finish();
    }
  });
}

/** Total fingerprint entropy estimate (sum of item bits). */
export function totalBits(groups: LeakGroup[]): number {
  let sum = 0;
  for (const g of groups) for (const i of g.items) sum += i.bits;
  return sum;
}

/** Rough "1 in N" uniqueness estimate from total bits. */
export function uniquenessEstimate(bits: number): string {
  if (bits <= 0) return '-';
  const n = Math.pow(2, bits);
  if (n >= 1e9) return `~1 in ${(n / 1e9).toFixed(1)} billion`;
  if (n >= 1e6) return `~1 in ${(n / 1e6).toFixed(1)} million`;
  if (n >= 1e3) return `~1 in ${(n / 1e3).toFixed(1)}k`;
  return `~1 in ${Math.round(n)}`;
}

/* -------------------------------------------------------------------------- */
/* Composable - reactive state + embed integration                             */
/* -------------------------------------------------------------------------- */

export interface UseBrowserLeakDemoReturn {
  groups: Ref<LeakGroup[]>;
  webrtcIps: Ref<string[]>;
  webrtcDone: Ref<boolean>;
  bits: Ref<number>;
  uniqueness: Ref<string>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  refresh: () => void;
}

export function useBrowserLeakDemo(): UseBrowserLeakDemoReturn {
  const groups = ref<LeakGroup[]>([]);
  const webrtcIps = ref<string[]>([]);
  const webrtcDone = ref<boolean>(false);
  const bits = ref<number>(0);
  const uniqueness = ref<string>('-');

  let pcTimer: ReturnType<typeof setTimeout> | undefined;

  function refresh(): void {
    groups.value = collectLeaks();
    bits.value = totalBits(groups.value);
    uniqueness.value = uniquenessEstimate(bits.value);
    webrtcIps.value = [];
    webrtcDone.value = false;
    void gatherWebRtcIps().then((ips) => {
      webrtcIps.value = ips;
      webrtcDone.value = true;
    });
  }

  onMounted(refresh);
  onBeforeUnmount(() => {
    if (pcTimer) clearTimeout(pcTimer);
  });

  const snapshot = computed(() => {
    const flat: Record<string, string> = {};
    for (const g of groups.value) {
      for (const i of g.items) flat[i.label] = i.value;
    }
    return {
      bits: Math.round(bits.value * 10) / 10,
      uniqueness: uniqueness.value,
      webrtcIps: webrtcIps.value,
      fields: flat,
    };
  });

  const { isEmbed, input: embedInput } = useToolEmbed({
    onInput: (payload) => {
      if (payload && typeof payload === 'object') {
        const p = payload as Record<string, unknown>;
        if (p.action === 'refresh') refresh();
      }
    },
    output: snapshot,
    toOutput: () => snapshot.value,
  });

  return {
    groups,
    webrtcIps,
    webrtcDone,
    bits,
    uniqueness,
    isEmbed,
    embedInput,
    refresh,
  };
}
