/**
 * useHashIdentifier - composable + pure logic for identifying hash algorithms
 * by length and format. Detects MD5, SHA-1, SHA-256, SHA-384, SHA-512,
 * SHA3-256, SHA3-512, bcrypt, Argon2, scrypt, and more.
 *
 * No external dependencies - pure pattern matching.
 */
import { ref, watch, type Ref } from 'vue';
import { useToolEmbed } from '@/composables/useToolEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Types - pure logic (no Vue dependency)                                      */
/* -------------------------------------------------------------------------- */

export interface HashMatch {
  algorithm: string;
  description: string;
  hexLength: number;
  bitLength: number;
  confidence: 'high' | 'medium' | 'low';
}

export interface UseHashIdentifierReturn {
  hashInput: Ref<string>;
  matches: Ref<HashMatch[]>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  reset: () => void;
}

/* -------------------------------------------------------------------------- */
/* Pure logic - no Vue dependency below this point                             */
/* -------------------------------------------------------------------------- */

interface HashDef {
  algorithm: string;
  description: string;
  hexLength: number;
  bitLength: number;
  pattern: RegExp;
  confidence: 'high' | 'medium' | 'low';
}

const HASH_DEFS: HashDef[] = [
  { algorithm: 'MD5', description: '128-bit hash, commonly used for checksums.', hexLength: 32, bitLength: 128, pattern: /^[a-f0-9]{32}$/i, confidence: 'high' },
  { algorithm: 'MD4', description: '128-bit hash, predecessor to MD5.', hexLength: 32, bitLength: 128, pattern: /^[a-f0-9]{32}$/i, confidence: 'medium' },
  { algorithm: 'NTLM', description: 'Windows NT LAN Manager hash.', hexLength: 32, bitLength: 128, pattern: /^[a-f0-9]{32}$/i, confidence: 'medium' },
  { algorithm: 'SHA-1', description: '160-bit hash, deprecated for security.', hexLength: 40, bitLength: 160, pattern: /^[a-f0-9]{40}$/i, confidence: 'high' },
  { algorithm: 'SHA-256', description: '256-bit hash, part of SHA-2 family.', hexLength: 64, bitLength: 256, pattern: /^[a-f0-9]{64}$/i, confidence: 'high' },
  { algorithm: 'SHA3-256', description: '256-bit Keccak hash, SHA-3 family.', hexLength: 64, bitLength: 256, pattern: /^[a-f0-9]{64}$/i, confidence: 'medium' },
  { algorithm: 'RIPEMD-160', description: '160-bit hash used in Bitcoin.', hexLength: 40, bitLength: 160, pattern: /^[a-f0-9]{40}$/i, confidence: 'medium' },
  { algorithm: 'SHA-384', description: '384-bit hash, part of SHA-2 family.', hexLength: 96, bitLength: 384, pattern: /^[a-f0-9]{96}$/i, confidence: 'high' },
  { algorithm: 'SHA-512', description: '512-bit hash, part of SHA-2 family.', hexLength: 128, bitLength: 512, pattern: /^[a-f0-9]{128}$/i, confidence: 'high' },
  { algorithm: 'SHA3-512', description: '512-bit Keccak hash, SHA-3 family.', hexLength: 128, bitLength: 512, pattern: /^[a-f0-9]{128}$/i, confidence: 'medium' },
  { algorithm: 'SHA-224', description: '224-bit hash, part of SHA-2 family.', hexLength: 56, bitLength: 224, pattern: /^[a-f0-9]{56}$/i, confidence: 'high' },
  { algorithm: 'SHA-512/256', description: '256-bit truncated SHA-512.', hexLength: 64, bitLength: 256, pattern: /^[a-f0-9]{64}$/i, confidence: 'low' },
  { algorithm: 'Whirlpool', description: '512-bit hash.', hexLength: 128, bitLength: 512, pattern: /^[a-f0-9]{128}$/i, confidence: 'low' },
];

