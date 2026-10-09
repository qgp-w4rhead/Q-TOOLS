/**
 * useSecurityTxtGenerator - composable + pure logic for the security.txt
 * generator tool.
 *
 * Builds an RFC 9116 `security.txt` file (published at
 * `/.well-known/security.txt`) from a form. `Contact` and `Expires` are
 * required by the spec; the rest are optional. Multiple values for repeatable
 * fields (Contact, Encryption, Acknowledgments, Canonical, Policy, Hiring)
 * are entered one per line.
 *
 * Pure helpers have no Vue dependency and can be imported standalone for
 * unit testing or reuse. The `useSecurityTxtGenerator()` composable wraps them
 * in reactive state and wires up the embed PostMessage protocol.
 *
 * No external dependencies.
 */
import { ref, watch, type Ref } from 'vue';
import { useToolEmbed } from '@/composables/useToolEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Pure logic - no Vue dependency below this point                             */
/* -------------------------------------------------------------------------- */

export interface SecurityTxtConfig {
  /** Contact URIs/emails, one per line (required, repeatable). */
  contact: string;
  /** Expiry as an ISO 8601 datetime (required). */
  expires: string;
  /** Encryption key URIs, one per line (repeatable). */
  encryption: string;
  /** Acknowledgments page URIs, one per line (repeatable). */
  acknowledgments: string;
  /** Preferred languages, comma-separated (e.g. `en, de`). */
  preferredLanguages: string;
  /** Canonical URIs of this file, one per line (repeatable). */
  canonical: string;
  /** Security policy URIs, one per line (repeatable). */
  policy: string;
  /** Hiring page URIs, one per line (repeatable). */
  hiring: string;
  /** CSAF provider metadata URIs, one per line (repeatable). */
  csaf: string;
}

/** Default expiry: one year from now. */
export function defaultExpires(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

export function defaultConfig(): SecurityTxtConfig {
  return {
    contact: '',
    expires: defaultExpires(),
    encryption: '',
    acknowledgments: '',
    preferredLanguages: '',
    canonical: '',
    policy: '',
    hiring: '',
    csaf: '',
  };
}

/** Split a textarea value into trimmed non-empty lines. */
export function lines(value: string): string[] {
  return value
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

export interface SecurityTxtIssue {
  level: 'error' | 'warning';
  message: string;
}

/**
 * Build the `security.txt` file content. Fields are emitted in RFC 9116
 * order; repeatable fields emit one line per value.
 */
export function buildSecurityTxt(c: SecurityTxtConfig): string {
  const out: string[] = [];
  for (const v of lines(c.contact)) out.push(`Contact: ${v}`);
  if (c.expires.trim()) out.push(`Expires: ${c.expires.trim()}`);
  for (const v of lines(c.encryption)) out.push(`Encryption: ${v}`);
  for (const v of lines(c.acknowledgments)) out.push(`Acknowledgments: ${v}`);
  if (c.preferredLanguages.trim()) {
    out.push(`Preferred-Languages: ${c.preferredLanguages.trim()}`);
  }
  for (const v of lines(c.canonical)) out.push(`Canonical: ${v}`);
  for (const v of lines(c.policy)) out.push(`Policy: ${v}`);
  for (const v of lines(c.hiring)) out.push(`Hiring: ${v}`);
  for (const v of lines(c.csaf)) out.push(`CSAF: ${v}`);
  return out.join('\n') + (out.length ? '\n' : '');
}

/** Validate the config per RFC 9116. Returns issues (empty = valid). */
export function validateSecurityTxt(c: SecurityTxtConfig): SecurityTxtIssue[] {
  const issues: SecurityTxtIssue[] = [];
  if (lines(c.contact).length === 0) {
    issues.push({ level: 'error', message: 'Contact is required (at least one).' });
  }
  if (!c.expires.trim()) {
    issues.push({ level: 'error', message: 'Expires is required.' });
  } else {
    const t = Date.parse(c.expires.trim());
    if (Number.isNaN(t)) {
      issues.push({ level: 'error', message: 'Expires must be a valid ISO 8601 datetime.' });
    } else if (t <= Date.now()) {
      issues.push({ level: 'warning', message: 'Expires is in the past - pick a future date.' });
    }
  }
  for (const v of lines(c.contact)) {
    if (!/^(mailto:|tel:|https?:\/\/)/i.test(v)) {
      issues.push({
        level: 'warning',
        message: `Contact "${v}" should be a mailto:, tel:, or https: URI.`,
      });
    }
  }
  for (const v of lines(c.canonical)) {
    if (!/^https:\/\//i.test(v)) {
      issues.push({
        level: 'warning',
        message: `Canonical "${v}" should be an https: URI.`,
      });
    }
  }
  return issues;
}

/* -------------------------------------------------------------------------- */
/* Composable - reactive state + embed integration                             */
/* -------------------------------------------------------------------------- */

export interface UseSecurityTxtGeneratorReturn {
  config: Ref<SecurityTxtConfig>;
  output: Ref<string>;
  issues: Ref<SecurityTxtIssue[]>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  reset: () => void;
}

export function useSecurityTxtGenerator(): UseSecurityTxtGeneratorReturn {
  const config = ref<SecurityTxtConfig>(defaultConfig());
  const output = ref<string>('');
  const issues = ref<SecurityTxtIssue[]>([]);

  function recompute(): void {
    output.value = buildSecurityTxt(config.value);
    issues.value = validateSecurityTxt(config.value);
  }

  function reset(): void {
    config.value = defaultConfig();
  }

  watch(config, recompute, { deep: true, immediate: true });

  const { isEmbed, input: embedInput } = useToolEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.config === 'object' && p.config !== null) {
        config.value = { ...defaultConfig(), ...(p.config as Partial<SecurityTxtConfig>) };
      }
      if (typeof p.contact === 'string') config.value.contact = p.contact;
      if (typeof p.expires === 'string') config.value.expires = p.expires;
    },
    output,
    toOutput: () => ({
      content: output.value,
      valid: !issues.value.some((i) => i.level === 'error'),
      issues: issues.value.map((i) => `${i.level}: ${i.message}`),
    }),
  });

  return { config, output, issues, isEmbed, embedInput, reset };
}
