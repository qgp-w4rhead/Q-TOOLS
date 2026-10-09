/**
 * useEmailHeaderAnalyzer - composable + pure logic for the email header
 * analyzer tool.
 *
 * Parses a raw RFC 5322 header block: unfolds continuation lines, walks the
 * `Received` chain (top-to-bottom = newest-to-oldest hop), extracts
 * from/by/with/timestamp per hop, computes per-hop delivery delays, and reads
 * SPF/DKIM/DMARC verdicts from `Authentication-Results` (plus the legacy
 * `Received-SPF` header). Common identity headers (From/To/Subject/Date/
 * Message-ID/Return-Path) are surfaced for context.
 *
 * Pure helpers have no Vue dependency and can be imported standalone for
 * unit testing or reuse. The `useEmailHeaderAnalyzer()` composable wraps them
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

/** A parsed header field (name lowercased for lookup). */
export interface HeaderField {
  name: string;
  /** Original-case name as written. */
  rawName: string;
  value: string;
}

/**
 * Unfold a raw header block into discrete fields. Continuation lines (those
 * starting with space/tab) are joined onto the previous field with a single
 * space. Returns an empty array for empty input.
 */
export function parseHeaderFields(raw: string): HeaderField[] {
  const fields: HeaderField[] = [];
  const lines = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  for (const line of lines) {
    if (line.trim() === '') continue;
    if (/^[ \t]/.test(line) && fields.length > 0) {
      // Continuation - fold onto the previous field.
      fields[fields.length - 1]!.value += ' ' + line.trim();
      continue;
    }
    const colon = line.indexOf(':');
    if (colon < 0) continue; // not a header line - skip
    const rawName = line.slice(0, colon).trim();
    fields.push({
      name: rawName.toLowerCase(),
      rawName,
      value: line.slice(colon + 1).trim(),
    });
  }
  return fields;
}

/** Get all values for a header name (case-insensitive). */
export function getAll(fields: HeaderField[], name: string): string[] {
  const n = name.toLowerCase();
  return fields.filter((f) => f.name === n).map((f) => f.value);
}

/** Get the first value for a header name, or empty string. */
export function getFirst(fields: HeaderField[], name: string): string {
  return getAll(fields, name)[0] ?? '';
}

/** A single hop in the Received chain. */
export interface ReceivedHop {
  /** Hop index in delivery order (0 = first/oldest hop). */
  hop: number;
  /** `from` clause (sending host). */
  from: string;
  /** `by` clause (receiving host). */
  by: string;
  /** `with` clause (protocol, e.g. ESMTPS). */
  with: string;
  /** `id` clause, if present. */
  id: string;
  /** Parsed timestamp (ms since epoch) or null when unparseable. */
  timestamp: number | null;
  /** Raw timestamp string. */
  rawDate: string;
  /** Delay in seconds since the previous hop, or null for the first hop. */
  delaySeconds: number | null;
  /** The raw Received header value. */
  raw: string;
}

/**
 * Parse a single `Received` header value into its clauses. Received headers
 * look like:
 *   `from mail.example.com (mail.example.com [1.2.3.4]) by mx.dest.com with
 *    ESMTPS id abc123; Thu, 1 Jan 2026 00:00:00 +0000`
 * The date follows the last `;`.
 */
export function parseReceived(value: string): Omit<ReceivedHop, 'hop' | 'delaySeconds'> {
  const semi = value.lastIndexOf(';');
  const clausePart = semi >= 0 ? value.slice(0, semi) : value;
  const rawDate = semi >= 0 ? value.slice(semi + 1).trim() : '';
  const grab = (key: string): string => {
    const re = new RegExp(`\\b${key}\\s+(.+?)(?=\\s+(?:from|by|with|id|for|via)\\b|$)`, 'i');
    const m = re.exec(clausePart);
    return m ? m[1]!.trim() : '';
  };
  const ts = rawDate ? Date.parse(rawDate) : NaN;
  return {
    from: grab('from'),
    by: grab('by'),
    with: grab('with'),
    id: grab('id'),
    timestamp: Number.isNaN(ts) ? null : ts,
    rawDate,
    raw: value,
  };
}

/**
 * Parse the full `Received` chain. Header order is newest-first (each server
 * prepends), so the array is reversed to give delivery order (oldest first)
 * and per-hop delays are computed between consecutive hops.
 */
export function parseReceivedChain(fields: HeaderField[]): ReceivedHop[] {
  const received = getAll(fields, 'received');
  // Newest-first in the header block → reverse for delivery order.
  const hops = received
    .map((v) => parseReceived(v))
    .reverse()
    .map((h, i) => ({ ...h, hop: i, delaySeconds: null as number | null }));
  for (let i = 1; i < hops.length; i++) {
    const prev = hops[i - 1]!.timestamp;
    const cur = hops[i]!.timestamp;
    if (prev !== null && cur !== null) {
      hops[i]!.delaySeconds = Math.round((cur - prev) / 1000);
    }
  }
  return hops;
}

