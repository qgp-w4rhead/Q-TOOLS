/**
 * usePasswordEntropyCalculator - composable + pure logic for the password
 * entropy calculator tool.
 *
 * Computes the Shannon-style "pool entropy" of a password:
 *   entropy_bits = length × log2(charset_pool_size)
 *
 * The charset pool is auto-detected from the password's characters
 * (lowercase / uppercase / digits / common symbols / extended symbols /
 * whitespace / non-ASCII) or can be overridden manually. A crack-time table
 * shows how long an attacker needs at several guesses-per-second rates, and
 * a tips section suggests concrete strengthening moves.
 *
 * This complements `password-strength-analyser` (which uses zxcvbn's
 * pattern/dictionary matching): pool entropy is the theoretical maximum
 * against a brute-force attacker who knows the charset but not the password.
 *
 * Pure helpers have no Vue dependency and can be imported standalone for
 * unit testing or reuse. The `usePasswordEntropyCalculator()` composable
 * wraps them in reactive state and wires up the embed PostMessage protocol.
 *
 * No external dependencies.
 */
import { ref, watch, type Ref } from 'vue';
import { useToolEmbed } from '@/composables/useToolEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Pure logic - no Vue dependency below this point                             */
/* -------------------------------------------------------------------------- */

/** Charset classes detected in a password. */
export interface CharsetBreakdown {
  lowercase: number;
  uppercase: number;
  digits: number;
  /** Common ASCII symbols: !@#$%^&* etc. (33 chars). */
  symbolsCommon: number;
  /** Less-common ASCII symbols/punctuation (everything else printable). */
  symbolsExtended: number;
  /** Space / tab / other whitespace. */
  whitespace: number;
  /** Non-ASCII characters (counted as a large pool). */
  nonAscii: number;
}

/** Pool sizes used for each charset class (standard estimates). */
export const POOL_SIZES = {
  lowercase: 26,
  uppercase: 26,
  digits: 10,
  symbolsCommon: 33,
  symbolsExtended: 33,
  whitespace: 2,
  /** Conservative per-char pool for non-ASCII (BMP letters/symbols). */
  nonAscii: 1000,
} as const;

const LOWER_RE = /[a-z]/;
const UPPER_RE = /[A-Z]/;
const DIGIT_RE = /[0-9]/;
const COMMON_SYMBOLS = new Set(
  '!@#$%^&*()-_=+[]{}|;:,.<>?/\\\'"`~'.split(''),
);
const WHITESPACE_RE = /\s/;

/**
 * Count how many characters of `password` fall into each charset class.
 * Each character is attributed to exactly one class (first match wins).
 */
export function analyzeCharset(password: string): CharsetBreakdown {
  const b: CharsetBreakdown = {
    lowercase: 0,
    uppercase: 0,
    digits: 0,
    symbolsCommon: 0,
    symbolsExtended: 0,
    whitespace: 0,
    nonAscii: 0,
  };
  for (const ch of password) {
    if (LOWER_RE.test(ch)) b.lowercase++;
    else if (UPPER_RE.test(ch)) b.uppercase++;
    else if (DIGIT_RE.test(ch)) b.digits++;
    else if (WHITESPACE_RE.test(ch)) b.whitespace++;
    else if (ch.codePointAt(0)! > 0x7e || ch.codePointAt(0)! < 0x20) b.nonAscii++;
    else if (COMMON_SYMBOLS.has(ch)) b.symbolsCommon++;
    else b.symbolsExtended++;
  }
  return b;
}

/**
 * Compute the effective charset pool size from a breakdown: the sum of pool
 * sizes for every class that occurs at least once.
 */
export function poolSize(b: CharsetBreakdown): number {
  let pool = 0;
  if (b.lowercase > 0) pool += POOL_SIZES.lowercase;
  if (b.uppercase > 0) pool += POOL_SIZES.uppercase;
  if (b.digits > 0) pool += POOL_SIZES.digits;
  if (b.symbolsCommon > 0) pool += POOL_SIZES.symbolsCommon;
  if (b.symbolsExtended > 0) pool += POOL_SIZES.symbolsExtended;
  if (b.whitespace > 0) pool += POOL_SIZES.whitespace;
  if (b.nonAscii > 0) pool += POOL_SIZES.nonAscii;
  return pool;
}

