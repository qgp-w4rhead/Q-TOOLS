/**
 * useSecurityHeadersBuilder - composable + pure logic for building security
 * HTTP response headers: CSP, X-Frame-Options, HSTS, X-Content-Type-Options,
 * Referrer-Policy, Permissions-Policy, and more.
 *
 * No external dependencies - pure string building.
 */
import { ref, watch, type Ref } from 'vue';
import { useToolEmbed } from '@/composables/useToolEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Types - pure logic (no Vue dependency)                                      */
/* -------------------------------------------------------------------------- */

export interface SecurityHeadersConfig {
  // Content-Security-Policy
  cspEnabled: boolean;
  cspDefaultSrc: string;
  cspScriptSrc: string;
  cspStyleSrc: string;
  cspImgSrc: string;
  cspFontSrc: string;
  cspConnectSrc: string;
  cspFrameSrc: string;
  cspObjectSrc: string;
  cspMediaSrc: string;
  cspBaseUri: string;
  cspFormAction: string;
  cspFrameAncestors: string;
  cspUpgradeInsecure: boolean;
  cspReportOnly: boolean;
  cspReportUri: string;

  // Strict-Transport-Security (HSTS)
  hstsEnabled: boolean;
  hstsMaxAge: number;
  hstsIncludeSubdomains: boolean;
  hstsPreload: boolean;

  // X-Frame-Options
  xFrameOptionsEnabled: boolean;
  xFrameOptionsValue: 'DENY' | 'SAMEORIGIN' | 'ALLOW-FROM';

  // X-Content-Type-Options
  xContentTypeOptions: boolean;

  // Referrer-Policy
  referrerPolicyEnabled: boolean;
  referrerPolicyValue: string;

  // Permissions-Policy
  permissionsPolicyEnabled: boolean;
  permissionsPolicyValue: string;

  // X-XSS-Protection (legacy, but still useful)
  xXssProtection: boolean;

  // Cross-Origin headers
  coopEnabled: boolean;
  coepEnabled: boolean;
  corpEnabled: boolean;
  corpValue: string;
}

export interface SecurityHeader {
  name: string;
  value: string;
  description: string;
  enabled: boolean;
}

export interface UseSecurityHeadersBuilderReturn {
  config: Ref<SecurityHeadersConfig>;
  headers: Ref<SecurityHeader[]>;
  headerText: Ref<string>;
  nginxText: Ref<string>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  reset: () => void;
}

/* -------------------------------------------------------------------------- */
/* Constants                                                                   */
/* -------------------------------------------------------------------------- */

export const DEFAULT_CONFIG: SecurityHeadersConfig = {
  cspEnabled: true,
  cspDefaultSrc: "'self'",
  cspScriptSrc: "'self'",
  cspStyleSrc: "'self'",
  cspImgSrc: "'self' data: https:",
  cspFontSrc: "'self'",
  cspConnectSrc: "'self'",
  cspFrameSrc: "'none'",
  cspObjectSrc: "'none'",
  cspMediaSrc: "'self'",
  cspBaseUri: "'self'",
  cspFormAction: "'self'",
  cspFrameAncestors: "'none'",
  cspUpgradeInsecure: true,
  cspReportOnly: false,
  cspReportUri: '',

  hstsEnabled: true,
  hstsMaxAge: 31536000,
  hstsIncludeSubdomains: true,
  hstsPreload: false,

  xFrameOptionsEnabled: true,
  xFrameOptionsValue: 'DENY',

  xContentTypeOptions: true,

  referrerPolicyEnabled: true,
  referrerPolicyValue: 'strict-origin-when-cross-origin',

  permissionsPolicyEnabled: false,
  permissionsPolicyValue: "geolocation=(), microphone=(), camera=()",

  xXssProtection: false,

  coopEnabled: false,
  coepEnabled: false,
  corpEnabled: false,
  corpValue: 'same-origin',
};

export const REFERRER_POLICY_OPTIONS = [
  'no-referrer',
  'no-referrer-when-downgrade',
  'origin',
  'origin-when-cross-origin',
  'same-origin',
  'strict-origin',
  'strict-origin-when-cross-origin',
  'unsafe-url',
];

/* -------------------------------------------------------------------------- */
/* Pure logic - no Vue dependency below this point                             */
/* -------------------------------------------------------------------------- */

function buildCsp(c: SecurityHeadersConfig): string {
  const parts: string[] = [];
  if (c.cspDefaultSrc) parts.push(`default-src ${c.cspDefaultSrc}`);
  if (c.cspScriptSrc) parts.push(`script-src ${c.cspScriptSrc}`);
  if (c.cspStyleSrc) parts.push(`style-src ${c.cspStyleSrc}`);
  if (c.cspImgSrc) parts.push(`img-src ${c.cspImgSrc}`);
  if (c.cspFontSrc) parts.push(`font-src ${c.cspFontSrc}`);
  if (c.cspConnectSrc) parts.push(`connect-src ${c.cspConnectSrc}`);
  if (c.cspFrameSrc) parts.push(`frame-src ${c.cspFrameSrc}`);
  if (c.cspObjectSrc) parts.push(`object-src ${c.cspObjectSrc}`);
  if (c.cspMediaSrc) parts.push(`media-src ${c.cspMediaSrc}`);
  if (c.cspBaseUri) parts.push(`base-uri ${c.cspBaseUri}`);
  if (c.cspFormAction) parts.push(`form-action ${c.cspFormAction}`);
  if (c.cspFrameAncestors) parts.push(`frame-ancestors ${c.cspFrameAncestors}`);
  if (c.cspUpgradeInsecure) parts.push('upgrade-insecure-requests');
  if (c.cspReportUri) parts.push(`report-uri ${c.cspReportUri}`);
  return parts.join('; ');
}

