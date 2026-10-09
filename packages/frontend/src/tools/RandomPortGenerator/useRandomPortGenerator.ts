/**
 * useRandomPortGenerator - composable + pure logic for the Random port
 * generator tool.
 *
 * Generates cryptographically secure random TCP/UDP port numbers in a
 * user-configurable range, with an "exclude well-known ports (<1024)" toggle
 * and a quantity control. Randomness uses the Web Crypto API
 * (`crypto.getRandomValues`) with rejection sampling to avoid modulo bias -
 * never `Math.random()`.
 *
 * The pure functions (`secureRandomIntInRange`, `generatePort`,
 * `generatePorts`, `validateConfig`) have no Vue dependency and can be
 * imported standalone for unit testing or reuse. The
 * `useRandomPortGenerator()` composable wraps them in reactive state and
 * wires up the embed PostMessage protocol.
 *
 * No external dependencies.
 */
import { computed, ref, watch, type ComputedRef, type Ref } from 'vue';
import { useEmbed } from '@/composables/useEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Pure logic - no Vue dependency below this point                            */
/* -------------------------------------------------------------------------- */

/** Minimum/maximum TCP/UDP port numbers (IANA range). */
export const PORT_MIN = 0;
export const PORT_MAX = 65535;
/** Boundary for "well-known" ports (0-1023). */
export const WELL_KNOWN_BOUNDARY = 1024;
/** Default minimum when excluding well-known ports. */
export const DEFAULT_MIN = WELL_KNOWN_BOUNDARY;
/** Default maximum. */
export const DEFAULT_MAX = PORT_MAX;
/** Quantity bounds (matches TokenGenerator for consistency). */
export const MIN_QUANTITY = 1;
export const MAX_QUANTITY = 1000;

export interface RandomPortConfig {
  /** Inclusive lower bound of the port range. */
  min: number;
  /** Inclusive upper bound of the port range. */
  max: number;
  /** When true, force `min` to be at least 1024 (exclude well-known ports). */
  excludeWellKnown: boolean;
  /** Number of ports to generate (1-1000). */
  quantity: number;
  /** When true, generated ports are unique (no duplicates). */
  unique: boolean;
}

export const DEFAULT_CONFIG: RandomPortConfig = {
  min: DEFAULT_MIN,
  max: DEFAULT_MAX,
  excludeWellKnown: true,
  quantity: 5,
  unique: true,
};

export type ConfigErrorCode =
  | 'min-out-of-range'
  | 'max-out-of-range'
  | 'min-gt-max'
  | 'quantity-out-of-range'
  | 'range-too-small-for-unique';

export interface ConfigValidation {
  ok: boolean;
  /** Normalised (clamped + well-known-adjusted) config. */
  normalized: RandomPortConfig;
  code: ConfigErrorCode | null;
  message: string;
}

/** Clamp a number into `[lo, hi]`; NaN → `lo`. */
export function clamp(n: number, lo: number, hi: number): number {
  if (Number.isNaN(n)) return lo;
  return Math.min(hi, Math.max(lo, n));
}

/**
 * Normalise + validate a config.
 *
 * - Clamps `min`/`max` into `[PORT_MIN, PORT_MAX]`.
 * - When `excludeWellKnown` is true, lifts `min` to `WELL_KNOWN_BOUNDARY`.
 * - Ensures `min <= max`.
 * - Clamps `quantity` into `[MIN_QUANTITY, MAX_QUANTITY]`.
 * - When `unique` is true, verifies the range can supply `quantity` distinct
 *   ports.
 */
export function validateConfig(cfg: RandomPortConfig): ConfigValidation {
  const normalized: RandomPortConfig = {
    ...cfg,
    min: clamp(cfg.min, PORT_MIN, PORT_MAX),
    max: clamp(cfg.max, PORT_MIN, PORT_MAX),
    quantity: clamp(cfg.quantity, MIN_QUANTITY, MAX_QUANTITY),
  };
  if (normalized.excludeWellKnown && normalized.min < WELL_KNOWN_BOUNDARY) {
    normalized.min = WELL_KNOWN_BOUNDARY;
  }
  if (normalized.max < WELL_KNOWN_BOUNDARY && normalized.excludeWellKnown) {
    // The whole range is below the well-known boundary - lift max too so the
    // range is non-empty (single port 1024).
    normalized.max = WELL_KNOWN_BOUNDARY;
  }

  if (normalized.min < PORT_MIN || normalized.min > PORT_MAX) {
    return {
      ok: false,
      normalized,
      code: 'min-out-of-range',
      message: `Minimum port must be between ${PORT_MIN} and ${PORT_MAX}.`,
    };
  }
  if (normalized.max < PORT_MIN || normalized.max > PORT_MAX) {
    return {
      ok: false,
      normalized,
      code: 'max-out-of-range',
      message: `Maximum port must be between ${PORT_MIN} and ${PORT_MAX}.`,
    };
  }
  if (normalized.min > normalized.max) {
    return {
      ok: false,
      normalized,
      code: 'min-gt-max',
      message: 'Minimum port must be less than or equal to the maximum port.',
    };
  }
  if (
    normalized.quantity < MIN_QUANTITY ||
    normalized.quantity > MAX_QUANTITY
  ) {
    return {
      ok: false,
      normalized,
      code: 'quantity-out-of-range',
      message: `Quantity must be between ${MIN_QUANTITY} and ${MAX_QUANTITY}.`,
    };
  }
  if (normalized.unique) {
    const span = normalized.max - normalized.min + 1;
    if (span < normalized.quantity) {
      return {
        ok: false,
        normalized,
        code: 'range-too-small-for-unique',
        message: `Range (${span} port${span === 1 ? '' : 's'}) is too small for ${normalized.quantity} unique port${normalized.quantity === 1 ? '' : 's'}. Increase the range or disable "unique".`,
      };
    }
  }
  return { ok: true, normalized, code: null, message: '' };
}

