/**
 * useHomoglyphDetector - composable + pure logic for the homoglyph / punycode
 * detector tool.
 *
 * Analyzes a pasted URL or domain for phishing indicators:
 *  - `xn--` punycode labels (decoded via a built-in RFC 3492 decoder)
 *  - non-ASCII / confusable Unicode characters (Cyrillic/Greek lookalikes)
 *  - mixed-script labels (e.g. Latin + Cyrillic in one label)
 *  - other tricks: `@` userinfo, excessive subdomains, IP-literal hosts,
 *    suspicious TLD-free text
 *
 * Pure helpers have no Vue dependency and can be imported standalone for
 * unit testing or reuse. The `useHomoglyphDetector()` composable wraps them
 * in reactive state and wires up the embed PostMessage protocol.
 *
 * No external dependencies.
 */
import { ref, watch, type Ref } from 'vue';
import { useToolEmbed } from '@/composables/useToolEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Punycode decoder (RFC 3492) - pure, no deps                                 */
/* -------------------------------------------------------------------------- */

const BASE = 36;
const TMIN = 1;
const TMAX = 26;
const SKEW = 38;
const DAMP = 700;
const INITIAL_BIAS = 72;
const INITIAL_N = 128;
const DELIMITER = '-';

function digitValue(code: number): number {
  // '0'-'9' → 26-35, 'a'-'z' → 0-25, 'A'-'Z' → 0-25
  if (code >= 48 && code <= 57) return code - 22; // 0-9
  if (code >= 97 && code <= 122) return code - 97; // a-z
  if (code >= 65 && code <= 90) return code - 65; // A-Z
  return BASE;
}

function adapt(delta: number, numPoints: number, firstTime: boolean): number {
  delta = firstTime ? Math.floor(delta / DAMP) : delta >> 1;
  delta += Math.floor(delta / numPoints);
  let k = 0;
  while (delta > Math.floor(((BASE - TMIN) * TMAX) / 2)) {
    delta = Math.floor(delta / (BASE - TMIN));
    k += BASE;
  }
  return k + Math.floor(((BASE - TMIN + 1) * delta) / (delta + SKEW));
}

/**
 * Decode a single punycode label (the part after `xn--`). Returns the decoded
 * Unicode string, or `null` on malformed input.
 */
export function punycodeDecode(input: string): string | null {
  try {
    const output: number[] = [];
    const inputLen = input.length;
    let i = 0;
    let n = INITIAL_N;
    let bias = INITIAL_BIAS;

    // Copy basic code points before the last delimiter.
    const lastDelim = input.lastIndexOf(DELIMITER);
    let pos = 0;
    if (lastDelim >= 0) {
      for (let j = 0; j < lastDelim; j++) {
        const c = input.charCodeAt(j);
        if (c >= 0x80) return null; // basic code points only
        output.push(c);
      }
      pos = lastDelim + 1;
    }

    while (pos < inputLen) {
      const oldi = i;
      let w = 1;
      for (let k = BASE; ; k += BASE) {
        if (pos >= inputLen) return null;
        const digit = digitValue(input.charCodeAt(pos++));
        if (digit >= BASE) return null;
        i += digit * w;
        const t = k <= bias ? TMIN : k >= bias + TMAX ? TMAX : k - bias;
        if (digit < t) break;
        w *= BASE - t;
      }
      const outLen = output.length + 1;
      bias = adapt(i - oldi, outLen, oldi === 0);
      n += Math.floor(i / outLen);
      i = i % outLen;
      output.splice(i, 0, n);
      i++;
    }
    return String.fromCodePoint(...output);
  } catch {
    return null;
  }
}

/** Decode every `xn--` label in a hostname. */
export function decodePunycodeHost(host: string): string {
  return host
    .split('.')
    .map((label) =>
      label.toLowerCase().startsWith('xn--')
        ? (punycodeDecode(label.slice(4)) ?? label)
        : label,
    )
    .join('.');
}

/* -------------------------------------------------------------------------- */
/* Script + confusable detection                                               */
/* -------------------------------------------------------------------------- */

/** Unicode script classification for a code point (coarse, phishing-relevant). */
export type ScriptClass =
  | 'latin'
  | 'cyrillic'
  | 'greek'
  | 'digit'
  | 'ascii-other'
  | 'other';

