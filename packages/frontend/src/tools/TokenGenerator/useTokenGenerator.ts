/**
 * useTokenGenerator - composable + pure logic for the Token generator tool.
 *
 * The pure functions (`buildCharset`, `secureRandomInt`, `generateToken`,
 * `generateTokens`) have no Vue dependency and can be imported standalone for
 * unit testing or reuse. The `useTokenGenerator()` composable wraps them in
 * reactive state and wires up the embed PostMessage protocol.
 *
 * Randomness uses the Web Crypto API (`crypto.getRandomValues`) with rejection
 * sampling to avoid modulo bias - never `Math.random()`.
 */
import { computed, ref, watch, type ComputedRef, type Ref } from 'vue';
import { useEmbed } from '@/composables/useEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Pure logic - no Vue dependency below this point                            */
/* -------------------------------------------------------------------------- */

export const CHARSET_LOWER = 'abcdefghijklmnopqrstuvwxyz';
export const CHARSET_UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
export const CHARSET_NUMBERS = '0123456789';
export const CHARSET_SYMBOLS = '!@#$%^&*()-_=+[]{};:,.?/~';
/** Characters that are easily confused with one another (l/1/I, 0/O, etc). */
export const AMBIGUOUS_CHARS = 'Il1O0o';

/** Minimum/maximum bounds (from milestone.md acceptance criteria). */
export const MIN_LENGTH = 1;
export const MAX_LENGTH = 512;
export const MIN_QUANTITY = 1;
export const MAX_QUANTITY = 1000;

export interface TokenGeneratorConfig {
  /** Token length (1-512). */
  length: number;
  /** Number of tokens to generate (1-1000). */
  quantity: number;
  /** Include lowercase letters a-z. */
  lowercase: boolean;
  /** Include uppercase letters A-Z. */
  uppercase: boolean;
  /** Include digits 0-9. */
  numbers: boolean;
  /** Include common symbols. */
  symbols: boolean;
  /** Use the `customCharset` string verbatim instead of the preset flags. */
  useCustom: boolean;
  /** User-supplied charset (used when `useCustom` is true). */
  customCharset: string;
  /** Drop ambiguous characters (l, 1, I, 0, O, o) from the charset. */
  excludeAmbiguous: boolean;
}

export const DEFAULT_CONFIG: TokenGeneratorConfig = {
  length: 32,
  quantity: 1,
  lowercase: true,
  uppercase: true,
  numbers: true,
  symbols: false,
  useCustom: false,
  customCharset: '',
  excludeAmbiguous: false,
};

/** Build the effective charset string from the config. */
export function buildCharset(cfg: TokenGeneratorConfig): string {
  if (cfg.useCustom) return cfg.customCharset;
  let s = '';
  if (cfg.lowercase) s += CHARSET_LOWER;
  if (cfg.uppercase) s += CHARSET_UPPER;
  if (cfg.numbers) s += CHARSET_NUMBERS;
  if (cfg.symbols) s += CHARSET_SYMBOLS;
  if (cfg.excludeAmbiguous) {
    s = Array.from(s)
      .filter((c) => !AMBIGUOUS_CHARS.includes(c))
      .join('');
  }
  return s;
}

/**
 * Cryptographically secure uniform random integer in `[0, max)` using
 * rejection sampling to eliminate modulo bias.
 */
export function secureRandomInt(max: number): number {
  if (max <= 0) throw new Error('secureRandomInt: max must be > 0');
  if (max === 1) return 0;
  // There are 2^32 possible uint32 values (0 .. 2^32-1). To pick a uniformly
  // distributed value in [0, max), reject any value >= the largest multiple of
  // `max` that fits in the 2^32 range. This eliminates modulo bias.
  const range = 0x100000000; // 2^32
  const threshold = range - (range % max);
  const buf = new Uint32Array(1);
  // Rejection sampling loop - expected iterations ~1.x, worst case rare.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    crypto.getRandomValues(buf);
    const v = buf[0];
    if (v === undefined) continue;
    if (v < threshold) return v % max;
  }
}

