/**
 * useUlidGenerator — composable + pure logic for the ULID generator tool.
 *
 * Generates ULIDs (Universally Unique Lexicographically Sortable Identifiers,
 * https://github.com/ulid/spec). A ULID is a 26-character Crockford Base32
 * string whose first 10 characters encode a millisecond timestamp (48 bits,
 * good until ~10889 AD) and the remaining 16 characters are random.
 *
 * The `ulid` package is dynamically imported inside the pure helpers so Vite
 * emits it as a separate chunk (lazy-loaded only when the tool is opened).
 *
 * Randomness: the `ulid` package defaults to `Math.random()`, which is NOT
 * cryptographically secure. We inject a PRNG backed by
 * `crypto.getRandomValues()` so every ULID is unpredictable. The PRNG contract
 * is `() => number` returning a fraction in `[0, 1)` — we build it from a
 * 32-bit random unsigned integer divided by `2^32`.
 *
 * Two generation modes:
 *   - standard: each ULID is independent (random tail, even within the same
 *     millisecond).
 *   - monotonic: within the same millisecond, successive ULIDs are guaranteed
 *     to be lexicographically increasing (random tail is incremented by 1).
 *     Uses `ulid`'s `monotonicFactory` with the secure PRNG.
 *
 * The pure helpers (`createSecurePrng`, `generateUlid`, `generateUlids`,
 * `decodeUlidTime`, `isValidUlid`) have no Vue dependency and can be imported
 * standalone for unit testing or reuse. The `useUlidGenerator()` composable
 * wraps them in reactive state and wires up the embed PostMessage protocol.
 */
import { ref, watch, type Ref } from 'vue';
import { useEmbed } from '@/composables/useEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Pure logic — no Vue dependency below this point                            */
/* -------------------------------------------------------------------------- */

/** Quantity bounds (from milestone.md acceptance criteria). */
export const MIN_QUANTITY = 1;
export const MAX_QUANTITY = 10000;
export const DEFAULT_QUANTITY = 1;

/** ULID length (10 timestamp + 16 random characters). */
export const ULID_LENGTH = 26;
/** Timestamp portion length (first 10 chars). */
export const ULID_TIME_LENGTH = 10;
/** Random portion length (last 16 chars). */
export const ULID_RANDOM_LENGTH = 16;

/**
 * ULID regex (Crockford Base32). The first character must be 0-7 so the
 * 48-bit timestamp never overflows. Case-insensitive.
 */
export const ULID_RE = /^[0-7][0-9a-hjkmnp-tv-zA-HJKMNP-TV-Z]{25}$/;

/** Check whether `value` is a valid ULID string. */
export function isValidUlid(value: string): boolean {
  return ULID_RE.test(value);
}

/**
 * Create a cryptographically secure PRNG compatible with the `ulid` package's
 * `PRNG = () => number` contract. Returns a function that yields a fraction in
 * `[0, 1)` drawn from `crypto.getRandomValues`. Throws if no secure PRNG is
 * available (e.g. non-secure context in old browsers).
 */
export function createSecurePrng(): () => number {
  if (typeof crypto === 'undefined' || typeof crypto.getRandomValues !== 'function') {
    throw new Error('crypto.getRandomValues is not available in this environment');
  }
  const buf = new Uint32Array(1);
  return () => {
    crypto.getRandomValues(buf);
    // buf[0] is a uint32 in [0, 2^32 - 1]; divide by 2^32 to get [0, 1).
    return buf[0]! / 0x100000000;
  };
}

/** Generation mode. */
export type UlidMode = 'standard' | 'monotonic';

/** Options for `generateUlid` / `generateUlids`. */
export interface GenerateUlidOptions {
  /** Standard (independent) or monotonic (lex-increasing within a ms). */
  mode: UlidMode;
  /** Optional timestamp seed (ms since epoch). Defaults to `Date.now()`. */
  timestamp?: number;
  /** PRNG to use. If omitted, a fresh secure PRNG is created. */
  prng?: () => number;
}

/** Result of a single ULID generation. */
export interface UlidResult {
  /** The 26-character ULID (lowercase, unless formatted by the caller). */
  ulid: string;
  /** Decoded timestamp (ms since epoch). */
  timestamp: number;
}

/**
 * Generate a single ULID. The `ulid` package is dynamically imported so it lands
 * in its own Vite chunk. In monotonic mode a fresh `monotonicFactory` is built
 * per call (so each invocation starts from the current time); for batch
 * generation with monotonic ordering across the batch, use `generateUlids`.
 */
export async function generateUlid(options: GenerateUlidOptions): Promise<UlidResult> {
  const { mode, timestamp, prng } = options;
  const ulidModule = await ensureUlidModule();
  const prngFn = prng ?? createSecurePrng();
  const seedTime = timestamp ?? Date.now();

  let id: string;
  if (mode === 'monotonic') {
    const factory = ulidModule.monotonicFactory(prngFn);
    id = factory(seedTime);
  } else {
    id = ulidModule.ulid(seedTime, prngFn);
  }

  return { ulid: id, timestamp: decodeUlidTime(id) };
}

/**
 * Generate `quantity` ULIDs. In monotonic mode a single `monotonicFactory` is
 * reused across the whole batch so successive ULIDs within the same
 * millisecond are guaranteed to be lexicographically increasing. Returns the
 * formatted ULID strings (no timestamp — callers that need it can call
 * `decodeUlidTime`).
 */
