/**
 * usePiiRedactor - composable + pure logic for the PII Redactor tool.
 *
 * Detects and masks Personally Identifiable Information (PII) in text:
 *   - Email addresses
 *   - Phone numbers (US/international)
 *   - US Social Security Numbers (SSN)
 *   - Credit card numbers (Visa, MC, Amex, Discover, etc.)
 *   - IPv4 and IPv6 addresses
 *   - API keys / tokens (common patterns)
 *
 * All detection is pure regex-based - no external dependencies.
 */
import { ref, watch, type Ref } from 'vue';
import { useToolEmbed } from '@/composables/useToolEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Types - pure logic (no Vue dependency)                                      */
/* -------------------------------------------------------------------------- */

export type PiiType =
  | 'email'
  | 'phone'
  | 'ssn'
  | 'creditCard'
  | 'ipv4'
  | 'ipv6'
  | 'apiKey';

export interface PiiMatch {
  type: PiiType;
  start: number;
  end: number;
  original: string;
  masked: string;
}

export interface PiiRedactionResult {
  redacted: string;
  matches: PiiMatch[];
  counts: Record<PiiType, number>;
  totalCount: number;
}

export interface PiiRedactorOptions {
  email: boolean;
  phone: boolean;
  ssn: boolean;
  creditCard: boolean;
  ipv4: boolean;
  ipv6: boolean;
  apiKey: boolean;
  maskToken: string;
}

export interface UsePiiRedactorReturn {
  inputText: Ref<string>;
  options: Ref<PiiRedactorOptions>;
  result: Ref<PiiRedactionResult>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  reset: () => void;
}

/* -------------------------------------------------------------------------- */
/* Constants                                                                   */
/* -------------------------------------------------------------------------- */

export const DEFAULT_OPTIONS: PiiRedactorOptions = {
  email: true,
  phone: true,
  ssn: true,
  creditCard: true,
  ipv4: true,
  ipv6: true,
  apiKey: true,
  maskToken: '[REDACTED]',
};

export const PII_TYPE_LABELS: Record<PiiType, string> = {
  email: 'Email',
  phone: 'Phone',
  ssn: 'SSN',
  creditCard: 'Credit card',
  ipv4: 'IPv4 address',
  ipv6: 'IPv6 address',
  apiKey: 'API key / token',
};

/* -------------------------------------------------------------------------- */
/* Pure logic - no Vue dependency below this point                             */
/* -------------------------------------------------------------------------- */

// Email: standard email pattern
const EMAIL_RE = /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g;