/**
 * Cryptographically secure uniform random integer in the closed interval
 * `[min, max]` using rejection sampling to eliminate modulo bias.
 *
 * Uses `crypto.getRandomValues` with a Uint32Array. The rejection threshold
 * is the largest multiple of `range` that fits in `2^32`, so every accepted
 * value maps uniformly onto `[0, range)`.
 */
export function secureRandomIntInRange(min: number, max: number): number {
  if (max < min) throw new Error('secureRandomIntInRange: max must be >= min');
  const range = max - min + 1;
  if (range === 1) return min;
  // 2^32 possible uint32 values.
  const full = 0x100000000;
  const threshold = full - (full % range);
  const buf = new Uint32Array(1);
  // Rejection sampling loop - expected iterations ~1.x.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    crypto.getRandomValues(buf);
    const v = buf[0];
    if (v === undefined) continue;
    if (v < threshold) return min + (v % range);
  }
}

/** Generate a single port within the (already-validated) config range. */
export function generatePort(cfg: RandomPortConfig): number {
  return secureRandomIntInRange(cfg.min, cfg.max);
}

/**
 * Generate `quantity` ports according to the supplied config.
 *
 * When `unique` is true, ports are drawn without replacement (Fisher–Yates
 * style partial shuffle over the range when the range is small, otherwise
 * rejection-sampled with a Set). The small-range path avoids pathological
 * rejection loops when `quantity` is close to the range size.
 */
export function generatePorts(cfg: RandomPortConfig): number[] {
  const v = validateConfig(cfg);
  if (!v.ok) return [];
  const c = v.normalized;
  const span = c.max - c.min + 1;

  if (!c.unique) {
    const out: number[] = [];
    for (let i = 0; i < c.quantity; i++) out.push(generatePort(c));
    return out;
  }

  // Unique mode.
  if (span <= 65536) {
    // Small range - partial Fisher–Yates shuffle. Build the index array once.
    // For very large spans this would be heavy on memory, so we cap the
    // array-building path at the full TCP/UDP range (65536 entries = 256KB).
    const pool = new Array<number>(span);
    for (let i = 0; i < span; i++) pool[i] = c.min + i;
    // Partial shuffle: swap each of the first `quantity` slots with a random
    // slot at or beyond the current index.
    for (let i = 0; i < c.quantity; i++) {
      const j = i + secureRandomIntInRange(0, span - 1 - i);
      const tmp = pool[i];
      pool[i] = pool[j] ?? 0;
      pool[j] = tmp ?? 0;
    }
    return pool.slice(0, c.quantity);
  }

  // Large range + unique - rejection-sample into a Set. With a huge range the
  // collision probability is negligible so this is effectively O(quantity).
  const seen = new Set<number>();
  while (seen.size < c.quantity) {
    seen.add(generatePort(c));
  }
  return Array.from(seen);
}

/* -------------------------------------------------------------------------- */
/* Composable - reactive state + embed integration                            */
/* -------------------------------------------------------------------------- */

export interface UseRandomPortGeneratorReturn {
  config: Ref<RandomPortConfig>;
  ports: Ref<number[]>;
  error: Ref<string>;
  validation: ComputedRef<ConfigValidation>;
  isValid: ComputedRef<boolean>;
  effectiveRange: ComputedRef<{ min: number; max: number; span: number }>;
  regenerate: () => void;
  isEmbed: Ref<boolean>;
  input: Ref<EmbedInputPayload | null>;
}

export function useRandomPortGenerator(): UseRandomPortGeneratorReturn {
  const config = ref<RandomPortConfig>({ ...DEFAULT_CONFIG });
  const ports = ref<number[]>([]);
  const error = ref<string>('');

  const validation = computed(() => validateConfig(config.value));
  const isValid = computed(() => validation.value.ok);
  const effectiveRange = computed(() => {
    const n = validation.value.normalized;
    return { min: n.min, max: n.max, span: n.max - n.min + 1 };
  });

  function regenerate(): void {
    const v = validation.value;
    if (!v.ok) {
      error.value = v.message;
      ports.value = [];
      return;
    }
    error.value = '';
    ports.value = generatePorts(config.value);
  }

  const { isEmbed, input, sendOutput } = useEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      const next = { ...config.value };
      if (typeof p.min === 'number') next.min = clamp(p.min, PORT_MIN, PORT_MAX);
      if (typeof p.max === 'number') next.max = clamp(p.max, PORT_MIN, PORT_MAX);
      if (typeof p.excludeWellKnown === 'boolean')
        next.excludeWellKnown = p.excludeWellKnown;
      if (typeof p.quantity === 'number')
        next.quantity = clamp(p.quantity, MIN_QUANTITY, MAX_QUANTITY);
      if (typeof p.unique === 'boolean') next.unique = p.unique;
      // Convenience aliases.
      if (typeof p.rangeMin === 'number')
        next.min = clamp(p.rangeMin, PORT_MIN, PORT_MAX);
      if (typeof p.rangeMax === 'number')
        next.max = clamp(p.rangeMax, PORT_MIN, PORT_MAX);
      if (typeof p.count === 'number')
        next.quantity = clamp(p.count, MIN_QUANTITY, MAX_QUANTITY);
      config.value = next;
      regenerate();
    },
  });

  // Relay output to the parent whenever ports change (embed mode only).
  watch(ports, (p) => {
    if (isEmbed.value) sendOutput({ ports: p });
  });

  return {
    config,
    ports,
    error,
    validation,
    isValid,
    effectiveRange,
    regenerate,
    isEmbed,
    input,
  };
}
