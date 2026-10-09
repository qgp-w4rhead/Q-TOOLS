/**
 * useHtpasswdGenerator - composable + pure logic for the .htpasswd generator
 * tool.
 *
 * Builds `username:hash` lines for Apache/Nginx basic-auth `.htpasswd` files
 * in three schemes:
 *  - bcrypt  `$2y$XX$…` via lazy-loaded `hash-wasm` (`bcrypt`, output swapped
 *    to the `$2y$` variant Apache expects)
 *  - apr1    `$apr1$salt$hash` (Apache MD5) implemented over `hash-wasm`'s
 *    `md5` primitive - the 1000-iteration MD5-crypt variant
 *  - SHA-1   `{SHA}<base64(sha1(pw))>` via Web Crypto (weak, legacy only)
 *
 * Pure helpers have no Vue dependency and can be imported standalone for
 * unit testing or reuse. The `useHtpasswdGenerator()` composable wraps them
 * in reactive state and wires up the embed PostMessage protocol.
 */
import { ref, watch, type Ref } from 'vue';
import { useToolEmbed } from '@/composables/useToolEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Pure logic - no Vue dependency below this point                             */
/* -------------------------------------------------------------------------- */

/** Supported htpasswd hash schemes. */
export type HtpasswdScheme = 'bcrypt' | 'apr1' | 'sha1';

export const HTPASSWD_SCHEMES: Array<{ id: HtpasswdScheme; label: string }> = [
  { id: 'bcrypt', label: 'bcrypt ($2y$) - recommended' },
  { id: 'apr1', label: 'Apache MD5 ($apr1$)' },
  { id: 'sha1', label: 'SHA-1 ({SHA}) - legacy, weak' },
];

/** bcrypt cost bounds (mirrors the Bcrypt tool). */
export const MIN_COST = 4;
export const MAX_COST = 31;
export const DEFAULT_COST = 12;

/** apr1 salt charset (crypt-style base64). */
const APR1_SALT_CHARS =
  './0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
/** apr1 custom base64 alphabet (same set, different order for to64). */
const APR1_B64 = './0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

/** Generate `n` random bytes via CSPRNG. */
export function randomBytes(n: number): Uint8Array {
  const b = new Uint8Array(n);
  crypto.getRandomValues(b);
  return b;
}

/** Generate a random apr1 salt (8 chars from the crypt alphabet). */
export function generateApr1Salt(length = 8): string {
  const bytes = randomBytes(length);
  let s = '';
  for (let i = 0; i < length; i++) {
    s += APR1_SALT_CHARS[bytes[i]! % 64];
  }
  return s;
}

/** crypt-style `to64`: encode `v` as `n` chars of the apr1 alphabet. */
function to64(v: number, n: number): string {
  let s = '';
  let x = v;
  for (let i = 0; i < n; i++) {
    s += APR1_B64[x & 0x3f];
    x >>= 6;
  }
  return s;
}

/** Concat helper for byte arrays. */
function concat(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}

/** hex → bytes. */
function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

/**
 * Apache apr1-MD5 password hash (`$apr1$salt$hash`). Implements the
 * MD5-crypt variant Apache uses, driven by `hash-wasm`'s `md5` (lazy-loaded).
 * Returns the full `$apr1$…` encoded hash.
 */
export async function apr1Hash(password: string, salt?: string): Promise<string> {
  const wasm = await import('hash-wasm');
  const md5 = async (data: Uint8Array): Promise<Uint8Array> =>
    hexToBytes(await wasm.md5(data));

  const enc = new TextEncoder();
  const pw = enc.encode(password);
  const saltStr = (salt ?? generateApr1Salt()).slice(0, 8);
  const saltBytes = enc.encode(saltStr);
  const magic = enc.encode('$apr1$');

  // ctx = pw + magic + salt
  let ctx = concat(pw, magic, saltBytes);
  // final = md5(pw + salt + pw)
  let final = await md5(concat(pw, saltBytes, pw));
  // for i = len(pw); i > 0; i -= 16: ctx += final[0..min(16,i)]
  for (let i = pw.length; i > 0; i -= 16) {
    ctx = concat(ctx, final.subarray(0, Math.min(16, i)));
  }
  // for i = len(pw); i > 0; i >>= 1: odd → \0, even → pw[0]
  for (let i = pw.length; i > 0; i >>= 1) {
    ctx = concat(ctx, i & 1 ? new Uint8Array([0]) : pw.subarray(0, 1));
  }
  final = await md5(ctx);

  // 1000 iterations
  for (let i = 0; i < 1000; i++) {
    let c2: Uint8Array = new Uint8Array(0);
    if (i & 1) c2 = concat(c2, pw);
    else c2 = concat(c2, final);
    if (i % 3 !== 0) c2 = concat(c2, saltBytes);
    if (i % 7 !== 0) c2 = concat(c2, pw);
    if (i & 1) c2 = concat(c2, final);
    else c2 = concat(c2, pw);
    final = await md5(c2);
  }

  // Rearrange final bytes into the apr1 base64 output.
  const encoded =
    to64((final[0]! << 16) | (final[6]! << 8) | final[12]!, 4) +
    to64((final[1]! << 16) | (final[7]! << 8) | final[13]!, 4) +
    to64((final[2]! << 16) | (final[8]! << 8) | final[14]!, 4) +
    to64((final[3]! << 16) | (final[9]! << 8) | final[15]!, 4) +
    to64((final[4]! << 16) | (final[10]! << 8) | final[5]!, 4) +
    to64(final[11]!, 2);

  return `$apr1$${saltStr}$${encoded}`;
}

