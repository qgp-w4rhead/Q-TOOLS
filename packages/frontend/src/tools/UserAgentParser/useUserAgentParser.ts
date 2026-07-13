/**
 * useUserAgentParser — composable + pure logic for the user-agent parser tool.
 *
 * Parses a User-Agent string into structured fields: browser (name + version),
 * engine (name + version), OS (name + version), device (type + vendor + model),
 * and CPU architecture. The `ua-parser-js` package (v2) is dynamically imported
 * inside `ensureUaParserModule()` so Vite emits it as a separate chunk
 * (lazy-loaded only when the tool is opened).
 *
 * Pure helpers (`ensureUaParserModule`, `parseUserAgent`, `getCurrentUserAgent`,
 * `resultToText`) have no Vue dependency and can be imported standalone for
 * unit testing or reuse. The `useUserAgentParser()` composable wraps them in
 * reactive state, auto-fills the input from `navigator.userAgent` on mount, and
 * wires up the embed PostMessage protocol.
 *
 * Auto-fill uses only the native `navigator.userAgent` API — no external
 * dependency is required for that step.
 */
import { ref, watch, type Ref } from 'vue';
import { useEmbed } from '@/composables/useEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Pure logic — no Vue dependency below this point                             */
/* -------------------------------------------------------------------------- */

/** Cached `ua-parser-js` module (resolved on first use). */
let cachedUaParserModule: typeof import('ua-parser-js') | null = null;

/**
 * Resolve and cache the `ua-parser-js` module (async). Safe to call repeatedly.
 * The dynamic import ensures Vite code-splits the dependency into its own chunk.
 */
export async function ensureUaParserModule(): Promise<typeof import('ua-parser-js')> {
  if (!cachedUaParserModule) {
    cachedUaParserModule = await import('ua-parser-js');
  }
  return cachedUaParserModule;
}

/** A single labelled field in the parsed result grid. */
export interface UaField {
  /** Stable key for v-for / equality checks. */
  key: string;
  /** Human-readable label. */
  label: string;
  /** Field value (empty string when unknown). */
  value: string;
  /** `true` when the parser could not detect a value. */
  unavailable: boolean;
}

/** A labelled group of fields (Browser, Engine, OS, Device, CPU). */
export interface UaFieldGroup {
  /** Stable group id. */
  id: string;
  /** Human-readable group label. */
  label: string;
  /** Fields in display order. */
  fields: UaField[];
}

/** Structured result of `parseUserAgent`. */
export interface UaParseResult {
  /** Original UA string (trimmed). */
  raw: string;
  /** Field groups for display. */
  groups: UaFieldGroup[];
  /** Flat key/value map of the canonical fields (for embed output + copy). */
  fields: {
    browser: string;
    browserVersion: string;
    engine: string;
    engineVersion: string;
    os: string;
    osVersion: string;
    deviceType: string;
    deviceVendor: string;
    deviceModel: string;
    cpuArchitecture: string;
  };
}

/** Sentinel for "not detected" — rendered as `—` in the UI. */
const UNAVAILABLE = '';

/** Coerce a possibly-undefined parser value to a string (`''` when absent). */
function str(value: string | undefined | null): string {
  if (value === undefined || value === null) return UNAVAILABLE;
  return String(value);
}

/**
 * Parse a User-Agent string into a structured `UaParseResult`.
 *
 * Returns `null` for an empty/whitespace-only input. Throws if the
 * `ua-parser-js` module cannot be loaded. Unknown fields are reported as
 * unavailable (empty string) rather than dropped, so the UI can render a
 * placeholder.
 */
export async function parseUserAgent(userAgent: string): Promise<UaParseResult | null> {
  const trimmed = userAgent.trim();
  if (trimmed.length === 0) return null;

  const UAParser = await ensureUaParserModule();
  const parser = new UAParser.UAParser(trimmed);
  const result = parser.getResult();

  const browser = result.browser;
  const engine = result.engine;
  const os = result.os;
  const device = result.device;
  const cpu = result.cpu;

  const browserName = str(browser?.name);
  const browserVersion = str(browser?.version);
  const engineName = str(engine?.name);
  const engineVersion = str(engine?.version);
  const osName = str(os?.name);
  const osVersion = str(os?.version);
  const deviceType = str(device?.type);
  const deviceVendor = str(device?.vendor);
  const deviceModel = str(device?.model);
  const cpuArchitecture = str(cpu?.architecture);

  const fields: UaParseResult['fields'] = {
    browser: browserName,
    browserVersion,
    engine: engineName,
    engineVersion,
    os: osName,
    osVersion,
    deviceType,
    deviceVendor,
    deviceModel,
    cpuArchitecture,
  };

  const groups: UaFieldGroup[] = [
    {
      id: 'browser',
      label: 'Browser',
      fields: [
        { key: 'browser-name', label: 'Name', value: browserName, unavailable: !browserName },
        { key: 'browser-version', label: 'Version', value: browserVersion, unavailable: !browserVersion },
      ],
    },
    {
      id: 'engine',
      label: 'Engine',
      fields: [
        { key: 'engine-name', label: 'Name', value: engineName, unavailable: !engineName },
        { key: 'engine-version', label: 'Version', value: engineVersion, unavailable: !engineVersion },
      ],
    },
    {
      id: 'os',
      label: 'Operating system',
      fields: [
        { key: 'os-name', label: 'Name', value: osName, unavailable: !osName },
        { key: 'os-version', label: 'Version', value: osVersion, unavailable: !osVersion },
      ],
    },
    {
      id: 'device',
      label: 'Device',
      fields: [
        { key: 'device-type', label: 'Type', value: deviceType, unavailable: !deviceType },
        { key: 'device-vendor', label: 'Vendor', value: deviceVendor, unavailable: !deviceVendor },
        { key: 'device-model', label: 'Model', value: deviceModel, unavailable: !deviceModel },
      ],
    },
    {
      id: 'cpu',
      label: 'CPU',
      fields: [
        {
          key: 'cpu-architecture',
          label: 'Architecture',
          value: cpuArchitecture,
          unavailable: !cpuArchitecture,
        },
      ],
    },
  ];

  return { raw: trimmed, groups, fields };
}

