/**
 * useBip39Generator - composable + pure logic for the BIP39 mnemonic generator.
 *
 * Generates BIP39 mnemonic phrases (https://github.com/bitcoin/bips/blob/master/
 * bip-0039.mediawiki) using the audited `@scure/bip39` library. A mnemonic is a
 * sequence of 12-24 human-readable words that encode 128-256 bits of entropy
 * plus a checksum, used as a human-friendly backup for cryptographic seeds
 * (most notably HD wallets).
 *
 * Entropy → word count mapping (BIP39 spec):
 *   128 bits → 12 words
 *   160 bits → 15 words
 *   192 bits → 18 words
 *   224 bits → 21 words
 *   256 bits → 24 words
 *
 * The `@scure/bip39` package is dynamically imported inside the pure helpers so
 * Vite emits it as a separate chunk (lazy-loaded only when the tool is opened).
 * The English wordlist is imported together with the main module (so it shares
 * the same chunk and is available immediately on first generate - English is
 * the default and most common case). The other 7 wordlists (Japanese, French,
 * Italian, Korean, Spanish, Simplified Chinese, Traditional Chinese) are
 * dynamically imported on demand, each landing in its own Vite chunk, so users
 * who never switch languages never pay the download cost.
 *
 * Randomness: `@scure/bip39`'s `generateMnemonic` uses `@noble/hashes`'
 * `randomBytes`, which is backed by the platform CSPRNG
 * (`crypto.getRandomValues` in browsers / `crypto.randomBytes` in Node). We do
 * NOT pass our own entropy - the library handles secure generation.
 *
 * Optional BIP39 passphrase (the so-called "25th word") can be supplied to
 * derive a 64-byte seed via `mnemonicToSeed` (PBKDF2-HMAC-SHA512, 2048
 * iterations per BIP39). The seed is output as hex when a passphrase is set.
 *
 * The pure helpers (`loadWordlist`, `generateMnemonicPhrase`,
 * `mnemonicToEntropyHex`, `entropyHexToMnemonic`, `validateMnemonicPhrase`,
 * `deriveSeed`, `toHex`) have no Vue dependency and can be imported standalone
 * for unit testing or reuse. The `useBip39Generator()` composable wraps them in
 * reactive state and wires up the embed PostMessage protocol.
 */
import { ref, watch, type Ref } from 'vue';
import { useEmbed } from '@/composables/useEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Pure logic - no Vue dependency below this point                            */
/* -------------------------------------------------------------------------- */

/** Supported entropy strengths (bits). Must be a multiple of 32, 128-256. */
export const STRENGTHS = [128, 160, 192, 224, 256] as const;
export type Strength = (typeof STRENGTHS)[number];
export const DEFAULT_STRENGTH: Strength = 128;

/** Map strength (bits) → word count. */
export const STRENGTH_TO_WORDS: Record<Strength, number> = {
  128: 12,
  160: 15,
  192: 18,
  224: 21,
  256: 24,
};

/**
 * Supported BIP39 wordlist languages. The English wordlist is the BIP39 default
 * and is bundled with the main `@scure/bip39` lazy chunk; the others are
 * dynamically imported on demand.
 */
export const WORDLISTS = [
  'english',
  'japanese',
  'french',
  'italian',
  'korean',
  'spanish',
  'simplified-chinese',
  'traditional-chinese',
] as const;
export type WordlistId = (typeof WORDLISTS)[number];
export const DEFAULT_WORDLIST: WordlistId = 'english';

/** Human-readable labels for each wordlist. */
export const WORDLIST_LABELS: Record<WordlistId, string> = {
  english: 'English',
  japanese: 'Japanese',
  french: 'French',
  italian: 'Italian',
  korean: 'Korean',
  spanish: 'Spanish',
  'simplified-chinese': 'Chinese (Simplified)',
  'traditional-chinese': 'Chinese (Traditional)',
};

/** Cached wordlist modules - keyed by language id. */
const wordlistCache = new Map<WordlistId, string[]>();

/** Cached main `@scure/bip39` module (shared across all calls). */
let cachedBip39Module: typeof import('@scure/bip39') | null = null;

/**
 * Resolve and cache the main `@scure/bip39` module (async). The English
 * wordlist is imported alongside it so the default language is ready
 * immediately on first generation. Safe to call repeatedly.
 */
export async function ensureBip39Module(): Promise<typeof import('@scure/bip39')> {
  if (!cachedBip39Module) {
    // Dynamic import → `@scure/bip39` lands in its own Vite chunk, loaded only
    // when the user opens this tool.
    cachedBip39Module = await import('@scure/bip39');
    // Eagerly load the English wordlist into the cache so the default language
    // is ready without a second round-trip. The english wordlist module is a
    // separate specifier but Vite will bundle it with the main bip39 chunk
    // because it is imported right here (no extra network request beyond the
    // chunk that is already loading).
    if (!wordlistCache.has('english')) {
      const en = await import('@scure/bip39/wordlists/english.js');
      wordlistCache.set('english', en.wordlist);
    }
  }
  return cachedBip39Module;
}

