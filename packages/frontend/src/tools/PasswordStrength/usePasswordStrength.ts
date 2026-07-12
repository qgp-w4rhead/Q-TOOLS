/**
 * usePasswordStrength — composable + pure logic for the password strength
 * analyser tool.
 *
 * Analyses password strength using `@zxcvbn-ts/core` (a modular, actively
 * maintained TypeScript rewrite of zxcvbn) together with the
 * `@zxcvbn-ts/language-common` and `@zxcvbn-ts/language-en` dictionaries.
 * The three packages are dynamically imported inside `ensureZxcvbnModule()`
 * (cached after first load) so Vite emits them as separate chunks, loaded only
 * when the user opens this tool.
 *
 * The v3.0.4 API is functional (not the `ZxcvbnFactory` class from older
 * docs): call `zxcvbnOptions.setOptions({...})` once to configure the
 * dictionaries / graphs / translations, then `zxcvbn(password)` returns a
 * `ZxcvbnResult` with `score` (0-4), `guesses`, `guessesLog10`,
 * `crackTimesSeconds`, `crackTimesDisplay`, `feedback`, `sequence`, and
 * `calcTime`.
 *
 * Entropy is not reported directly by zxcvbn; it is derived from the estimated
 * guess count as `entropyBits = guessesLog10 * log2(10)` (the number of bits
 * of entropy corresponding to the search-space size implied by `guesses`).
 *
 * The pure helpers (`ensureZxcvbnModule`, `analyzePassword`,
 * `guessesToEntropyBits`, `formatCrackTime`) have no Vue dependency and can be
 * imported standalone for unit testing or reuse. The `usePasswordStrength()`
 * composable wraps them in reactive state, debounces recomputation, and wires
 * up the embed PostMessage protocol.
 *
 * Dependencies: `@zxcvbn-ts/core`, `@zxcvbn-ts/language-common`,
 * `@zxcvbn-ts/language-en` (all lazy-loaded) — listed in tech-stack.md.
 */
import { ref, watch, type Ref } from 'vue';
import { useEmbed } from '@/composables/useEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Pure logic — no Vue dependency below this point                            */
/* -------------------------------------------------------------------------- */

/** log2(10) — used to convert `guessesLog10` into entropy bits. */
export const LOG2_10 = Math.log2(10);

/**
 * Convert a `guessesLog10` value (order of magnitude of the estimated guess
 * count) into an entropy estimate in bits. `entropyBits = log2(guesses) =
 * guessesLog10 * log2(10)`.
 */
export function guessesToEntropyBits(guessesLog10: number): number {
  if (!Number.isFinite(guessesLog10) || guessesLog10 <= 0) return 0;
  return guessesLog10 * LOG2_10;
}

/** zxcvbn score band (0 = very weak … 4 = very strong). */
export type PasswordScore = 0 | 1 | 2 | 3 | 4;

/** Display metadata for each score band. */
export interface ScoreInfo {
  value: PasswordScore;
  /** Short label shown next to the meter. */
  label: string;
  /** CSS color token name (resolved against the theme). */
  colorVar: string;
  /** One-line description of the protection level. */
  hint: string;
}

export const SCORE_INFOS: ScoreInfo[] = [
  {
    value: 0,
    label: 'Very weak',
    colorVar: '--qt-danger',
    hint: 'Risky — guesses < 10³',
  },
  {
    value: 1,
    label: 'Weak',
    colorVar: '--qt-danger',
    hint: 'Very guessable — guesses < 10⁶',
  },
  {
    value: 2,
    label: 'Fair',
    colorVar: '--qt-warning',
    hint: 'Somewhat guessable — guesses < 10⁸',
  },
  {
    value: 3,
    label: 'Strong',
    colorVar: '--qt-success',
    hint: 'Safely unguessable — guesses < 10¹⁰',
  },
  {
    value: 4,
    label: 'Very strong',
    colorVar: '--qt-success',
    hint: 'Very unguessable — guesses ≥ 10¹⁰',
  },
];

export const SCORE_MAP: Record<PasswordScore, ScoreInfo> = Object.fromEntries(
  SCORE_INFOS.map((s) => [s.value, s]),
) as Record<PasswordScore, ScoreInfo>;

/** Attack scenarios reported by zxcvbn, ordered slowest → fastest. */
export interface CrackScenarioInfo {
  /** Property key on `crackTimesDisplay` / `crackTimesSeconds`. */
  key: CrackScenarioKey;
  /** Human-readable label. */
  label: string;
  /** Short description of the attack model. */
  description: string;
}

export type CrackScenarioKey =
  | 'onlineThrottling100PerHour'
  | 'onlineNoThrottling10PerSecond'
  | 'offlineSlowHashing1e4PerSecond'
  | 'offlineFastHashing1e10PerSecond';