/**
 * bcrypt hash via `hash-wasm`, output rewritten to the `$2y$` variant Apache
 * expects. `hash-wasm` emits `$2a$`; the digest is identical for ASCII
 * passwords so the prefix swap is safe.
 */
export async function bcryptHtpasswd(
  password: string,
  cost: number = DEFAULT_COST,
): Promise<string> {
  if (!Number.isInteger(cost) || cost < MIN_COST || cost > MAX_COST) {
    throw new Error(`Cost must be an integer ${MIN_COST}-${MAX_COST}.`);
  }
  const enc = new TextEncoder().encode(password);
  if (enc.length < 1) throw new Error('Password must be at least 1 byte.');
  if (enc.length > 72) throw new Error('Password must be at most 72 bytes.');
  const wasm = await import('hash-wasm');
  const salt = randomBytes(16);
  const hash = await wasm.bcrypt({
    password,
    salt,
    costFactor: cost,
    outputType: 'encoded',
  });
  return hash.replace(/^\$2a\$/, '$2y$');
}

/** SHA-1 `{SHA}<base64>` htpasswd hash via Web Crypto. Legacy/weak. */
export async function sha1Htpasswd(password: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-1',
    new TextEncoder().encode(password),
  );
  const bytes = new Uint8Array(digest);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  return `{SHA}${btoa(binary)}`;
}

/** Build a full `username:hash` htpasswd line. */
export async function buildHtpasswdLine(
  username: string,
  password: string,
  scheme: HtpasswdScheme,
  cost: number = DEFAULT_COST,
): Promise<string> {
  const user = username.trim();
  if (!user) throw new Error('Username is required.');
  if (user.includes(':')) throw new Error('Username cannot contain a colon.');
  if (!password) throw new Error('Password is required.');
  let hash: string;
  if (scheme === 'bcrypt') hash = await bcryptHtpasswd(password, cost);
  else if (scheme === 'apr1') hash = await apr1Hash(password);
  else hash = await sha1Htpasswd(password);
  return `${user}:${hash}`;
}

/* -------------------------------------------------------------------------- */
/* Composable - reactive state + embed integration                             */
/* -------------------------------------------------------------------------- */

export interface UseHtpasswdGeneratorReturn {
  username: Ref<string>;
  password: Ref<string>;
  showPassword: Ref<boolean>;
  scheme: Ref<HtpasswdScheme>;
  cost: Ref<number>;
  line: Ref<string>;
  busy: Ref<boolean>;
  error: Ref<string>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  generate: () => Promise<void>;
}

export function useHtpasswdGenerator(): UseHtpasswdGeneratorReturn {
  const username = ref<string>('');
  const password = ref<string>('');
  const showPassword = ref<boolean>(false);
  const scheme = ref<HtpasswdScheme>('bcrypt');
  const cost = ref<number>(DEFAULT_COST);
  const line = ref<string>('');
  const busy = ref<boolean>(false);
  const error = ref<string>('');

  let token = 0;

  async function generate(): Promise<void> {
    error.value = '';
    const myToken = ++token;
    if (!username.value.trim() || !password.value) {
      line.value = '';
      return;
    }
    busy.value = true;
    try {
      const out = await buildHtpasswdLine(
        username.value,
        password.value,
        scheme.value,
        cost.value,
      );
      if (myToken === token) line.value = out;
    } catch (e) {
      if (myToken === token) {
        error.value = e instanceof Error ? e.message : String(e);
        line.value = '';
      }
    } finally {
      if (myToken === token) busy.value = false;
    }
  }

  // Debounce regeneration so bcrypt/apr1 don't run on every keystroke.
  let debounce: ReturnType<typeof setTimeout> | undefined;
  watch([username, password, scheme, cost], () => {
    if (debounce) clearTimeout(debounce);
    debounce = setTimeout(() => void generate(), 400);
  });

  const { isEmbed, input: embedInput } = useToolEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.username === 'string') username.value = p.username;
      if (typeof p.password === 'string') password.value = p.password;
      if (
        typeof p.scheme === 'string' &&
        (HTPASSWD_SCHEMES as Array<{ id: string }>).some((s) => s.id === p.scheme)
      ) {
        scheme.value = p.scheme as HtpasswdScheme;
      }
      if (typeof p.cost === 'number' && p.cost >= MIN_COST && p.cost <= MAX_COST) {
        cost.value = Math.floor(p.cost);
      }
    },
    output: line,
    toOutput: () => ({ line: line.value }),
  });

  return {
    username,
    password,
    showPassword,
    scheme,
    cost,
    line,
    busy,
    error,
    isEmbed,
    embedInput,
    generate,
  };
}