/**
 * Load a BIP39 wordlist by language id. English is served from the cache
 * populated by `ensureBip39Module`; other languages are dynamically imported on
 * demand and cached so subsequent selections are instant. Each non-English
 * wordlist lands in its own Vite chunk.
 */
export async function loadWordlist(id: WordlistId): Promise<string[]> {
  const cached = wordlistCache.get(id);
  if (cached) return cached;
  // Side-effect: ensure the main module is loaded too (English cache populated).
  await ensureBip39Module();
  switch (id) {
    case 'english': {
      const m = await import('@scure/bip39/wordlists/english.js');
      wordlistCache.set('english', m.wordlist);
      return m.wordlist;
    }
    case 'japanese': {
      const m = await import('@scure/bip39/wordlists/japanese.js');
      wordlistCache.set('japanese', m.wordlist);
      return m.wordlist;
    }
    case 'french': {
      const m = await import('@scure/bip39/wordlists/french.js');
      wordlistCache.set('french', m.wordlist);
      return m.wordlist;
    }
    case 'italian': {
      const m = await import('@scure/bip39/wordlists/italian.js');
      wordlistCache.set('italian', m.wordlist);
      return m.wordlist;
    }
    case 'korean': {
      const m = await import('@scure/bip39/wordlists/korean.js');
      wordlistCache.set('korean', m.wordlist);
      return m.wordlist;
    }
    case 'spanish': {
      const m = await import('@scure/bip39/wordlists/spanish.js');
      wordlistCache.set('spanish', m.wordlist);
      return m.wordlist;
    }
    case 'simplified-chinese': {
      const m = await import('@scure/bip39/wordlists/simplified-chinese.js');
      wordlistCache.set('simplified-chinese', m.wordlist);
      return m.wordlist;
    }
    case 'traditional-chinese': {
      const m = await import('@scure/bip39/wordlists/traditional-chinese.js');
      wordlistCache.set('traditional-chinese', m.wordlist);
      return m.wordlist;
    }
    default: {
      // Exhaustive guard - TS ensures the switch covers every WordlistId.
      const _exhaustive: never = id;
      throw new Error(`Unsupported wordlist: ${String(_exhaustive)}`);
    }
  }
}

/** Options for `generateMnemonicPhrase`. */
export interface GenerateMnemonicOptions {
  /** Entropy strength in bits (128/160/192/224/256). */
  strength: Strength;
  /** Wordlist language id. */
  wordlist: WordlistId;
}

/**
 * Generate a fresh BIP39 mnemonic phrase. Uses `@scure/bip39`'s
 * `generateMnemonic`, which draws entropy from the platform CSPRNG. The
 * returned string uses the wordlist's canonical separator (single space for
 * non-Japanese, U+3000 ideographic space for Japanese - handled by the
 * library).
 */
export async function generateMnemonicPhrase(
  options: GenerateMnemonicOptions,
): Promise<string> {
  const { strength, wordlist } = options;
  if (!STRENGTHS.includes(strength)) {
    throw new Error(
      `Strength must be one of ${STRENGTHS.join(', ')} bits (got ${strength})`,
    );
  }
  const bip39 = await ensureBip39Module();
  const wl = await loadWordlist(wordlist);
  return bip39.generateMnemonic(wl, strength);
}

/**
 * Convert a mnemonic phrase back to its raw entropy, returned as a hex string.
 * Throws if the mnemonic is malformed or fails the checksum check.
 */
export async function mnemonicToEntropyHex(
  mnemonic: string,
  wordlist: WordlistId,
): Promise<string> {
  const bip39 = await ensureBip39Module();
  const wl = await loadWordlist(wordlist);
  const entropy = bip39.mnemonicToEntropy(mnemonic, wl);
  return toHex(entropy);
}

/**
 * Convert raw entropy (hex string) back into a mnemonic phrase using the given
 * wordlist. The hex string must encode a valid BIP39 entropy length
 * (16/20/24/28/32 bytes → 128/160/192/224/256 bits).
 */
export async function entropyHexToMnemonic(
  entropyHex: string,
  wordlist: WordlistId,
): Promise<string> {
  const bip39 = await ensureBip39Module();
  const wl = await loadWordlist(wordlist);
  const bytes = fromHex(entropyHex);
  return bip39.entropyToMnemonic(bytes, wl);
}

/**
 * Validate a mnemonic phrase against a wordlist (checks word membership and
 * checksum). Returns `true` when valid.
 */
export async function validateMnemonicPhrase(
  mnemonic: string,
  wordlist: WordlistId,
): Promise<boolean> {
  const bip39 = await ensureBip39Module();
  const wl = await loadWordlist(wordlist);
  return bip39.validateMnemonic(mnemonic, wl);
}