export function scriptOf(cp: number): ScriptClass {
  if (cp >= 0x30 && cp <= 0x39) return 'digit';
  if (cp >= 0x41 && cp <= 0x5a) return 'latin';
  if (cp >= 0x61 && cp <= 0x7a) return 'latin';
  if (cp < 0x80) return 'ascii-other';
  // Latin-1 Supplement + Extended (accented Latin)
  if (cp <= 0x024f) return 'latin';
  // Greek and Coptic
  if (cp >= 0x0370 && cp <= 0x03ff) return 'greek';
  // Cyrillic + Supplement
  if (cp >= 0x0400 && cp <= 0x052f) return 'cyrillic';
  return 'other';
}

/**
 * Map of common confusable characters → the ASCII they impersonate.
 * Covers the most-abused Cyrillic and Greek homoglyphs.
 */
export const CONFUSABLES: Record<string, string> = {
  // Cyrillic lowercase
  'а': 'a', 'е': 'e', 'о': 'o', 'р': 'p', 'с': 'c', 'х': 'x', 'у': 'y',
  'і': 'i', 'ј': 'j', 'ѕ': 's', 'һ': 'h', 'ո': 'n', 'ԁ': 'd', 'ԍ': 'g',
  'ԛ': 'q', 'ԝ': 'w', 'в': 'b', 'к': 'k', 'м': 'm', 'н': 'h', 'т': 't',
  'г': 'r', 'з': '3', 'ч': '4', 'ь': 'b', 'ъ': 'b',
  // Cyrillic uppercase
  'А': 'A', 'В': 'B', 'Е': 'E', 'К': 'K', 'М': 'M', 'Н': 'H', 'О': 'O',
  'Р': 'P', 'С': 'C', 'Т': 'T', 'Х': 'X', 'І': 'I', 'Ј': 'J', 'Ѕ': 'S',
  'Һ': 'H', 'Ԍ': 'G', 'Ԛ': 'Q', 'Ԝ': 'W', 'З': '3',
  // Greek
  'α': 'a', 'β': 'B', 'γ': 'y', 'δ': 'd', 'ε': 'e', 'ζ': 'z', 'η': 'n',
  'θ': 'o', 'ι': 'i', 'κ': 'k', 'λ': 'x', 'μ': 'u', 'ν': 'v', 'ξ': 'e',
  'ο': 'o', 'π': 'n', 'ρ': 'p', 'σ': 'o', 'τ': 't', 'υ': 'u', 'φ': 'o',
  'χ': 'x', 'ψ': 'w', 'ω': 'w',
  'Α': 'A', 'Β': 'B', 'Ε': 'E', 'Ζ': 'Z', 'Η': 'H', 'Ι': 'I', 'Κ': 'K',
  'Μ': 'M', 'Ν': 'N', 'Ο': 'O', 'Ρ': 'P', 'Τ': 'T', 'Υ': 'Y', 'Χ': 'X',
  // Digits / misc
  '0': 'o', '1': 'l', '3': 'e', '5': 's', '7': 't', '8': 'b',
  'ℓ': 'l', '℮': 'e', 'ℴ': 'o',
};

/** A single flagged character. */
export interface FlaggedChar {
  char: string;
  codePoint: string;
  script: ScriptClass;
  /** The ASCII it resembles, if known. */
  resembles: string | null;
  /** Index within the analyzed string. */
  index: number;
}

/** A single finding. */
export interface HomoglyphIssue {
  level: 'error' | 'warning' | 'info';
  message: string;
}

/** Full analysis result. */
export interface HomoglyphResult {
  /** The extracted hostname (or raw input when no URL structure). */
  host: string;
  /** The host with all `xn--` labels decoded to Unicode. */
  decodedHost: string;
  /** Whether any label used punycode. */
  hasPunycode: boolean;
  /** Whether the host contains non-ASCII characters. */
  hasNonAscii: boolean;
  /** Scripts detected in the host (excluding digits/ascii-other). */
  scripts: ScriptClass[];
  /** Whether multiple letter scripts are mixed in one label. */
  mixedScript: boolean;
  /** Flagged confusable characters. */
  flagged: FlaggedChar[];
  /** Issues found. */
  issues: HomoglyphIssue[];
  /** Whether the input looked like a URL (had a scheme or path). */
  isUrl: boolean;
}