/**
 * Entropy in bits: `length × log2(poolSize)`. Returns 0 for empty input or
 * a zero pool.
 */
export function entropyBits(length: number, pool: number): number {
  if (length <= 0 || pool <= 1) return 0;
  return length * Math.log2(pool);
}

/** A single row of the crack-time table. */
export interface CrackTimeRow {
  /** Scenario label, e.g. "Online (throttled)". */
  label: string;
  /** Guesses per second for this scenario. */
  guessesPerSecond: number;
  /** Average seconds to crack (half the search space). */
  seconds: number;
  /** Human-readable duration. */
  display: string;
}

/** Standard attacker scenarios, weakest → strongest. */
export const CRACK_SCENARIOS: ReadonlyArray<{ label: string; gps: number }> = [
  { label: 'Online (throttled, 10/s)', gps: 10 },
  { label: 'Online (unthrottled, 10k/s)', gps: 1e4 },
  { label: 'Offline fast hash (1 GH/s)', gps: 1e9 },
  { label: 'GPU rig (1 TH/s)', gps: 1e12 },
  { label: 'Nation-state (1 PH/s)', gps: 1e15 },
];

/**
 * Average crack time in seconds: half the total search space
 * (`pool^length / 2 / gps`). Uses `log2` internally to avoid overflow on
 * huge search spaces.
 */
export function crackSeconds(entropy: number, gps: number): number {
  if (entropy <= 0 || gps <= 0) return 0;
  // Average case = 2^(entropy-1) guesses / gps.
  return Math.pow(2, entropy - 1) / gps;
}

/** Build the crack-time table for a given entropy. */
export function crackTable(entropy: number): CrackTimeRow[] {
  return CRACK_SCENARIOS.map((s) => {
    const seconds = crackSeconds(entropy, s.gps);
    return {
      label: s.label,
      guessesPerSecond: s.gps,
      seconds,
      display: formatDuration(seconds),
    };
  });
}

/**
 * Format a duration in seconds as a human-readable string, scaling up to
 * "universe heat death" territory. Handles sub-second through ~1e40 years.
 */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return 'instant';
  if (seconds < 1) return 'instant';
  const MIN = 60;
  const HOUR = 3600;
  const DAY = 86400;
  const YEAR = 31557600; // Julian year
  if (seconds < MIN) return `${Math.round(seconds)} sec`;
  if (seconds < HOUR) return `${formatNum(seconds / MIN)} min`;
  if (seconds < DAY) return `${formatNum(seconds / HOUR)} hr`;
  if (seconds < YEAR) return `${formatNum(seconds / DAY)} days`;
  const years = seconds / YEAR;
  if (years < 1e3) return `${formatNum(years)} yrs`;
  if (years < 1e6) return `${formatNum(years / 1e3)}k yrs`;
  if (years < 1e9) return `${formatNum(years / 1e6)}M yrs`;
  if (years < 1e12) return `${formatNum(years / 1e9)}B yrs`;
  if (years < 1e15) return `${formatNum(years / 1e12)}T yrs`;
  return '> 1 quadrillion yrs';
}

function formatNum(n: number): string {
  if (n >= 100) return Math.round(n).toLocaleString('en-US');
  if (n >= 10) return n.toFixed(1);
  return n.toFixed(2);
}

/** Qualitative strength band for a given entropy. */
export type StrengthBand = 'very-weak' | 'weak' | 'fair' | 'strong' | 'excellent';

export function strengthBand(entropy: number): StrengthBand {
  if (entropy < 28) return 'very-weak';
  if (entropy < 50) return 'weak';
  if (entropy < 75) return 'fair';
  if (entropy < 100) return 'strong';
  return 'excellent';
}

export const STRENGTH_LABELS: Record<StrengthBand, string> = {
  'very-weak': 'Very weak',
  weak: 'Weak',
  fair: 'Fair',
  strong: 'Strong',
  excellent: 'Excellent',
};

/**
 * Generate concrete strengthening tips based on the current password /
 * charset breakdown. Returns an empty array when there's nothing to suggest.
 */