/**
 * Derive a 64-byte BIP39 seed from a mnemonic + optional passphrase using
 * PBKDF2-HMAC-SHA512 (2048 iterations, per BIP39 spec). Returns the seed as a
 * hex string. The passphrase is the BIP39 "25th word" - any ASCII/UTF-8 string
 * the user chooses; there is no "wrong" passphrase, but different passphrases
 * yield completely different seeds.
 */
export async function deriveSeed(
  mnemonic: string,
  passphrase?: string,
): Promise<string> {
  const bip39 = await ensureBip39Module();
  const seed = await bip39.mnemonicToSeed(mnemonic, passphrase);
  return toHex(seed);
}

/* ----------------------------- byte helpers ------------------------------ */

/** Convert a `Uint8Array` to a lowercase hex string. */
export function toHex(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i]!.toString(16).padStart(2, '0');
  }
  return out;
}

/** Convert a hex string to a fresh `Uint8Array`. Throws on invalid input. */
export function fromHex(hex: string): Uint8Array {
  const clean = hex.trim().toLowerCase();
  if (!/^[0-9a-f]*$/.test(clean) || clean.length % 2 !== 0) {
    throw new Error('Invalid hex string (must be even-length 0-9a-f)');
  }
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/* Composable - reactive state + embed integration                            */
/* -------------------------------------------------------------------------- */

export interface UseBip39GeneratorReturn {
  strength: Ref<Strength>;
  wordlist: Ref<WordlistId>;
  passphrase: Ref<string>;
  showPassphrase: Ref<boolean>;
  mnemonic: Ref<string>;
  mnemonicWords: Ref<string[]>;
  entropyHex: Ref<string>;
  seedHex: Ref<string>;
  generating: Ref<boolean>;
  error: Ref<string>;
  isEmbed: Ref<boolean>;
  input: Ref<EmbedInputPayload | null>;
  generate: () => Promise<void>;
}

export function useBip39Generator(): UseBip39GeneratorReturn {
  const strength = ref<Strength>(DEFAULT_STRENGTH);
  const wordlist = ref<WordlistId>(DEFAULT_WORDLIST);
  const passphrase = ref<string>('');
  const showPassphrase = ref<boolean>(false);
  const mnemonic = ref<string>('');
  const mnemonicWords = ref<string[]>([]);
  const entropyHex = ref<string>('');
  const seedHex = ref<string>('');
  const generating = ref<boolean>(false);
  const error = ref<string>('');

  async function generate(): Promise<void> {
    error.value = '';
    generating.value = true;
    try {
      const phrase = await generateMnemonicPhrase({
        strength: strength.value,
        wordlist: wordlist.value,
      });
      mnemonic.value = phrase;
      // Split on any whitespace (BIP39 uses regular space for non-Japanese and
      // U+3000 ideographic space for Japanese - `\s+` covers both).
      mnemonicWords.value = phrase.split(/\s+/).filter((w) => w.length > 0);
      const ent = await mnemonicToEntropyHex(phrase, wordlist.value);
      entropyHex.value = ent;
      // Only derive + show the seed when the user supplied a passphrase -
      // otherwise the seed is just the well-known "no passphrase" derivation
      // and showing it would imply it is secret.
      if (passphrase.value.length > 0) {
        seedHex.value = await deriveSeed(phrase, passphrase.value);
      } else {
        seedHex.value = '';
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e);
      mnemonic.value = '';
      mnemonicWords.value = [];
      entropyHex.value = '';
      seedHex.value = '';
    } finally {
      generating.value = false;
    }
  }

  const { isEmbed, input, sendOutput } = useEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (
        typeof p.strength === 'number' &&
        (STRENGTHS as readonly number[]).includes(p.strength)
      ) {
        strength.value = p.strength as Strength;
      }
      if (
        typeof p.wordlist === 'string' &&
        (WORDLISTS as readonly string[]).includes(p.wordlist)
      ) {
        wordlist.value = p.wordlist as WordlistId;
      }
      if (typeof p.passphrase === 'string') passphrase.value = p.passphrase;
      if (typeof p.showPassphrase === 'boolean')
        showPassphrase.value = p.showPassphrase;
      if (p.generate === true) {
        void generate();
      }
    },
  });

  // Relay output to the parent whenever the generated mnemonic changes (embed
  // only). Includes entropy hex + seed hex (when a passphrase was supplied).
  watch([mnemonic, entropyHex, seedHex], () => {
    if (!isEmbed.value) return;
    sendOutput({
      mnemonic: mnemonic.value,
      entropy: entropyHex.value,
      seed: seedHex.value,
    });
  });

  return {
    strength,
    wordlist,
    passphrase,
    showPassphrase,
    mnemonic,
    mnemonicWords,
    entropyHex,
    seedHex,
    generating,
    error,
    isEmbed,
    input,
    generate,
  };
}