// Phone: matches US (xxx) xxx-xxxx, xxx-xxx-xxxx, +1 xxx-xxx-xxxx, international +xx xxx xxx xxx
const PHONE_RE = /(?:(?:\+?\d{1,3}[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4})|(?:(?:\+|00)\d{1,3}[\s.-]?\d{1,4}[\s.-]?\d{1,4}[\s.-]?\d{1,4}[\s.-]?\d{0,4})\b/g;

// SSN: xxx-xx-xxxx or xxxxxxxxx
const SSN_RE = /\b\d{3}-\d{2}-\d{4}\b/g;

// Credit card: groups of 4 digits separated by spaces or dashes, 13-19 digits total
const CREDIT_CARD_RE = /\b(?:\d[ -]*?){13,19}\b/g;

// IPv4: x.x.x.x where x is 0-255
const IPV4_RE = /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g;

// IPv6: simplified - groups of hex digits separated by colons
const IPV6_RE = /\b(?:[0-9a-fA-F]{1,4}:){2,7}(?:[0-9a-fA-F]{1,4}|:)\b/g;

// API keys: common patterns - long hex/base64 strings, Bearer tokens, etc.
const API_KEY_RE = /(?:Bearer\s+)?(?:sk-|pk-|api[_-]?key[_-]?|token[_-]?|secret[_-]?)?[a-zA-Z0-9]{32,}\b/gi;

interface DetectorDef {
  type: PiiType;
  regex: RegExp;
}

const DETECTORS: DetectorDef[] = [
  { type: 'email', regex: EMAIL_RE },
  { type: 'ssn', regex: SSN_RE },
  { type: 'creditCard', regex: CREDIT_CARD_RE },
  { type: 'phone', regex: PHONE_RE },
  { type: 'ipv4', regex: IPV4_RE },
  { type: 'ipv6', regex: IPV6_RE },
  { type: 'apiKey', regex: API_KEY_RE },
];

/** Luhn checksum validation for credit card numbers. */
function luhnValid(digits: string): boolean {
  const nums = digits.replace(/[\s-]/g, '');
  if (!/^\d{13,19}$/.test(nums)) return false;
  let sum = 0;
  let alt = false;
  for (let i = nums.length - 1; i >= 0; i--) {
    let n = parseInt(nums[i] ?? '0', 10);
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

/** Check if a phone match is plausible (at least 7 digits). */
function phonePlausible(match: string): boolean {
  const digits = match.replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 15;
}

/** Check if an API key match looks like a real key (not just a long number). */
function apiKeyPlausible(match: string): boolean {
  // Reject pure digit strings (likely phone/cc overlap)
  if (/^\d+$/.test(match.replace(/[\s-]/g, ''))) return false;
  // Reject if it looks like a credit card (passes Luhn)
  const digits = match.replace(/\D/g, '');
  if (digits.length >= 13 && digits.length <= 19 && luhnValid(digits)) return false;
  return true;
}

/**
 * Detect and mask PII in text. Returns the redacted text and a list of matches.
 */
export function redactPii(
  text: string,
  options: PiiRedactorOptions = DEFAULT_OPTIONS,
): PiiRedactionResult {
  const matches: PiiMatch[] = [];
  const counts: Record<PiiType, number> = {
    email: 0,
    phone: 0,
    ssn: 0,
    creditCard: 0,
    ipv4: 0,
    ipv6: 0,
    apiKey: 0,
  };

  for (const det of DETECTORS) {
    if (!options[det.type]) continue;

    det.regex.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = det.regex.exec(text)) !== null) {
      const original = m[0] ?? '';
      if (!original) continue;
      const start = m.index;
      const end = start + original.length;

      // Type-specific validation
      if (det.type === 'creditCard' && !luhnValid(original)) continue;
      if (det.type === 'phone' && !phonePlausible(original)) continue;
      if (det.type === 'apiKey' && !apiKeyPlausible(original)) continue;

      // Skip if overlaps with an existing match
      if (matches.some((x) => start < x.end && end > x.start)) continue;

      matches.push({
        type: det.type,
        start,
        end,
        original,
        masked: options.maskToken,
      });
      counts[det.type]++;
    }
  }

  // Sort by position
  matches.sort((a, b) => a.start - b.start);

  // Build redacted text
  let redacted = text;
  let offset = 0;
  for (const match of matches) {
    const before = redacted.slice(0, match.start + offset);
    const after = redacted.slice(match.end + offset);
    redacted = before + match.masked + after;
    offset += match.masked.length - (match.end - match.start);
  }

  return {
    redacted,
    matches,
    counts,
    totalCount: matches.length,
  };
}

/* -------------------------------------------------------------------------- */
/* Composable - reactive state + embed integration                             */
/* -------------------------------------------------------------------------- */

export function usePiiRedactor(): UsePiiRedactorReturn {
  const inputText = ref<string>('');
  const options = ref<PiiRedactorOptions>({ ...DEFAULT_OPTIONS });
  const result = ref<PiiRedactionResult>({
    redacted: '',
    matches: [],
    counts: { email: 0, phone: 0, ssn: 0, creditCard: 0, ipv4: 0, ipv6: 0, apiKey: 0 },
    totalCount: 0,
  });

  function recompute(): void {
    result.value = redactPii(inputText.value, options.value);
  }

  function reset(): void {
    inputText.value = '';
    options.value = { ...DEFAULT_OPTIONS };
    recompute();
  }

  watch([inputText, options], recompute, { deep: true });

  recompute();

  const { isEmbed, input: embedInput } = useToolEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.text === 'string') inputText.value = p.text;
      if (typeof p.input === 'string') inputText.value = p.input;
      if (typeof p.value === 'string') inputText.value = p.value;
      if (typeof p.maskToken === 'string') options.value.maskToken = p.maskToken;
    },
    output: result,
    toOutput: () => ({
      redacted: result.value.redacted,
      counts: { ...result.value.counts },
      totalCount: result.value.totalCount,
      matchCount: result.value.matches.length,
    }),
  });

  return {
    inputText,
    options,
    result,
    isEmbed,
    embedInput,
    reset,
  };
}
