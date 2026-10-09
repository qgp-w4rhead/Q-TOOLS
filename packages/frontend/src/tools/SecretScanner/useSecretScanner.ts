/**
 * useSecretScanner - composable + pure logic for the secret scanner tool.
 *
 * Scans pasted text/code for leaked credentials using a rule set of regular
 * expressions covering common token formats: AWS access keys, GitHub tokens,
 * Slack tokens, Stripe keys, Google API keys, Twilio, SendGrid, JWTs, generic
 * `api_key = "..."` assignments, and PEM private-key blocks.
 *
 * Matches are reported with the rule name, severity, line number, and a masked
 * preview (first/last few chars) so the real secret is never echoed back in
 * full. Everything runs locally - nothing leaves the browser.
 *
 * Pure helpers have no Vue dependency and can be imported standalone for
 * unit testing or reuse. The `useSecretScanner()` composable wraps them in
 * reactive state and wires up the embed PostMessage protocol.
 *
 * No external dependencies.
 */
import { ref, watch, type Ref } from 'vue';
import { useToolEmbed } from '@/composables/useToolEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Pure logic - no Vue dependency below this point                             */
/* -------------------------------------------------------------------------- */

/** Severity of a finding. */
export type Severity = 'critical' | 'high' | 'medium' | 'low';

/** A single detection rule. */
export interface SecretRule {
  /** Stable rule id. */
  id: string;
  /** Human-readable name. */
  name: string;
  /** Pattern with a global flag; the full match (or group 1) is the secret. */
  pattern: RegExp;
  severity: Severity;
  /** Short remediation hint. */
  hint: string;
  /** When true, group 1 is the secret rather than the full match. */
  useGroup?: number;
}

/**
 * The rule set. Patterns are deliberately conservative to limit false
 * positives - they target well-known token prefixes and formats.
 */