function buildHsts(c: SecurityHeadersConfig): string {
  let val = `max-age=${c.hstsMaxAge}`;
  if (c.hstsIncludeSubdomains) val += '; includeSubDomains';
  if (c.hstsPreload) val += '; preload';
  return val;
}

function buildPermissionsPolicy(c: SecurityHeadersConfig): string {
  return c.permissionsPolicyValue;
}

export function buildHeaders(c: SecurityHeadersConfig): SecurityHeader[] {
  const headers: SecurityHeader[] = [];

  if (c.cspEnabled) {
    const cspValue = buildCsp(c);
    headers.push({
      name: c.cspReportOnly ? 'Content-Security-Policy-Report-Only' : 'Content-Security-Policy',
      value: cspValue,
      description: 'Controls resources the browser is allowed to load.',
      enabled: true,
    });
  }

  if (c.hstsEnabled) {
    headers.push({
      name: 'Strict-Transport-Security',
      value: buildHsts(c),
      description: 'Forces HTTPS connections for the specified duration.',
      enabled: true,
    });
  }

  if (c.xFrameOptionsEnabled) {
    let val: string = c.xFrameOptionsValue;
    if (c.xFrameOptionsValue === 'ALLOW-FROM') val = 'ALLOW-FROM https://example.com';
    headers.push({
      name: 'X-Frame-Options',
      value: val,
      description: 'Prevents clickjacking by controlling frame embedding.',
      enabled: true,
    });
  }

  if (c.xContentTypeOptions) {
    headers.push({
      name: 'X-Content-Type-Options',
      value: 'nosniff',
      description: 'Prevents MIME-type sniffing.',
      enabled: true,
    });
  }

  if (c.referrerPolicyEnabled) {
    headers.push({
      name: 'Referrer-Policy',
      value: c.referrerPolicyValue,
      description: 'Controls how much referrer info is included in requests.',
      enabled: true,
    });
  }

  if (c.permissionsPolicyEnabled) {
    headers.push({
      name: 'Permissions-Policy',
      value: buildPermissionsPolicy(c),
      description: 'Controls which browser features can be used.',
      enabled: true,
    });
  }

  if (c.xXssProtection) {
    headers.push({
      name: 'X-XSS-Protection',
      value: '1; mode=block',
      description: 'Legacy XSS auditor (largely superseded by CSP).',
      enabled: true,
    });
  }

  if (c.coopEnabled) {
    headers.push({
      name: 'Cross-Origin-Opener-Policy',
      value: 'same-origin',
      description: 'Isolates browsing context from cross-origin documents.',
      enabled: true,
    });
  }

  if (c.coepEnabled) {
    headers.push({
      name: 'Cross-Origin-Embedder-Policy',
      value: 'require-corp',
      description: 'Requires cross-origin resources to be CORP-valid.',
      enabled: true,
    });
  }

  if (c.corpEnabled) {
    headers.push({
      name: 'Cross-Origin-Resource-Policy',
      value: c.corpValue,
      description: 'Restricts which origins can embed resources.',
      enabled: true,
    });
  }

  return headers;
}

export function headersToText(headers: SecurityHeader[]): string {
  return headers.map((h) => `${h.name}: ${h.value}`).join('\n');
}

export function headersToNginx(headers: SecurityHeader[]): string {
  return headers
    .map((h) => `add_header ${h.name} "${h.value.replace(/"/g, '\\"')}" always;`)
    .join('\n');
}

/* -------------------------------------------------------------------------- */
/* Composable - reactive state + embed integration                             */
/* -------------------------------------------------------------------------- */

export function useSecurityHeadersBuilder(): UseSecurityHeadersBuilderReturn {
  const config = ref<SecurityHeadersConfig>({ ...DEFAULT_CONFIG });
  const headers = ref<SecurityHeader[]>([]);
  const headerText = ref<string>('');
  const nginxText = ref<string>('');

  function recompute(): void {
    headers.value = buildHeaders(config.value);
    headerText.value = headersToText(headers.value);
    nginxText.value = headersToNginx(headers.value);
  }

  function reset(): void {
    config.value = { ...DEFAULT_CONFIG };
    recompute();
  }

  watch(config, recompute, { deep: true });

  recompute();

  const { isEmbed, input: embedInput } = useToolEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.config === 'object' && p.config !== null) {
        config.value = { ...DEFAULT_CONFIG, ...(p.config as Partial<SecurityHeadersConfig>) };
      }
    },
    output: headerText,
    toOutput: () => ({
      headers: headers.value,
      headerText: headerText.value,
      nginxText: nginxText.value,
    }),
  });

  return {
    config,
    headers,
    headerText,
    nginxText,
    isEmbed,
    embedInput,
    reset,
  };
}
