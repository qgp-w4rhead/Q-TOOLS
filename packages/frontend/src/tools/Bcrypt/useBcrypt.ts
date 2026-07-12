/**
 * useBcrypt — composable + pure logic for the Bcrypt tool.
 *
 * Hash mode: input password + cost factor (4-31) → output `$2a$XX$…` encoded
 * bcrypt hash (60 chars). Salt is 16 random bytes from
 * `crypto.getRandomValues()`.
 *
 * Verify mode: input password + encoded hash → match / no-match.
 *
 * Both operations use `hash-wasm` (`bcrypt` / `bcryptVerify`), which is
 * dynamically imported inside the pure helpers so Vite emits a separate chunk
 * for it (code-splitting / offline caching).
 *
 * The pure helpers (`generateSalt`, `hashPassword`, `verifyPassword`,
 * `parseBcryptHash`) have no Vue dependency and can be imported standalone for
 * unit testing or reuse. The `useBcrypt()` composable wraps them in reactive
 * state and wires up the embed PostMessage protocol.
 */
import { ref, watch, type Ref } from 'vue';
import { useEmbed } from '@/composables/useEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Pure logic — no Vue dependency below this point                            */
/* -------------------------------------------------------------------------- */

/** Tool modes. */
export type BcryptMode = 'hash' | 'verify';

/** Allowed bcrypt cost factor range (2^cost iterations). */
export const MIN_COST = 4;
export const MAX_COST = 31;
/** Default cost factor — a sensible modern default. */
export const DEFAULT_COST = 12;

/** Bcrypt salt length in bytes (fixed by the algorithm). */
export const SALT_BYTES = 16;

/** Length of an encoded bcrypt hash string (`$2a$XX$` + 53 chars). */
export const ENCODED_HASH_LENGTH = 60;

/**
 * Regex matching an encoded bcrypt hash. Accepts the `$2a$`, `$2b$`, `$2y$`
 * prefixes used by various implementations, a two-digit cost factor, and the
 * 22-char base64 salt + 31-char base64 digest.
 */
export const BCRYPT_HASH_RE =
  /^\$2[abxy]\$(\d{2})\$[./A-Za-z0-9]{53}$/;

/**
 * Generate a cryptographically secure random salt (16 bytes) using the Web
 * Crypto API. Returns a `Uint8Array` suitable for `hash-wasm`'s `bcrypt()`.
 */
export function generateSalt(bytes: number = SALT_BYTES): Uint8Array {
  if (!Number.isInteger(bytes) || bytes <= 0) {
    throw new Error(`Invalid salt length: ${bytes}`);
  }
  const salt = new Uint8Array(bytes);
  crypto.getRandomValues(salt);
  return salt;
}

/**
 * Hash `password` with bcrypt at the given `costFactor` (4-31). Returns the
 * encoded hash string in the `$2a$XX$…` format (60 chars).
 *
 * `hash-wasm` is dynamically imported so it lands in its own Vite chunk.
 */
export async function hashPassword(
  password: string,
  costFactor: number = DEFAULT_COST,
  salt: Uint8Array = generateSalt(),
): Promise<string> {
  if (!Number.isInteger(costFactor) || costFactor < MIN_COST || costFactor > MAX_COST) {
    throw new Error(`Cost factor must be an integer between ${MIN_COST} and ${MAX_COST}`);
  }
  const encoded = new TextEncoder().encode(password);
  if (encoded.length < 1) throw new Error('Password must be at least 1 byte long');
  if (encoded.length > 72) throw new Error('Password must be at most 72 bytes long');
  if (salt.length !== SALT_BYTES) {
    throw new Error(`Salt must be ${SALT_BYTES} bytes long`);
  }
  const wasm = await import('hash-wasm');
  return wasm.bcrypt({
    password,
    salt,
    costFactor,
    outputType: 'encoded',
  });
}

/**
 * Verify `password` against an encoded bcrypt `hash` (`$2a$XX$…`). Returns
 * `true` on match, `false` otherwise. Throws on malformed hashes.
 *
 * `hash-wasm` is dynamically imported so it lands in its own Vite chunk.
 */
export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  if (!isValidBcryptHash(hash)) {
    throw new Error('Invalid bcrypt hash format (expected $2a$/$2b$/$2y$XX$…)');
  }
  const wasm = await import('hash-wasm');
  return wasm.bcryptVerify({ password, hash });
}

/** Check whether `hash` looks like a valid encoded bcrypt hash. */
export function isValidBcryptHash(hash: string): boolean {
  return BCRYPT_HASH_RE.test(hash);
}

/** Parse a `$2a$XX$…` encoded hash into its components. */
export interface ParsedBcryptHash {
  /** Full prefix, e.g. `$2a$`. */
  prefix: string;
  /** Variant character (`a`, `b`, `x`, or `y`). */
  variant: 'a' | 'b' | 'x' | 'y';
  /** Cost factor as a number. */
  cost: number;
  /** 22-char base64 salt (without prefix). */
  salt: string;
  /** 31-char base64 digest (without prefix). */
  digest: string;
}