/** SPF/DKIM/DMARC verdict. */
export type AuthVerdict = 'pass' | 'fail' | 'softfail' | 'neutral' | 'none' | 'unknown';

export interface AuthResults {
  spf: AuthVerdict;
  dkim: AuthVerdict;
  dmarc: AuthVerdict;
  /** Raw Authentication-Results header(s) for reference. */
  raw: string[];
}

function normalizeVerdict(v: string): AuthVerdict {
  const s = v.trim().toLowerCase();
  if (s === 'pass') return 'pass';
  if (s === 'fail') return 'fail';
  if (s === 'softfail') return 'softfail';
  if (s === 'neutral' || s === 'none' || s === 'temperror' || s === 'permerror') {
    return s === 'neutral' ? 'neutral' : 'none';
  }
  return 'unknown';
}

/**
 * Extract SPF/DKIM/DMARC verdicts from `Authentication-Results` headers (and
 * the legacy `Received-SPF` header as a fallback for SPF).
 */
export function parseAuthResults(fields: HeaderField[]): AuthResults {
  const raw = getAll(fields, 'authentication-results');
  const res: AuthResults = { spf: 'unknown', dkim: 'unknown', dmarc: 'unknown', raw };
  const scan = (mech: string): AuthVerdict | null => {
    for (const header of raw) {
      const re = new RegExp(`\\b${mech}=(pass|fail|softfail|neutral|none|temperror|permerror)\\b`, 'i');
      const m = re.exec(header);
      if (m) return normalizeVerdict(m[1]!);
    }
    return null;
  };
  res.spf = scan('spf') ?? 'unknown';
  res.dkim = scan('dkim') ?? 'unknown';
  res.dmarc = scan('dmarc') ?? 'unknown';
  // Legacy Received-SPF fallback.
  if (res.spf === 'unknown') {
    const spfHeader = getFirst(fields, 'received-spf');
    if (spfHeader) {
      const m = /\b(pass|fail|softfail|neutral|none)\b/i.exec(spfHeader);
      if (m) res.spf = normalizeVerdict(m[1]!);
    }
  }
  return res;
}

/** Common identity headers surfaced for context. */
export interface IdentityHeaders {
  from: string;
  to: string;
  subject: string;
  date: string;
  messageId: string;
  returnPath: string;
}

export function parseIdentity(fields: HeaderField[]): IdentityHeaders {
  return {
    from: getFirst(fields, 'from'),
    to: getFirst(fields, 'to'),
    subject: getFirst(fields, 'subject'),
    date: getFirst(fields, 'date'),
    messageId: getFirst(fields, 'message-id'),
    returnPath: getFirst(fields, 'return-path'),
  };
}

/** Full analysis result. */
export interface EmailHeaderResult {
  fields: HeaderField[];
  hops: ReceivedHop[];
  auth: AuthResults;
  identity: IdentityHeaders;
  /** Total delivery time in seconds across all hops, or null. */
  totalDeliverySeconds: number | null;
  /** Field count. */
  fieldCount: number;
}

/** Run the full analysis on a raw header block. */
export function analyzeHeaders(raw: string): EmailHeaderResult | null {
  if (!raw.trim()) return null;
  const fields = parseHeaderFields(raw);
  if (fields.length === 0) return null;
  const hops = parseReceivedChain(fields);
  const auth = parseAuthResults(fields);
  const identity = parseIdentity(fields);
  const first = hops[0]?.timestamp ?? null;
  const last = hops[hops.length - 1]?.timestamp ?? null;
  const totalDeliverySeconds =
    first !== null && last !== null ? Math.round((last - first) / 1000) : null;
  return { fields, hops, auth, identity, totalDeliverySeconds, fieldCount: fields.length };
}

/** Format a hop delay for display. */
export function formatDelay(seconds: number | null): string {
  if (seconds === null) return '-';
  if (seconds < 0) return `${seconds}s (clock skew)`;
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

/* -------------------------------------------------------------------------- */
/* Composable - reactive state + embed integration                             */
/* -------------------------------------------------------------------------- */

export interface UseEmailHeaderAnalyzerReturn {
  input: Ref<string>;
  result: Ref<EmailHeaderResult | null>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  clear: () => void;
}

export function useEmailHeaderAnalyzer(): UseEmailHeaderAnalyzerReturn {
  const input = ref<string>('');
  const result = ref<EmailHeaderResult | null>(null);

  function recompute(): void {
    result.value = analyzeHeaders(input.value);
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
      else if (typeof p.headers === 'string') input.value = p.headers;
      else if (typeof p.text === 'string') input.value = p.text;
    },
    output: result,
    toOutput: () => {
      const r = result.value;
      return r
        ? {
            hops: r.hops.length,
            spf: r.auth.spf,
            dkim: r.auth.dkim,
            dmarc: r.auth.dmarc,
            totalDeliverySeconds: r.totalDeliverySeconds,
            from: r.identity.from,
            subject: r.identity.subject,
          }
        : {};
    },
  });

  return { input, result, isEmbed, embedInput, clear };
}