const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;
const BCRYPT_PATTERN = /^\$2[aby]?\$\d{2}\$[./A-Za-z0-9]{53}$/;
const ARGON2_PATTERN = /^\$argon2(id|d|i)\$[a-z0-9=,]+\$[A-Za-z0-9+/]+$/;

export function identifyHash(input: string): HashMatch[] {
  const trimmed = input.trim();
  if (!trimmed) return [];

  const matches: HashMatch[] = [];

  // Check hex-based hashes
  for (const def of HASH_DEFS) {
    if (def.pattern.test(trimmed)) {
      matches.push({
        algorithm: def.algorithm,
        description: def.description,
        hexLength: def.hexLength,
        bitLength: def.bitLength,
        confidence: def.confidence,
      });
    }
  }

  // Check bcrypt
  if (BCRYPT_PATTERN.test(trimmed)) {
    matches.push({
      algorithm: 'bcrypt',
      description: 'Adaptive password hash with cost factor.',
      hexLength: 60,
      bitLength: 184,
      confidence: 'high',
    });
  }

  // Check Argon2
  if (ARGON2_PATTERN.test(trimmed)) {
    matches.push({
      algorithm: 'Argon2',
      description: 'Memory-hard password hash (PHC format).',
      hexLength: trimmed.length,
      bitLength: 0,
      confidence: 'high',
    });
  }

  // Check base64-encoded hashes (could be any algorithm)
  if (BASE64_PATTERN.test(trimmed) && trimmed.length >= 20) {
    const decodedLen = Math.floor((trimmed.length * 3) / 4);
    if (decodedLen === 16) {
      matches.push({ algorithm: 'MD5 (base64)', description: 'MD5 hash encoded in base64.', hexLength: 24, bitLength: 128, confidence: 'medium' });
    } else if (decodedLen === 20) {
      matches.push({ algorithm: 'SHA-1 (base64)', description: 'SHA-1 hash encoded in base64.', hexLength: 28, bitLength: 160, confidence: 'medium' });
    } else if (decodedLen === 32) {
      matches.push({ algorithm: 'SHA-256 (base64)', description: 'SHA-256 hash encoded in base64.', hexLength: 44, bitLength: 256, confidence: 'medium' });
    } else if (decodedLen === 48) {
      matches.push({ algorithm: 'SHA-384 (base64)', description: 'SHA-384 hash encoded in base64.', hexLength: 64, bitLength: 384, confidence: 'medium' });
    } else if (decodedLen === 64) {
      matches.push({ algorithm: 'SHA-512 (base64)', description: 'SHA-512 hash encoded in base64.', hexLength: 88, bitLength: 512, confidence: 'medium' });
    }
  }

  // Sort by confidence
  const confOrder = { high: 0, medium: 1, low: 2 };
  matches.sort((a, b) => confOrder[a.confidence] - confOrder[b.confidence]);

  return matches;
}

/* -------------------------------------------------------------------------- */
/* Composable - reactive state + embed integration                             */
/* -------------------------------------------------------------------------- */

export function useHashIdentifier(): UseHashIdentifierReturn {
  const hashInput = ref<string>('');
  const matches = ref<HashMatch[]>([]);

  function recompute(): void {
    matches.value = identifyHash(hashInput.value);
  }

  function reset(): void {
    hashInput.value = '';
    recompute();
  }

  watch(hashInput, recompute);

  recompute();

  const { isEmbed, input: embedInput } = useToolEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.hash === 'string') hashInput.value = p.hash;
      if (typeof p.input === 'string') hashInput.value = p.input;
      if (typeof p.value === 'string') hashInput.value = p.value;
    },
    output: matches,
    toOutput: () => ({ matches: matches.value, count: matches.value.length }),
  });

  return {
    hashInput,
    matches,
    isEmbed,
    embedInput,
    reset,
  };
}