/** Parse an encoded bcrypt hash. Throws if the format is invalid. */
export function parseBcryptHash(hash: string): ParsedBcryptHash {
  const m = BCRYPT_HASH_RE.exec(hash);
  if (!m) throw new Error('Invalid bcrypt hash format');
  const variant = m[0]![3] as 'a' | 'b' | 'x' | 'y';
  const cost = Number(m[1]);
  // After `$2a$XX$` (7 chars) come 22 salt chars + 31 digest chars.
  const tail = hash.slice(7);
  return {
    prefix: `$2${variant}$`,
    variant,
    cost,
    salt: tail.slice(0, 22),
    digest: tail.slice(22, 53),
  };
}

/* -------------------------------------------------------------------------- */
/* Composable — reactive state + embed integration                            */
/* -------------------------------------------------------------------------- */

export interface BcryptHashOutput {
  mode: 'hash';
  hash: string;
  cost: number;
}

export interface BcryptVerifyOutput {
  mode: 'verify';
  match: boolean;
}

export type BcryptOutput = BcryptHashOutput | BcryptVerifyOutput | null;

export interface UseBcryptReturn {
  mode: Ref<BcryptMode>;
  password: Ref<string>;
  /** Cost factor for hash mode. */
  cost: Ref<number>;
  /** Encoded hash input for verify mode / output for hash mode. */
  hash: Ref<string>;
  /** Result of the latest operation (hash string or verify boolean). */
  result: Ref<BcryptOutput>;
  computing: Ref<boolean>;
  error: Ref<string>;
  isEmbed: Ref<boolean>;
  input: Ref<EmbedInputPayload | null>;
  run: () => Promise<void>;
  setMode: (m: BcryptMode) => void;
}

export function useBcrypt(): UseBcryptReturn {
  const mode = ref<BcryptMode>('hash');
  const password = ref<string>('');
  const cost = ref<number>(DEFAULT_COST);
  const hash = ref<string>('');
  const result = ref<BcryptOutput>(null);
  const computing = ref<boolean>(false);
  const error = ref<string>('');

  let runToken = 0;

  async function run(): Promise<void> {
    error.value = '';
    if (mode.value === 'hash') {
      if (password.value.length === 0) {
        result.value = null;
        return;
      }
      const token = ++runToken;
      computing.value = true;
      try {
        const out = await hashPassword(password.value, cost.value);
        if (token === runToken) {
          hash.value = out;
          result.value = { mode: 'hash', hash: out, cost: cost.value };
        }
      } catch (e) {
        if (token === runToken) {
          error.value = e instanceof Error ? e.message : String(e);
          result.value = null;
        }
      } finally {
        if (token === runToken) computing.value = false;
      }
    } else {
      // verify
      if (password.value.length === 0 || hash.value.length === 0) {
        result.value = null;
        return;
      }
      if (!isValidBcryptHash(hash.value)) {
        error.value = 'Invalid bcrypt hash format (expected $2a$/$2b$/$2y$XX$…)';
        result.value = null;
        return;
      }
      const token = ++runToken;
      computing.value = true;
      try {
        const match = await verifyPassword(password.value, hash.value);
        if (token === runToken) {
          result.value = { mode: 'verify', match };
        }
      } catch (e) {
        if (token === runToken) {
          error.value = e instanceof Error ? e.message : String(e);
          result.value = null;
        }
      } finally {
        if (token === runToken) computing.value = false;
      }
    }
  }

  function setMode(m: BcryptMode): void {
    if (m === mode.value) return;
    mode.value = m;
    result.value = null;
    error.value = '';
    // Keep password + hash values across mode switches — they're useful in
    // both modes (hash output feeds verify input).
  }

  const { isEmbed, input, sendOutput } = useEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.mode === 'string' && (p.mode === 'hash' || p.mode === 'verify')) {
        setMode(p.mode);
      }
      if (typeof p.password === 'string') password.value = p.password;
      if (typeof p.hash === 'string') hash.value = p.hash;
      if (typeof p.cost === 'number' && p.cost >= MIN_COST && p.cost <= MAX_COST) {
        cost.value = Math.floor(p.cost);
      }
    },
  });

  // Relay output to the parent whenever the result changes (embed mode only).
  watch(result, (r) => {
    if (!isEmbed.value || r === null) return;
    if (r.mode === 'hash') sendOutput({ hash: r.hash, cost: r.cost });
    else sendOutput({ match: r.match });
  });

  return {
    mode,
    password,
    cost,
    hash,
    result,
    computing,
    error,
    isEmbed,
    input,
    run,
    setMode,
  };
}