export const SECRET_RULES: SecretRule[] = [
  {
    id: 'aws-access-key',
    name: 'AWS Access Key ID',
    pattern: /\b(AKIA|ASIA|ABIA|ACCA)[0-9A-Z]{16}\b/g,
    severity: 'critical',
    hint: 'Rotate the key in IAM and move it to a secrets manager.',
  },
  {
    id: 'aws-secret-key',
    name: 'AWS Secret Access Key',
    pattern:
      /(?:aws_secret_access_key|secret_access_key|secretKey)\s*[:=]\s*["']?([0-9a-zA-Z/+]{40})["']?/gi,
    severity: 'critical',
    hint: 'Rotate the key pair in IAM immediately.',
    useGroup: 1,
  },
  {
    id: 'github-pat',
    name: 'GitHub Personal Access Token',
    pattern: /\b(ghp_[0-9a-zA-Z]{36,}|github_pat_[0-9a-zA-Z_]{22,})\b/g,
    severity: 'critical',
    hint: 'Revoke the token at github.com/settings/tokens.',
  },
  {
    id: 'github-oauth',
    name: 'GitHub OAuth / App Token',
    pattern: /\b(gho_[0-9a-zA-Z]{36,}|ghu_[0-9a-zA-Z]{36,}|ghs_[0-9a-zA-Z]{36,}|ghr_[0-9a-zA-Z]{36,})\b/g,
    severity: 'critical',
    hint: 'Revoke the token in GitHub settings.',
  },
  {
    id: 'slack-token',
    name: 'Slack Token',
    pattern: /\b(xox[baprs]-[0-9a-zA-Z-]{10,})\b/g,
    severity: 'critical',
    hint: 'Revoke the token at api.slack.com.',
  },
  {
    id: 'slack-webhook',
    name: 'Slack Webhook URL',
    pattern: /https:\/\/hooks\.slack\.com\/services\/T[0-9A-Z]+\/B[0-9A-Z]+\/[0-9a-zA-Z]+/g,
    severity: 'high',
    hint: 'Regenerate the webhook in the Slack app config.',
  },
  {
    id: 'stripe-secret',
    name: 'Stripe Secret Key',
    pattern: /\b(sk_live_[0-9a-zA-Z]{16,}|rk_live_[0-9a-zA-Z]{16,})\b/g,
    severity: 'critical',
    hint: 'Roll the key in the Stripe dashboard.',
  },
  {
    id: 'stripe-publishable',
    name: 'Stripe Publishable Key',
    pattern: /\b(pk_live_[0-9a-zA-Z]{16,})\b/g,
    severity: 'low',
    hint: 'Publishable keys are public by design - verify it is not a secret key.',
  },
  {
    id: 'google-api-key',
    name: 'Google API Key',
    pattern: /\b(AIza[0-9A-Za-z_-]{35})\b/g,
    severity: 'high',
    hint: 'Restrict and rotate the key in Google Cloud Console.',
  },
  {
    id: 'google-oauth-secret',
    name: 'Google OAuth Client Secret',
    pattern: /\b(GOCSPX-[0-9A-Za-z_-]{28,})\b/g,
    severity: 'critical',
    hint: 'Rotate the client secret in Google Cloud Console.',
  },
  {
    id: 'twilio-key',
    name: 'Twilio API Key',
    pattern: /\b(SK[0-9a-f]{32})\b/g,
    severity: 'high',
    hint: 'Revoke the key in the Twilio console.',
  },
  {
    id: 'sendgrid-key',
    name: 'SendGrid API Key',
    pattern: /\b(SG\.[0-9A-Za-z_-]{22}\.[0-9A-Za-z_-]{43})\b/g,
    severity: 'critical',
    hint: 'Revoke the key in SendGrid settings.',
  },
  {
    id: 'mailgun-key',
    name: 'Mailgun API Key',
    pattern: /\b(key-[0-9a-z]{32})\b/g,
    severity: 'high',
    hint: 'Rotate the key in the Mailgun dashboard.',
  },
  {
    id: 'jwt',
    name: 'JSON Web Token',
    pattern: /\b(eyJ[0-9A-Za-z_-]{10,}\.[0-9A-Za-z_-]{10,}\.[0-9A-Za-z_-]{10,})\b/g,
    severity: 'medium',
    hint: 'JWTs often carry session authority - treat as a live credential.',
  },
  {
    id: 'pem-private-key',
    name: 'Private Key Block',
    pattern:
      /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP |ENCRYPTED )?PRIVATE KEY(?: BLOCK)?-----[0-9a-zA-Z+/=\r\n]+-----END (?:RSA |EC |DSA |OPENSSH |PGP |ENCRYPTED )?PRIVATE KEY(?: BLOCK)?-----/g,
    severity: 'critical',
    hint: 'Never commit private keys - rotate and move to a secrets store.',
  },
  {
    id: 'generic-api-key',
    name: 'Generic API Key Assignment',
    pattern:
      /\b(?:api[_-]?key|api[_-]?secret|access[_-]?token|auth[_-]?token|client[_-]?secret|secret[_-]?key)\b\s*[:=]\s*["']([0-9a-zA-Z_\-+/=.]{16,})["']/gi,
    severity: 'high',
    hint: 'Move the value to an env var or secrets manager.',
    useGroup: 1,
  },
  {
    id: 'password-assignment',
    name: 'Hardcoded Password',
    pattern:
      /\b(?:password|passwd|pwd)\b\s*[:=]\s*["']([^"'\s]{8,})["']/gi,
    severity: 'high',
    hint: 'Never hardcode passwords - use env vars or a secrets manager.',
    useGroup: 1,
  },
  {
    id: 'bearer-token',
    name: 'Bearer Token',
    pattern: /\bBearer\s+([0-9a-zA-Z_\-.~+/]{20,}=*)/g,
    severity: 'high',
    hint: 'Bearer tokens grant full access - revoke and reissue.',
    useGroup: 1,
  },
  {
    id: 'ssh-connection-string',
    name: 'Connection String with Password',
    pattern:
      /\b(?:mongodb(?:\+srv)?|postgres(?:ql)?|mysql|redis|amqp):\/\/[^:\s/]+:[^@\s/]+@[^\s"']+/gi,
    severity: 'critical',
    hint: 'Credentials in a URI - rotate and inject via env vars.',
  },
];

/** A single scan finding. */
export interface SecretFinding {
  /** Rule id that produced the finding. */
  ruleId: string;
  /** Rule display name. */
  rule: string;
  severity: Severity;
  /** 1-based line number of the match. */
  line: number;
  /** 0-based character offset in the input. */
  index: number;
  /** Masked preview of the matched secret (never the full value). */
  masked: string;
  /** Remediation hint. */
  hint: string;
}

/**
 * Mask a secret for display: keep the first `head` and last `tail` chars,
 * replacing the middle with a fixed ellipsis. Short secrets are fully masked.
 */
export function maskSecret(secret: string, head = 6, tail = 4): string {
  const s = secret.trim();
  if (s.length <= head + tail + 3) return '•'.repeat(Math.min(s.length, 12));
  return `${s.slice(0, head)}…${s.slice(-tail)}`;
}

/** Compute the 1-based line number for a character offset in `text`. */
export function lineNumberAt(text: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index && i < text.length; i++) {
    if (text.charCodeAt(i) === 10) line++;
  }
  return line;
}

/**
 * Scan `text` with all rules and return findings sorted by line number.
 * Overlapping matches from different rules are all reported.
 */
export function scanSecrets(text: string): SecretFinding[] {
  const findings: SecretFinding[] = [];
  if (!text) return findings;
  for (const rule of SECRET_RULES) {
    // Reset lastIndex - the patterns are global and shared.
    rule.pattern.lastIndex = 0;
    let m: RegExpExecArray | null;
    let guard = 0;
    while ((m = rule.pattern.exec(text)) !== null && guard++ < 10000) {
      const secret = rule.useGroup ? (m[rule.useGroup] ?? m[0]) : m[0];
      const index = rule.useGroup
        ? m.index + m[0].indexOf(secret)
        : m.index;
      findings.push({
        ruleId: rule.id,
        rule: rule.name,
        severity: rule.severity,
        line: lineNumberAt(text, index),
        index,
        masked: maskSecret(secret),
        hint: rule.hint,
      });
      // Avoid zero-width infinite loops.
      if (m.index === rule.pattern.lastIndex) rule.pattern.lastIndex++;
    }
  }
  findings.sort((a, b) => a.index - b.index);
  return findings;
}

/** Severity rank for sorting/badges (lower = worse). */
export const SEVERITY_ORDER: Record<Severity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

/** Count findings per severity. */
export function countBySeverity(
  findings: SecretFinding[],
): Record<Severity, number> {
  const counts: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const f of findings) counts[f.severity]++;
  return counts;
}