export const CRACK_SCENARIOS: CrackScenarioInfo[] = [
  {
    key: 'onlineThrottling100PerHour',
    label: 'Online (throttled)',
    description: '100 guesses/hour — rate-limited login',
  },
  {
    key: 'onlineNoThrottling10PerSecond',
    label: 'Online (no throttle)',
    description: '10 guesses/second — unthrottled login',
  },
  {
    key: 'offlineSlowHashing1e4PerSecond',
    label: 'Offline (slow hash)',
    description: '10⁴ guesses/second — bcrypt/scrypt/PBKDF2',
  },
  {
    key: 'offlineFastHashing1e10PerSecond',
    label: 'Offline (fast hash)',
    description: '10¹⁰ guesses/second — SHA-1/SHA-256/MD5',
  },
];

/** A single crack-time scenario with its display string + seconds value. */
export interface CrackTimeEntry {
  key: CrackScenarioKey;
  label: string;
  description: string;
  /** Human-readable duration from zxcvbn (e.g. "3 hours", "centuries"). */
  display: string;
  /** Estimated seconds (raw number from zxcvbn). */
  seconds: number;
}

/** Feedback returned by zxcvbn to guide the user towards a stronger password. */
export interface PasswordFeedback {
  /** A warning string, or `null` when zxcvbn has no warning. */
  warning: string | null;
  /** Actionable suggestions (may be empty). */
  suggestions: string[];
}

/** Full analysis result produced by `analyzePassword`. */
export interface PasswordAnalysis {
  /** The password that was analysed. */
  password: string;
  /** zxcvbn score band (0-4). */
  score: PasswordScore;
  /** Estimated guesses needed to crack. */
  guesses: number;
  /** Order of magnitude of `guesses` (log10). */
  guessesLog10: number;
  /** Entropy estimate in bits (derived from `guessesLog10`). */
  entropyBits: number;
  /** Crack-time display strings + seconds for each attack scenario. */
  crackTimes: CrackTimeEntry[];
  /** Verbal feedback (warning + suggestions). */
  feedback: PasswordFeedback;
  /** Time zxcvbn spent computing, in ms. */
  calcTime: number;
}

/** Cached lazily-loaded zxcvbn module bundle (shared across all calls). */
type ZxcvbnCoreModule = typeof import('@zxcvbn-ts/core');
interface ZxcvbnBundle {
  zxcvbn: ZxcvbnCoreModule['zxcvbn'];
  zxcvbnOptions: ZxcvbnCoreModule['zxcvbnOptions'];
}

/** Minimal structural type matching `@zxcvbn-ts/core`'s `ZxcvbnResult`. */
interface ZxcvbnRawResult {
  score: PasswordScore;
  guesses: number;
  guessesLog10: number;
  crackTimesSeconds: Record<CrackScenarioKey, number>;
  crackTimesDisplay: Record<CrackScenarioKey, string>;
  feedback: { warning: string | null; suggestions: string[] };
  calcTime: number;
  sequence: unknown[];
  password: string;
}

let cachedBundle: ZxcvbnBundle | null = null;
let optionsConfigured = false;

/**
 * Dynamically import + cache the `@zxcvbn-ts` packages. The three packages are
 * imported together (they share the same chunk graph) and the options are
 * configured exactly once on first load. Safe to call repeatedly.
 */
export async function ensureZxcvbnModule(): Promise<ZxcvbnBundle> {
  if (cachedBundle && optionsConfigured) return cachedBundle;

  const [core, common, en] = await Promise.all([
    import('@zxcvbn-ts/core'),
    import('@zxcvbn-ts/language-common'),
    import('@zxcvbn-ts/language-en'),
  ]);

  const bundle: ZxcvbnBundle = {
    zxcvbn: core.zxcvbn,
    zxcvbnOptions: core.zxcvbnOptions,
  };

  // Configure dictionaries / graphs / translations once. The language packages
  // export `dictionary`, `adjacencyGraphs`, and `translations`.
  bundle.zxcvbnOptions.setOptions({
    dictionary: {
      ...(common.dictionary as Record<string, (string | number)[]>),
      ...(en.dictionary as Record<string, (string | number)[]>),
    },
    graphs: common.adjacencyGraphs,
    translations: en.translations,
    useLevenshteinDistance: true,
  });
  cachedBundle = bundle;
  optionsConfigured = true;
  return bundle;
}

/**
 * Format a raw seconds value into a compact human-readable duration. Used as a
 * fallback when zxcvbn's own `display` string is unavailable, and exposed for
 * unit testing. Produces strings like "instant", "3 minutes", "2 days",
 * "centuries".
 */
