/**
 * usePermissionsPolicyBuilder - composable + pure logic for the
 * Permissions-Policy header builder tool.
 *
 * Builds a `Permissions-Policy` HTTP response header from a per-feature form.
 * Each feature gets an allowlist: `*` (all origins), `()` (none), `self`
 * (this origin), or `self` plus specific origins (`self "https://a.com"`).
 * Extends `security-headers-builder`, which only exposes a raw text field.
 *
 * Pure helpers have no Vue dependency and can be imported standalone for
 * unit testing or reuse. The `usePermissionsPolicyBuilder()` composable wraps
 * them in reactive state and wires up the embed PostMessage protocol.
 *
 * No external dependencies.
 */
import { ref, watch, type Ref } from 'vue';
import { useToolEmbed } from '@/composables/useToolEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Pure logic - no Vue dependency below this point                             */
/* -------------------------------------------------------------------------- */

/** Allowlist mode for a single feature. */
export type AllowlistMode = 'all' | 'none' | 'self' | 'custom';

/** A single feature's policy. */
export interface FeaturePolicy {
  /** Directive name, e.g. `camera`. */
  feature: string;
  /** Allowlist mode. */
  mode: AllowlistMode;
  /** Extra origins for `custom` mode (space-separated). */
  origins: string;
  /** Whether to emit this directive at all. */
  enabled: boolean;
}

/** A well-known Permissions-Policy feature with a sane default. */
export interface FeatureDef {
  feature: string;
  /** Human label. */
  label: string;
  /** Default mode when enabled. */
  defaultMode: AllowlistMode;
  /** Whether the feature is enabled by default. */
  defaultEnabled: boolean;
}

/**
 * The feature list shown in the form. Defaults reflect a privacy-conscious
 * baseline: sensitive features off, common ones self-only.
 */
export const FEATURES: FeatureDef[] = [
  { feature: 'accelerometer', label: 'Accelerometer', defaultMode: 'none', defaultEnabled: false },
  { feature: 'ambient-light-sensor', label: 'Ambient light sensor', defaultMode: 'none', defaultEnabled: false },
  { feature: 'autoplay', label: 'Autoplay', defaultMode: 'self', defaultEnabled: false },
  { feature: 'battery', label: 'Battery', defaultMode: 'none', defaultEnabled: false },
  { feature: 'bluetooth', label: 'Bluetooth', defaultMode: 'none', defaultEnabled: false },
  { feature: 'camera', label: 'Camera', defaultMode: 'none', defaultEnabled: true },
  { feature: 'clipboard-read', label: 'Clipboard read', defaultMode: 'none', defaultEnabled: false },
  { feature: 'clipboard-write', label: 'Clipboard write', defaultMode: 'self', defaultEnabled: false },
  { feature: 'display-capture', label: 'Display capture', defaultMode: 'none', defaultEnabled: true },
  { feature: 'encrypted-media', label: 'Encrypted media (EME)', defaultMode: 'self', defaultEnabled: false },
  { feature: 'fullscreen', label: 'Fullscreen', defaultMode: 'self', defaultEnabled: true },
  { feature: 'gamepad', label: 'Gamepad', defaultMode: 'none', defaultEnabled: false },
  { feature: 'geolocation', label: 'Geolocation', defaultMode: 'none', defaultEnabled: true },
  { feature: 'gyroscope', label: 'Gyroscope', defaultMode: 'none', defaultEnabled: false },
  { feature: 'hid', label: 'WebHID', defaultMode: 'none', defaultEnabled: false },
  { feature: 'idle-detection', label: 'Idle detection', defaultMode: 'none', defaultEnabled: false },
  { feature: 'interest-cohort', label: 'FLoC / Topics', defaultMode: 'none', defaultEnabled: true },
  { feature: 'magnetometer', label: 'Magnetometer', defaultMode: 'none', defaultEnabled: false },
  { feature: 'microphone', label: 'Microphone', defaultMode: 'none', defaultEnabled: true },
  { feature: 'midi', label: 'WebMIDI', defaultMode: 'none', defaultEnabled: false },
  { feature: 'payment', label: 'Payment request', defaultMode: 'none', defaultEnabled: false },
  { feature: 'picture-in-picture', label: 'Picture-in-picture', defaultMode: 'self', defaultEnabled: false },
  { feature: 'publickey-credentials-create', label: 'WebAuthn create', defaultMode: 'self', defaultEnabled: false },
  { feature: 'publickey-credentials-get', label: 'WebAuthn get', defaultMode: 'self', defaultEnabled: false },
  { feature: 'screen-wake-lock', label: 'Screen wake lock', defaultMode: 'none', defaultEnabled: false },
  { feature: 'serial', label: 'Web Serial', defaultMode: 'none', defaultEnabled: false },
  { feature: 'usb', label: 'WebUSB', defaultMode: 'none', defaultEnabled: false },
  { feature: 'web-share', label: 'Web Share', defaultMode: 'self', defaultEnabled: false },
  { feature: 'xr-spatial-tracking', label: 'WebXR', defaultMode: 'none', defaultEnabled: false },
];