export function strengtheningTips(
  password: string,
  breakdown: CharsetBreakdown,
  entropy: number,
): string[] {
  const tips: string[] = [];
  if (password.length === 0) return tips;
  if (password.length < 12) {
    tips.push('Use at least 12 characters - length is the biggest entropy driver.');
  } else if (password.length < 16) {
    tips.push('16+ characters puts brute-force out of reach for most attackers.');
  }
  if (breakdown.lowercase > 0 && breakdown.uppercase === 0 && breakdown.digits === 0 && breakdown.symbolsCommon === 0 && breakdown.symbolsExtended === 0) {
    tips.push('All-lowercase passwords have a tiny 26-char pool - mix in digits or symbols.');
  }
  if (breakdown.digits === 0) tips.push('Adding digits grows the pool by 10.');
  if (breakdown.uppercase === 0) tips.push('Adding uppercase letters grows the pool by 26.');
  if (breakdown.symbolsCommon === 0 && breakdown.symbolsExtended === 0) {
    tips.push('Symbols add ~33-66 to the pool - more than doubling a letters-only charset.');
  }
  if (/^(.)\1+$/.test(password)) {
    tips.push('Repeated characters have near-zero real entropy regardless of length.');
  }
  if (/^(password|qwerty|letmein|admin|welcome|iloveyou)/i.test(password)) {
    tips.push('This starts with a common dictionary word - attackers try those first.');
  }
  if (entropy > 0 && entropy < 50) {
    tips.push('Consider a passphrase: 4-5 random words beat a short complex password.');
  }
  if (entropy >= 75) {
    tips.push('Strong enough for most uses - store it in a password manager.');
  }
  return tips;
}

/** Full analysis result for the current input. */
export interface EntropyResult {
  length: number;
  pool: number;
  entropy: number;
  band: StrengthBand;
  bandLabel: string;
  breakdown: CharsetBreakdown;
  crackTimes: CrackTimeRow[];
  tips: string[];
}

/**
 * Run the full analysis. When `manualPool` is a positive number it overrides
 * the auto-detected pool size (manual mode).
 */
export function analyzePassword(
  password: string,
  manualPool: number | null = null,
): EntropyResult | null {
  const length = [...password].length; // code-point aware
  if (length === 0) return null;
  const breakdown = analyzeCharset(password);
  const pool =
    manualPool !== null && manualPool > 0
      ? Math.floor(manualPool)
      : poolSize(breakdown);
  const entropy = entropyBits(length, pool);
  const band = strengthBand(entropy);
  return {
    length,
    pool,
    entropy,
    band,
    bandLabel: STRENGTH_LABELS[band],
    breakdown,
    crackTimes: crackTable(entropy),
    tips: strengtheningTips(password, breakdown, entropy),
  };
}

/* -------------------------------------------------------------------------- */
/* Composable - reactive state + embed integration                             */
/* -------------------------------------------------------------------------- */

export interface UsePasswordEntropyCalculatorReturn {
  password: Ref<string>;
  showPassword: Ref<boolean>;
  /** When > 0, overrides auto-detected pool size. */
  manualPool: Ref<number>;
  manualMode: Ref<boolean>;
  result: Ref<EntropyResult | null>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
}

export function usePasswordEntropyCalculator(): UsePasswordEntropyCalculatorReturn {
  const password = ref<string>('');
  const showPassword = ref<boolean>(false);
  const manualPool = ref<number>(0);
  const manualMode = ref<boolean>(false);
  const result = ref<EntropyResult | null>(null);

  function recompute(): void {
    result.value = analyzePassword(
      password.value,
      manualMode.value && manualPool.value > 0 ? manualPool.value : null,
    );
  }

  watch([password, manualPool, manualMode], recompute, { immediate: true });

  const { isEmbed, input: embedInput } = useToolEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.password === 'string') password.value = p.password;
      if (typeof p.input === 'string') password.value = p.input;
      if (typeof p.pool === 'number' && p.pool > 0) {
        manualPool.value = Math.floor(p.pool);
        manualMode.value = true;
      }
      if (typeof p.showPassword === 'boolean') showPassword.value = p.showPassword;
    },
    output: result,
    toOutput: () => {
      const r = result.value;
      return r
        ? {
            length: r.length,
            pool: r.pool,
            entropy: Math.round(r.entropy * 100) / 100,
            band: r.band,
            bandLabel: r.bandLabel,
          }
        : {};
    },
  });

  return {
    password,
    showPassword,
    manualPool,
    manualMode,
    result,
    isEmbed,
    embedInput,
  };
}