/* -------------------------------------------------------------------------- */
/* Composable - reactive state + embed integration                             */
/* -------------------------------------------------------------------------- */

export interface UseSecretScannerReturn {
  input: Ref<string>;
  findings: Ref<SecretFinding[]>;
  counts: Ref<Record<Severity, number>>;
  scanned: Ref<boolean>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  clear: () => void;
}

export function useSecretScanner(): UseSecretScannerReturn {
  const input = ref<string>('');
  const findings = ref<SecretFinding[]>([]);
  const counts = ref<Record<Severity, number>>({
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  });
  const scanned = ref<boolean>(false);

  function recompute(): void {
    if (input.value.trim().length === 0) {
      findings.value = [];
      counts.value = { critical: 0, high: 0, medium: 0, low: 0 };
      scanned.value = false;
      return;
    }
    findings.value = scanSecrets(input.value);
    counts.value = countBySeverity(findings.value);
    scanned.value = true;
  }

  function clear(): void {
    input.value = '';
  }

  watch(input, recompute, { immediate: true });

  const { isEmbed, input: embedInput } = useToolEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.input === 'string') input.value = p.input;
      else if (typeof p.text === 'string') input.value = p.text;
      else if (typeof p.code === 'string') input.value = p.code;
    },
    output: findings,
    toOutput: () => ({
      count: findings.value.length,
      critical: counts.value.critical,
      high: counts.value.high,
      medium: counts.value.medium,
      low: counts.value.low,
      findings: findings.value.map((x) => ({
        rule: x.rule,
        severity: x.severity,
        line: x.line,
        masked: x.masked,
      })),
    }),
  });

  return {
    input,
    findings,
    counts,
    scanned,
    isEmbed,
    embedInput,
    clear,
  };
}