/** Build the allowlist value for one feature. */
export function buildAllowlist(p: FeaturePolicy): string {
  switch (p.mode) {
    case 'all':
      return '*';
    case 'none':
      return '()';
    case 'self':
      return 'self';
    case 'custom': {
      const origins = p.origins
        .split(/\s+/)
        .map((o) => o.trim())
        .filter(Boolean)
        .map((o) => `"${o}"`);
      return ['self', ...origins].join(' ');
    }
  }
}

/** Build the full `Permissions-Policy` header value from the policies. */
export function buildHeader(policies: FeaturePolicy[]): string {
  return policies
    .filter((p) => p.enabled)
    .map((p) => `${p.feature}=(${buildAllowlist(p)})`)
    .join(', ')
    // `*` must not be wrapped in parens per spec.
    .replace(/=\(\*\)/g, '=*');
}

/** Build an nginx `add_header` line. */
export function headerToNginx(header: string): string {
  return header
    ? `add_header Permissions-Policy "${header.replace(/"/g, '\\"')}" always;`
    : '';
}

/** Build an Apache `Header set` line. */
export function headerToApache(header: string): string {
  return header
    ? `Header always set Permissions-Policy "${header.replace(/"/g, '\\"')}"`
    : '';
}

/** Default policies from the FEATURES table. */
export function defaultPolicies(): FeaturePolicy[] {
  return FEATURES.map((f) => ({
    feature: f.feature,
    mode: f.defaultMode,
    origins: '',
    enabled: f.defaultEnabled,
  }));
}

/* -------------------------------------------------------------------------- */
/* Composable - reactive state + embed integration                             */
/* -------------------------------------------------------------------------- */

export interface UsePermissionsPolicyBuilderReturn {
  policies: Ref<FeaturePolicy[]>;
  header: Ref<string>;
  nginx: Ref<string>;
  apache: Ref<string>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  reset: () => void;
  setMode: (feature: string, mode: AllowlistMode) => void;
  setOrigins: (feature: string, origins: string) => void;
  toggle: (feature: string) => void;
}

export function usePermissionsPolicyBuilder(): UsePermissionsPolicyBuilderReturn {
  const policies = ref<FeaturePolicy[]>(defaultPolicies());
  const header = ref<string>('');
  const nginx = ref<string>('');
  const apache = ref<string>('');

  function recompute(): void {
    header.value = buildHeader(policies.value);
    nginx.value = headerToNginx(header.value);
    apache.value = headerToApache(header.value);
  }

  function reset(): void {
    policies.value = defaultPolicies();
  }

  function setMode(feature: string, mode: AllowlistMode): void {
    const p = policies.value.find((x) => x.feature === feature);
    if (p) p.mode = mode;
  }
  function setOrigins(feature: string, origins: string): void {
    const p = policies.value.find((x) => x.feature === feature);
    if (p) p.origins = origins;
  }
  function toggle(feature: string): void {
    const p = policies.value.find((x) => x.feature === feature);
    if (p) p.enabled = !p.enabled;
  }

  watch(policies, recompute, { deep: true, immediate: true });

  const { isEmbed, input: embedInput } = useToolEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (Array.isArray(p.policies)) {
        for (const incoming of p.policies as Array<Record<string, unknown>>) {
          const feat = typeof incoming.feature === 'string' ? incoming.feature : '';
          const target = policies.value.find((x) => x.feature === feat);
          if (!target) continue;
          if (typeof incoming.enabled === 'boolean') target.enabled = incoming.enabled;
          if (
            typeof incoming.mode === 'string' &&
            ['all', 'none', 'self', 'custom'].includes(incoming.mode)
          ) {
            target.mode = incoming.mode as AllowlistMode;
          }
          if (typeof incoming.origins === 'string') target.origins = incoming.origins;
        }
      }
    },
    output: header,
    toOutput: () => ({
      header: header.value,
      nginx: nginx.value,
      apache: apache.value,
    }),
  });

  return {
    policies,
    header,
    nginx,
    apache,
    isEmbed,
    embedInput,
    reset,
    setMode,
    setOrigins,
    toggle,
  };
}