/** Generate a single token of `length` characters drawn from `charset`. */
export function generateToken(length: number, charset: string): string {
  if (length < 1) return '';
  if (charset.length === 0) return '';
  const chars = Array.from(charset);
  let out = '';
  for (let i = 0; i < length; i++) {
    out += chars[secureRandomInt(chars.length)] ?? '';
  }
  return out;
}

/** Generate `quantity` tokens according to the supplied config. */
export function generateTokens(cfg: TokenGeneratorConfig): string[] {
  const charset = buildCharset(cfg);
  if (charset.length === 0) return [];
  const tokens: string[] = [];
  for (let i = 0; i < cfg.quantity; i++) {
    tokens.push(generateToken(cfg.length, charset));
  }
  return tokens;
}

/* -------------------------------------------------------------------------- */
/* Composable - reactive state + embed integration                            */
/* -------------------------------------------------------------------------- */

/** Clamp a number into `[min, max]`. */
function clamp(n: number, min: number, max: number): number {
  if (Number.isNaN(n)) return min;
  return Math.min(max, Math.max(min, n));
}

export interface UseTokenGeneratorReturn {
  config: Ref<TokenGeneratorConfig>;
  tokens: Ref<string[]>;
  error: Ref<string>;
  charset: ComputedRef<string>;
  isValid: ComputedRef<boolean>;
  regenerate: () => void;
  isEmbed: Ref<boolean>;
  input: Ref<EmbedInputPayload | null>;
}

export function useTokenGenerator(): UseTokenGeneratorReturn {
  const config = ref<TokenGeneratorConfig>({ ...DEFAULT_CONFIG });
  const tokens = ref<string[]>([]);
  const error = ref<string>('');

  const charset = computed(() => buildCharset(config.value));
  const isValid = computed(() => {
    const cfg = config.value;
    if (cfg.length < MIN_LENGTH || cfg.length > MAX_LENGTH) return false;
    if (cfg.quantity < MIN_QUANTITY || cfg.quantity > MAX_QUANTITY) return false;
    if (cfg.useCustom && cfg.customCharset.length === 0) return false;
    if (!cfg.useCustom && charset.value.length === 0) return false;
    return true;
  });

  function regenerate(): void {
    if (!isValid.value) {
      const cfg = config.value;
      if (cfg.length < MIN_LENGTH || cfg.length > MAX_LENGTH) {
        error.value = `Length must be between ${MIN_LENGTH} and ${MAX_LENGTH}.`;
      } else if (cfg.quantity < MIN_QUANTITY || cfg.quantity > MAX_QUANTITY) {
        error.value = `Quantity must be between ${MIN_QUANTITY} and ${MAX_QUANTITY}.`;
      } else if (cfg.useCustom && cfg.customCharset.length === 0) {
        error.value = 'Custom charset is empty.';
      } else {
        error.value = 'Select at least one character set.';
      }
      tokens.value = [];
      return;
    }
    error.value = '';
    tokens.value = generateTokens(config.value);
  }

  const { isEmbed, input, sendOutput } = useEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      const next = { ...config.value };
      if (typeof p.length === 'number') next.length = clamp(p.length, MIN_LENGTH, MAX_LENGTH);
      if (typeof p.quantity === 'number') next.quantity = clamp(p.quantity, MIN_QUANTITY, MAX_QUANTITY);
      if (typeof p.lowercase === 'boolean') next.lowercase = p.lowercase;
      if (typeof p.uppercase === 'boolean') next.uppercase = p.uppercase;
      if (typeof p.numbers === 'boolean') next.numbers = p.numbers;
      if (typeof p.symbols === 'boolean') next.symbols = p.symbols;
      if (typeof p.useCustom === 'boolean') next.useCustom = p.useCustom;
      if (typeof p.customCharset === 'string') next.customCharset = p.customCharset;
      if (typeof p.excludeAmbiguous === 'boolean') next.excludeAmbiguous = p.excludeAmbiguous;
      config.value = next;
      regenerate();
    },
  });

  // Relay output to the parent whenever tokens change (embed mode only).
  watch(tokens, (t) => {
    if (isEmbed.value) sendOutput({ tokens: t });
  });

  return { config, tokens, error, charset, isValid, regenerate, isEmbed, input };
}