export function formatCrackTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '—';
  if (seconds < 1) return 'instant';
  const units: [number, string][] = [
    [60, 'second'],
    [60, 'minute'],
    [24, 'hour'],
    [365, 'day'],
    [100, 'year'],
    [Infinity, 'century'],
  ];
  let value = seconds;
  let unit = 'second';
  for (const [factor, name] of units) {
    if (value < factor) {
      unit = name;
      break;
    }
    value /= factor;
    unit = name;
  }
  const rounded = Math.round(value);
  if (unit === 'century' && rounded >= 100) return 'centuries';
  if (unit === 'century') return `${rounded} century${rounded === 1 ? '' : 'ies'}`;
  return `${rounded} ${unit}${rounded === 1 ? '' : 's'}`;
}

/**
 * Analyse a password with zxcvbn and return a structured result. Returns
 * `null` when `password` is empty (nothing to analyse).
 *
 * Optional `userInputs` are extra user-context strings (email, username, app
 * name) fed to zxcvbn so it can penalise passwords containing them.
 */
export async function analyzePassword(
  password: string,
  userInputs: (string | number)[] = [],
): Promise<PasswordAnalysis | null> {
  if (password.length === 0) return null;
  const { zxcvbn } = await ensureZxcvbnModule();
  const raw: ZxcvbnRawResult = zxcvbn(password, userInputs);

  const crackTimes: CrackTimeEntry[] = CRACK_SCENARIOS.map((s) => ({
    key: s.key,
    label: s.label,
    description: s.description,
    display: raw.crackTimesDisplay[s.key] ?? formatCrackTime(raw.crackTimesSeconds[s.key]),
    seconds: raw.crackTimesSeconds[s.key] ?? 0,
  }));

  return {
    password,
    score: raw.score,
    guesses: raw.guesses,
    guessesLog10: raw.guessesLog10,
    entropyBits: guessesToEntropyBits(raw.guessesLog10),
    crackTimes,
    feedback: {
      warning: raw.feedback.warning,
      suggestions: raw.feedback.suggestions,
    },
    calcTime: raw.calcTime,
  };
}

/* -------------------------------------------------------------------------- */
/* Composable — reactive state + embed integration                            */
/* -------------------------------------------------------------------------- */

export interface UsePasswordStrengthReturn {
  password: Ref<string>;
  userInputs: Ref<string>;
  analysis: Ref<PasswordAnalysis | null>;
  analyzing: Ref<boolean>;
  error: Ref<string>;
  isEmbed: Ref<boolean>;
  input: Ref<EmbedInputPayload | null>;
  recompute: () => void;
}

/** Debounce window (ms) for recomputing on input changes. */
const DEBOUNCE_MS = 200;
/** Skip auto-recompute for passwords longer than this (manual button). */
const LARGE_INPUT_THRESHOLD = 4096;

export function usePasswordStrength(): UsePasswordStrengthReturn {
  const password = ref<string>('');
  const userInputs = ref<string>('');
  const analysis = ref<PasswordAnalysis | null>(null);
  const analyzing = ref<boolean>(false);
  const error = ref<string>('');

  let debounceTimer: ReturnType<typeof setTimeout> | undefined;
  let runToken = 0;

  async function run(): Promise<void> {
    const pw = password.value;
    if (pw.length === 0) {
      analysis.value = null;
      error.value = '';
      analyzing.value = false;
      return;
    }
    if (pw.length > LARGE_INPUT_THRESHOLD) {
      error.value = 'Password is very long — click "Analyse" to evaluate manually.';
      return;
    }
    const token = ++runToken;
    analyzing.value = true;
    error.value = '';
    try {
      const inputs = userInputs.value.trim().length > 0
        ? userInputs.value.split(/[\s,]+/).filter(Boolean)
        : [];
      const out = await analyzePassword(pw, inputs);
      if (token === runToken) analysis.value = out;
    } catch (e) {
      if (token === runToken) {
        error.value = e instanceof Error ? e.message : String(e);
        analysis.value = null;
      }
    } finally {
      if (token === runToken) analyzing.value = false;
    }
  }

  function scheduleRun(): void {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = undefined;
      void run();
    }, DEBOUNCE_MS);
  }

  function recompute(): void {
    error.value = '';
    void run();
  }

  // Recompute (debounced) whenever inputs change.
  watch(password, scheduleRun);
  watch(userInputs, scheduleRun);

  const { isEmbed, input, sendOutput } = useEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.password === 'string') password.value = p.password;
      if (typeof p.userInputs === 'string') userInputs.value = p.userInputs;
    },
  });

  // Relay output to the parent whenever the analysis changes (embed mode only).
  watch(analysis, (a) => {
    if (isEmbed.value) {
      sendOutput(
        a
          ? {
              score: a.score,
              guesses: a.guesses,
              guessesLog10: a.guessesLog10,
              entropyBits: a.entropyBits,
              crackTimes: a.crackTimes,
              feedback: a.feedback,
            }
          : { score: 0, guesses: 0, guessesLog10: 0, entropyBits: 0 },
      );
    }
  });

  return {
    password,
    userInputs,
    analysis,
    analyzing,
    error,
    isEmbed,
    input,
    recompute,
  };
}