/**
 * Read the current browser's User-Agent string. Returns an empty string when
 * `navigator` is unavailable (e.g. SSR / non-browser env). No external
 * dependency — pure `navigator.userAgent` access.
 */
export function getCurrentUserAgent(): string {
  try {
    if (typeof navigator === 'undefined') return '';
    return navigator.userAgent ?? '';
  } catch {
    return '';
  }
}

/**
 * Render a `UaParseResult` as a plain-text key/value block for clipboard copy.
 * Unavailable fields are rendered as `—`.
 */
export function resultToText(result: UaParseResult): string {
  const lines: string[] = [`User-Agent: ${result.raw}`, ''];
  for (const group of result.groups) {
    lines.push(`# ${group.label}`);
    for (const f of group.fields) {
      lines.push(`${f.label}: ${f.value || '—'}`);
    }
    lines.push('');
  }
  return lines.join('\n').trimEnd();
}

/* -------------------------------------------------------------------------- */
/* Composable — reactive state + embed integration                            */
/* -------------------------------------------------------------------------- */

export interface UseUserAgentParserReturn {
  /** The UA string being parsed. */
  userAgent: Ref<string>;
  /** The latest parse result (null while loading / empty input). */
  result: Ref<UaParseResult | null>;
  /** `true` while the parser module / parse is in flight. */
  loading: Ref<boolean>;
  /** Error message if parsing failed (module load or otherwise). */
  error: Ref<string | null>;
  /** Whether the tool is running inside an iframe (embed mode). */
  isEmbed: Ref<boolean>;
  /** Latest input payload received from the parent (embed mode). */
  embedInput: Ref<EmbedInputPayload | null>;
  /** Re-parse the current `userAgent` value. */
  recompute: () => void;
  /** Replace `userAgent` with `navigator.userAgent`. */
  useMyUa: () => void;
}

export function useUserAgentParser(): UseUserAgentParserReturn {
  const userAgent = ref<string>('');
  const result = ref<UaParseResult | null>(null);
  const loading = ref<boolean>(false);
  const error = ref<string | null>(null);

  let parseToken = 0;

  async function recompute(): Promise<void> {
    const trimmed = userAgent.value.trim();
    if (trimmed.length === 0) {
      result.value = null;
      error.value = null;
      loading.value = false;
      return;
    }
    const token = ++parseToken;
    loading.value = true;
    error.value = null;
    try {
      const parsed = await parseUserAgent(userAgent.value);
      if (token !== parseToken) return; // a newer parse superseded us
      result.value = parsed;
    } catch (err) {
      if (token !== parseToken) return;
      result.value = null;
      error.value = (err as Error).message || 'Failed to parse user-agent string';
    } finally {
      if (token === parseToken) loading.value = false;
    }
  }

  function useMyUa(): void {
    userAgent.value = getCurrentUserAgent();
  }

  // Auto-fill from navigator.userAgent on first run (no external dep).
  if (!userAgent.value) {
    const current = getCurrentUserAgent();
    if (current) userAgent.value = current;
  }

  watch(userAgent, () => void recompute(), { immediate: true });

  const { isEmbed, input: embedInput, sendOutput } = useEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.userAgent === 'string') userAgent.value = p.userAgent;
      else if (typeof p.ua === 'string') userAgent.value = p.ua;
      else if (typeof p.value === 'string') userAgent.value = p.value;
    },
  });

  watch([result, error, loading], () => {
    if (!isEmbed.value) return;
    if (loading.value) {
      sendOutput({ loading: true });
      return;
    }
    if (error.value) {
      sendOutput({ error: error.value });
      return;
    }
    if (result.value) {
      sendOutput({ ...result.value.fields, userAgent: result.value.raw });
    } else {
      sendOutput({});
    }
  });

  return {
    userAgent,
    result,
    loading,
    error,
    isEmbed,
    embedInput,
    recompute: () => void recompute(),
    useMyUa,
  };
}
