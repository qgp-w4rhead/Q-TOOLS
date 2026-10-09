/**
 * usePasswordBreachChecker - composable + pure logic for checking passwords
 * against the HaveIBeenPwned API using k-anonymity SHA-1 prefix lookup.
 *
 * The password is NEVER sent to the server. Only the first 5 characters of
 * its SHA-1 hash are sent, and the client filters the response.
 *
 * Uses Web Crypto API for SHA-1 hashing. No external dependencies.
 */
import { ref, type Ref } from 'vue';
import { useToolEmbed } from '@/composables/useToolEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Types - pure logic (no Vue dependency)                                      */
/* -------------------------------------------------------------------------- */

export type BreachStatus = 'idle' | 'checking' | 'safe' | 'breached' | 'error';

export interface BreachResult {
  status: BreachStatus;
  count: number;
  hashSuffix: string;
  message: string;
  error?: string;
}

export interface UsePasswordBreachCheckerReturn {
  password: Ref<string>;
  showPassword: Ref<boolean>;
  result: Ref<BreachResult>;
  isChecking: Ref<boolean>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  check: () => Promise<void>;
  reset: () => void;
}

/* -------------------------------------------------------------------------- */
/* Pure logic - no Vue dependency below this point                             */
/* -------------------------------------------------------------------------- */

const HIBP_API_BASE = 'https://api.pwnedpasswords.com/range/';

/** Compute SHA-1 hash of a string using Web Crypto API. Returns uppercase hex. */
async function sha1Hash(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-1', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}

/**
 * Check a password against the HaveIBeenPwned API using k-anonymity.
 * Only the first 5 chars of the SHA-1 hash are sent to the server.
 */
export async function checkPasswordBreach(password: string): Promise<BreachResult> {
  if (!password) {
    return { status: 'idle', count: 0, hashSuffix: '', message: 'Enter a password to check.' };
  }

  try {
    const fullHash = await sha1Hash(password);
    const prefix = fullHash.slice(0, 5);
    const suffix = fullHash.slice(5);

    const response = await fetch(`${HIBP_API_BASE}${prefix}`, {
      headers: { 'Add-Padding': 'true' },
    });

    if (!response.ok) {
      return {
        status: 'error',
        count: 0,
        hashSuffix: suffix,
        message: 'API request failed.',
        error: `HTTP ${response.status}`,
      };
    }

    const text = await response.text();
    const lines = text.split('\n').filter(Boolean);

    for (const line of lines) {
      const parts = line.split(':');
      const hashSuffix = parts[0] ?? '';
      const countStr = parts[1] ?? '0';
      if (hashSuffix.trim().toUpperCase() === suffix) {
        const count = parseInt(countStr.trim(), 10);
        return {
          status: 'breached',
          count,
          hashSuffix: suffix,
          message: `This password has appeared in ${count.toLocaleString()} data breach${count === 1 ? '' : 'es'}.`,
        };
      }
    }

    return {
      status: 'safe',
      count: 0,
      hashSuffix: suffix,
      message: 'This password was not found in any known data breaches.',
    };
  } catch (err) {
    return {
      status: 'error',
      count: 0,
      hashSuffix: '',
      message: 'Failed to check password.',
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/* -------------------------------------------------------------------------- */
/* Composable - reactive state + embed integration                             */
/* -------------------------------------------------------------------------- */

export function usePasswordBreachChecker(): UsePasswordBreachCheckerReturn {
  const password = ref<string>('');
  const showPassword = ref<boolean>(false);
  const result = ref<BreachResult>({
    status: 'idle',
    count: 0,
    hashSuffix: '',
    message: 'Enter a password to check.',
  });
  const isChecking = ref<boolean>(false);

  async function check(): Promise<void> {
    if (!password.value || isChecking.value) return;
    isChecking.value = true;
    result.value = { status: 'checking', count: 0, hashSuffix: '', message: 'Checking…' };
    result.value = await checkPasswordBreach(password.value);
    isChecking.value = false;
  }

  function reset(): void {
    password.value = '';
    showPassword.value = false;
    result.value = { status: 'idle', count: 0, hashSuffix: '', message: 'Enter a password to check.' };
    isChecking.value = false;
  }

  const { isEmbed, input: embedInput } = useToolEmbed({
    onInput: async (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.password === 'string') {
        password.value = p.password;
        await check();
      }
    },
    output: result,
    toOutput: () => ({
      status: result.value.status,
      count: result.value.count,
      message: result.value.message,
    }),
  });

  return {
    password,
    showPassword,
    result,
    isChecking,
    isEmbed,
    embedInput,
    check,
    reset,
  };
}