export async function generateUlids(
  quantity: number,
  options: GenerateUlidOptions,
): Promise<string[]> {
  if (
    !Number.isInteger(quantity) ||
    quantity < MIN_QUANTITY ||
    quantity > MAX_QUANTITY
  ) {
    throw new Error(
      `Quantity must be an integer between ${MIN_QUANTITY} and ${MAX_QUANTITY}`,
    );
  }
  const { mode, timestamp, prng } = options;
  const ulidModule = await ensureUlidModule();
  const prngFn = prng ?? createSecurePrng();

  const out: string[] = [];
  if (mode === 'monotonic') {
    const factory = ulidModule.monotonicFactory(prngFn);
    const seedTime = timestamp ?? Date.now();
    for (let i = 0; i < quantity; i++) {
      // Pass the same seedTime; monotonicFactory guarantees ordering within a
      // millisecond by incrementing the random tail when the time repeats.
      out.push(factory(seedTime));
    }
  } else {
    const seedTime = timestamp ?? Date.now();
    for (let i = 0; i < quantity; i++) {
      out.push(ulidModule.ulid(seedTime, prngFn));
    }
  }
  return out;
}

/**
 * Decode the 10-character timestamp prefix of a ULID into a millisecond
 * timestamp (ms since the Unix epoch). Throws if the ULID is malformed.
 */
export function decodeUlidTime(id: string): number {
  const ulidModuleNs = getUlidModuleSync();
  return ulidModuleNs.decodeTime(id);
}

/**
 * Synchronous accessor for the `ulid` module. The module is imported
 * dynamically elsewhere; this helper exists so `decodeUlidTime` / `isValid`
 * can be called without awaiting. We cache the resolved module on first use.
 *
 * NOTE: `decodeTime` and `isValid` are pure functions (no PRNG), so reusing a
 * cached module instance is safe. If the module has not been imported yet,
 * this throws — callers should ensure `generateUlid`/`generateUlids` has run
 * at least once, or use the async `ensureUlidModule` helper below.
 */
let cachedUlidModule: typeof import('ulid') | null = null;

/** Resolve and cache the `ulid` module (async). Safe to call repeatedly. */
export async function ensureUlidModule(): Promise<typeof import('ulid')> {
  if (!cachedUlidModule) {
    cachedUlidModule = await import('ulid');
  }
  return cachedUlidModule;
}

function getUlidModuleSync(): typeof import('ulid') {
  if (!cachedUlidModule) {
    throw new Error(
      'ulid module not loaded yet — call ensureUlidModule() or generateUlid() first',
    );
  }
  return cachedUlidModule;
}

/* -------------------------------------------------------------------------- */
/* Composable — reactive state + embed integration                            */
/* -------------------------------------------------------------------------- */

export interface UseUlidGeneratorReturn {
  mode: Ref<UlidMode>;
  quantity: Ref<number>;
  uppercase: Ref<boolean>;
  /** Generated ULID strings (formatted per `uppercase`). */
  ulids: Ref<string[]>;
  /** Decoded timestamps aligned with `ulids` (null while loading). */
  timestamps: Ref<number[]>;
  generating: Ref<boolean>;
  error: Ref<string>;
  isEmbed: Ref<boolean>;
  input: Ref<EmbedInputPayload | null>;
  generate: () => Promise<void>;
}

export function useUlidGenerator(): UseUlidGeneratorReturn {
  const mode = ref<UlidMode>('standard');
  const quantity = ref<number>(DEFAULT_QUANTITY);
  const uppercase = ref<boolean>(false);
  const ulids = ref<string[]>([]);
  const timestamps = ref<number[]>([]);
  const generating = ref<boolean>(false);
  const error = ref<string>('');

  async function generate(): Promise<void> {
    error.value = '';
    generating.value = true;
    try {
      // Make sure the module is cached so decodeUlidTime works synchronously
      // right after generation.
      await ensureUlidModule();
      const result = await generateUlids(quantity.value, {
        mode: mode.value,
      });
      // The `ulid` package emits uppercase by default. We normalise to
      // lowercase and only upper-case when the user opts in, so the toggle is
      // meaningful (mirrors the UUID generator's "uppercase is opt-in" UX).
      const formatted = uppercase.value
        ? result.map((u) => u.toUpperCase())
        : result.map((u) => u.toLowerCase());
      ulids.value = formatted;
      timestamps.value = formatted.map((u) => decodeUlidTime(u));
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e);
      ulids.value = [];
      timestamps.value = [];
    } finally {
      generating.value = false;
    }
  }

  const { isEmbed, input, sendOutput } = useEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (
        typeof p.mode === 'string' &&
        (p.mode === 'standard' || p.mode === 'monotonic')
      ) {
        mode.value = p.mode as UlidMode;
      }
      if (
        typeof p.quantity === 'number' &&
        p.quantity >= MIN_QUANTITY &&
        p.quantity <= MAX_QUANTITY
      ) {
        quantity.value = Math.floor(p.quantity);
      }
      if (typeof p.uppercase === 'boolean') uppercase.value = p.uppercase;
      if (p.generate === true) {
        void generate();
      }
    },
  });

  // Relay output to the parent whenever the generated list changes (embed only).
  watch(ulids, (list) => {
    if (!isEmbed.value) return;
    sendOutput({ ulids: list });
  });

  return {
    mode,
    quantity,
    uppercase,
    ulids,
    timestamps,
    generating,
    error,
    isEmbed,
    input,
    generate,
  };
}