/** Extract the hostname from a URL or bare domain string. */
export function extractHost(input: string): { host: string; isUrl: boolean } {
  const s = input.trim();
  if (!s) return { host: '', isUrl: false };
  // Try full URL parse first.
  try {
    const u = new URL(s.includes('://') ? s : `https://${s}`);
    return { host: u.hostname, isUrl: s.includes('://') || s.includes('/') };
  } catch {
    // Fall back to stripping path/port manually.
    const noScheme = s.replace(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//, '');
    const host = noScheme.split(/[/?#:]/)[0] ?? '';
    return { host, isUrl: false };
  }
}

/** Analyze a URL or domain for homoglyph/phishing indicators. */
export function analyzeHomoglyphs(input: string): HomoglyphResult | null {
  const { host, isUrl } = extractHost(input);
  if (!host) return null;

  const decodedHost = decodePunycodeHost(host);
  const hasPunycode = /(^|\.)xn--/i.test(host);
  const issues: HomoglyphIssue[] = [];
  const flagged: FlaggedChar[] = [];
  const scriptsSet = new Set<ScriptClass>();

  // Per-label script analysis on the decoded host.
  let mixedScript = false;
  for (const label of decodedHost.split('.')) {
    const labelScripts = new Set<ScriptClass>();
    let idx = 0;
    for (const ch of label) {
      const cp = ch.codePointAt(0)!;
      const script = scriptOf(cp);
      if (script === 'latin' || script === 'cyrillic' || script === 'greek' || script === 'other') {
        labelScripts.add(script);
        scriptsSet.add(script);
      }
      const resembles = CONFUSABLES[ch] ?? null;
      if (resembles !== null && cp > 0x7e) {
        flagged.push({
          char: ch,
          codePoint: `U+${cp.toString(16).toUpperCase().padStart(4, '0')}`,
          script,
          resembles,
          index: idx,
        });
      }
      idx++;
    }
    const letterScripts = [...labelScripts].filter(
      (s) => s === 'latin' || s === 'cyrillic' || s === 'greek',
    );
    if (letterScripts.length > 1) mixedScript = true;
  }

  const hasNonAscii = [...decodedHost].some((c) => c.codePointAt(0)! > 0x7e);

  // ---- Issues ----
  if (hasPunycode) {
    issues.push({
      level: 'warning',
      message: `Punycode label(s) present - decodes to "${decodedHost}".`,
    });
  }
  if (mixedScript) {
    issues.push({
      level: 'error',
      message: 'Mixed scripts in one label (e.g. Latin + Cyrillic) - classic homoglyph attack.',
    });
  }
  if (flagged.length > 0 && !mixedScript) {
    issues.push({
      level: 'warning',
      message: `${flagged.length} confusable character${flagged.length === 1 ? '' : 's'} found.`,
    });
  }
  if (hasNonAscii && !hasPunycode && !mixedScript && flagged.length === 0) {
    issues.push({
      level: 'info',
      message: 'Non-ASCII characters present (IDN) - verify they are intentional.',
    });
  }
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || /^\[[0-9a-f:]+\]$/i.test(host)) {
    issues.push({ level: 'info', message: 'Host is an IP literal, not a domain name.' });
  }
  if (input.includes('@')) {
    issues.push({
      level: 'warning',
      message: 'URL contains "@" - the real host is after it (userinfo trick).',
    });
  }
  const subdomains = decodedHost.split('.').length - 2;
  if (subdomains >= 4) {
    issues.push({
      level: 'info',
      message: `${subdomains} subdomain levels - deep subdomains can hide the real domain.`,
    });
  }
  if (!hasPunycode && !hasNonAscii && !mixedScript && flagged.length === 0) {
    issues.push({ level: 'info', message: 'No homoglyph indicators detected in the host.' });
  }

  return {
    host,
    decodedHost,
    hasPunycode,
    hasNonAscii,
    scripts: [...scriptsSet],
    mixedScript,
    flagged,
    issues,
    isUrl,
  };
}

/* -------------------------------------------------------------------------- */
/* Composable - reactive state + embed integration                             */
/* -------------------------------------------------------------------------- */

export interface UseHomoglyphDetectorReturn {
  input: Ref<string>;
  result: Ref<HomoglyphResult | null>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  clear: () => void;
}

export function useHomoglyphDetector(): UseHomoglyphDetectorReturn {
  const input = ref<string>('');
  const result = ref<HomoglyphResult | null>(null);

  function recompute(): void {
    result.value = analyzeHomoglyphs(input.value);
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
      else if (typeof p.url === 'string') input.value = p.url;
      else if (typeof p.domain === 'string') input.value = p.domain;
    },
    output: result,
    toOutput: () => {
      const r = result.value;
      return r
        ? {
            host: r.host,
            decodedHost: r.decodedHost,
            hasPunycode: r.hasPunycode,
            mixedScript: r.mixedScript,
            flagged: r.flagged.length,
            issues: r.issues.map((i) => `${i.level}: ${i.message}`),
          }
        : {};
    },
  });

  return { input, result, isEmbed, embedInput, clear };
}
