/**
 * useEmailNormalizer - composable + pure logic for the Email normalizer tool.
 *
 * Parses an email address into its local part and domain, validates it with a
 * pragmatic (non-RFC-5322-strict) grammar, and produces a canonical normalized
 * form suitable for de-duplication / comparison:
 *
 *   1. Lowercase the whole address.
 *   2. Strip the `+suffix` sub-address tag from the local part (applies to all
 *      providers - `user+tag@domain` → `user@domain`).
 *   3. For Gmail addresses (`gmail.com` and `googlemail.com`), also strip
 *      every `.` from the local part (Gmail ignores dots).
 *
 * The tool also reports:
 *   - local part + domain
 *   - whether the address is structurally valid
 *   - whether the domain is a known disposable/temp-mail provider
 *   - the human-readable provider name (Gmail, Microsoft, Yahoo, …) or the
 *     domain itself when the provider is unknown
 *
 * Pure helpers (`parseEmail`, `normalizeEmail`, `isDisposableDomain`,
 * `detectProvider`, `isValidEmail`) have no Vue dependency and can be imported
 * standalone for unit testing or reuse. The `useEmailNormalizer()` composable
 * wraps them in reactive state and wires up the embed PostMessage protocol.
 *
 * No external dependencies - only a bundled disposable-domain set and a
 * provider map.
 */
import { ref, watch, type Ref } from 'vue';
import { useEmbed } from '@/composables/useEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Pure logic - no Vue dependency below this point                             */
/* -------------------------------------------------------------------------- */

/** Domains Google treats as equivalent to `gmail.com` for normalisation. */
const GMAIL_DOMAINS = new Set<string>(['gmail.com', 'googlemail.com']);

/**
 * Curated set of common disposable / temporary / throwaway email providers.
 *
 * This is intentionally a hand-maintained list of the most widely used
 * temp-mail services - it is not exhaustive (no public list is), but it covers
 * the providers a developer is realistically likely to encounter when
 * filtering sign-ups. All entries are lowercased.
 */
const DISPOSABLE_DOMAINS: ReadonlySet<string> = new Set<string>([
  // Classic temp-mail services
  'mailinator.com',
  'guerrillamail.com',
  'guerrillamailblock.com',
  '10minutemail.com',
  '10minutemail.net',
  '10minutemail.org',
  'temp-mail.org',
  'tempmail.com',
  'tempmail.net',
  'tempmailo.com',
  'throwawaymail.com',
  'throwawaymail.net',
  'dispostable.com',
  'yopmail.com',
  'yopmail.net',
  'sharklasers.com',
  'spam4.me',
  'maildrop.cc',
  'getnada.com',
  'mailnesia.com',
  'mailcatch.com',
  'mintemail.com',
  'mohmal.com',
  'tempinbox.com',
  'fakeinbox.com',
  'fake-mail.com',
  'fakemailgenerator.com',
  'trashmail.com',
  'trashmail.net',
  'trashmail.me',
  'trashmail.io',
  'mytemp.email',
  'tempemail.com',
  'tempemail.net',
  'burnermail.io',
  'inboxbear.com',
  'moakt.com',
  'mbox.re',
  'discard.email',
  'discardmail.com',
  'mailpoof.com',
  'smailpro.com',
  'tempmailo.com',
  'emailondeck.com',
  'temp-mail.io',
  'tempr.email',
  'temprmail.com',
  'linshiyou.com',
  '24hourmail.com',
  '30minutemail.com',
  'tempmailaddress.com',
  'spamfree.eu',
  'spamgourmet.com',
  'mailnull.com',
  'anonbox.net',
  'bybymail.com',
  'clownmail.com',
  'dropmail.me',
  'edu.bearmail.info',
  // Common alias / forwarding services often abused for sign-ups
  'maildrop.cc',
  'mailcatch.com',
  'incognitomail.com',
  'boximail.com',
  'cyber-inbox.com',
  'mytrashmail.com',
]);

/**
 * Map of provider domains (and a few wildcard suffixes) to human-readable
 * provider names. Lookup is performed in `detectProvider`:
 *   1. exact domain match
 *   2. suffix match for entries ending in `.*` (e.g. `yahoo.*` matches
 *      `yahoo.co.uk`, `yahoo.fr`)
 */
const PROVIDER_MAP: ReadonlyArray<{ pattern: string; provider: string }> = [
  { pattern: 'gmail.com', provider: 'Gmail' },
  { pattern: 'googlemail.com', provider: 'Gmail' },
  { pattern: 'outlook.com', provider: 'Microsoft Outlook' },
  { pattern: 'outlook.*', provider: 'Microsoft Outlook' },
  { pattern: 'hotmail.com', provider: 'Microsoft Outlook' },
  { pattern: 'hotmail.*', provider: 'Microsoft Outlook' },
  { pattern: 'live.com', provider: 'Microsoft Outlook' },
  { pattern: 'live.*', provider: 'Microsoft Outlook' },
  { pattern: 'msn.com', provider: 'Microsoft Outlook' },
  { pattern: 'yahoo.com', provider: 'Yahoo' },
  { pattern: 'yahoo.*', provider: 'Yahoo' },
  { pattern: 'proton.me', provider: 'Proton Mail' },
  { pattern: 'protonmail.com', provider: 'Proton Mail' },
  { pattern: 'protonmail.ch', provider: 'Proton Mail' },
  { pattern: 'pm.me', provider: 'Proton Mail' },
  { pattern: 'icloud.com', provider: 'iCloud Mail' },
  { pattern: 'me.com', provider: 'iCloud Mail' },
  { pattern: 'mac.com', provider: 'iCloud Mail' },
  { pattern: 'zoho.com', provider: 'Zoho Mail' },
  { pattern: 'zoho.*', provider: 'Zoho Mail' },
  { pattern: 'aol.com', provider: 'AOL Mail' },
  { pattern: 'gmx.com', provider: 'GMX' },
  { pattern: 'gmx.*', provider: 'GMX' },
  { pattern: 'mail.com', provider: 'mail.com' },
  { pattern: 'yandex.com', provider: 'Yandex Mail' },
  { pattern: 'yandex.*', provider: 'Yandex Mail' },
  { pattern: 'tutanota.com', provider: 'Tutanota' },
  { pattern: 'tutanota.de', provider: 'Tutanota' },
  { pattern: 'tutamail.com', provider: 'Tutanota' },
  { pattern: 'fastmail.com', provider: 'Fastmail' },
  { pattern: 'fastmail.*', provider: 'Fastmail' },
  { pattern: 'qq.com', provider: 'QQ Mail' },
  { pattern: '163.com', provider: 'NetEase Mail' },
  { pattern: '126.com', provider: 'NetEase Mail' },
  { pattern: 'sina.com', provider: 'Sina Mail' },
  { pattern: 'sina.cn', provider: 'Sina Mail' },
];

/** Result of `parseEmail` - the structural breakdown of an address. */
export interface ParsedEmail {
  /** Original input (trimmed, not lowercased). */
  raw: string;
  /** Local part (before the `@`), original case preserved. */
  localPart: string;
  /** Domain (after the `@`), original case preserved. */
  domain: string;
  /** Whether the address is structurally valid. */
  isValid: boolean;
  /** Validation error message when `isValid` is false. */
  error: string | null;
}

/** Result of `normalizeEmail` - the canonical form + breakdown. */
export interface NormalizedEmail {
  /** Canonical normalized address (lowercase, dots/plus stripped per rules). */
  normalized: string;
  /** Normalized local part. */
  localPart: string;
  /** Normalized domain (lowercased). */
  domain: string;
  /** Original local part (before normalisation). */
  originalLocalPart: string;
  /** Original domain (lowercased for comparison). */
  originalDomain: string;
  /** Whether a `+suffix` was stripped. */
  plusStripped: boolean;
  /** Whether dots were stripped (Gmail only). */
  dotsStripped: boolean;
  /** Whether the domain is a Gmail-equivalent domain. */
  isGmail: boolean;
  /** Whether the address is structurally valid. */
  isValid: boolean;
  /** Validation error message when `isValid` is false. */
  error: string | null;
  /** Whether the domain is a known disposable/temp-mail provider. */
  isDisposable: boolean;
  /** Human-readable provider name, or the domain itself when unknown. */
  provider: string;
}

/**
 * Pragmatic email validation.
 *
 * This is NOT a strict RFC 5322 implementation - it accepts the common
 * address shapes a developer will encounter in practice and rejects the
 * obvious mistakes (missing `@`, empty local part, invalid characters, no
 * TLD, consecutive dots, leading/trailing dots in local part).
 *
 * Rules:
 *   - Exactly one `@`.
 *   - Local part: 1-64 chars, chars from `[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]`,
 *     plus quoted-string support is intentionally omitted for simplicity.
 *     Dots allowed but not at start/end and not consecutive.
 *   - Domain: 1-255 chars, labels of 1-63 alphanumeric chars + hyphens
 *     (not at start/end), separated by dots, at least one dot, TLD ≥ 2 chars
 *     and alphabetic.
 *   - IP-literal domains (`[1.2.3.4]` or `[IPv6:...]`) are accepted.
 */
export function isValidEmail(input: string): { valid: boolean; error: string | null } {
  const trimmed = input.trim();
  if (trimmed.length === 0) return { valid: false, error: 'Email is empty.' };
  if (trimmed.length > 254) {
    return { valid: false, error: 'Email is longer than 254 characters.' };
  }

  const atIdx = trimmed.indexOf('@');
  if (atIdx < 0) return { valid: false, error: 'Missing "@" character.' };
  if (atIdx !== trimmed.lastIndexOf('@')) {
    return { valid: false, error: 'Multiple "@" characters.' };
  }

  const local = trimmed.slice(0, atIdx);
  const domain = trimmed.slice(atIdx + 1);

  if (local.length === 0) return { valid: false, error: 'Local part (before "@") is empty.' };
  if (local.length > 64) return { valid: false, error: 'Local part is longer than 64 characters.' };
  if (domain.length === 0) return { valid: false, error: 'Domain (after "@") is empty.' };
  if (domain.length > 255) return { valid: false, error: 'Domain is longer than 255 characters.' };

  // Local part character + dot rules.
  const localCharRe = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+$/;
  if (!localCharRe.test(local)) {
    return { valid: false, error: 'Local part contains invalid characters.' };
  }
  if (local.startsWith('.') || local.endsWith('.')) {
    return { valid: false, error: 'Local part cannot start or end with a dot.' };
  }
  if (local.includes('..')) {
    return { valid: false, error: 'Local part cannot contain consecutive dots.' };
  }

  // IP-literal domain form: [1.2.3.4] or [IPv6:...]
  if (domain.startsWith('[') && domain.endsWith(']')) {
    const inner = domain.slice(1, -1);
    if (inner.length === 0) {
      return { valid: false, error: 'IP-literal domain is empty.' };
    }
    // Accept any non-empty IPv4 / IPv6 literal - full IP validation is out of
    // scope for an email normaliser.
    return { valid: true, error: null };
  }

  // Domain label rules.
  const labels = domain.split('.');
  if (labels.length < 2) {
    return { valid: false, error: 'Domain must contain at least one dot (e.g. user@example.com).' };
  }
  const labelRe = /^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/;
  for (let i = 0; i < labels.length; i++) {
    const label = labels[i]!;
    if (label.length === 0) {
      return { valid: false, error: 'Domain contains an empty label (consecutive dots).' };
    }
    if (label.length > 63) {
      return { valid: false, error: 'Domain label is longer than 63 characters.' };
    }
    if (!labelRe.test(label)) {
      return { valid: false, error: `Domain label "${label}" contains invalid characters.` };
    }
  }
  // TLD must be alphabetic and at least 2 chars (rejects `user@example.1`).
  const tld = labels[labels.length - 1]!;
  if (!/^[A-Za-z]{2,}$/.test(tld)) {
    return { valid: false, error: 'Top-level domain must be alphabetic and at least 2 characters.' };
  }

  return { valid: true, error: null };
}

/**
 * Parse an email address into its local part and domain.
 *
 * Returns a `ParsedEmail` with `isValid` and `error` populated by
 * `isValidEmail`. The local part and domain preserve their original case so
 * the UI can show the user's input verbatim.
 */
export function parseEmail(input: string): ParsedEmail {
  const raw = input.trim();
  const atIdx = raw.indexOf('@');
  let localPart = '';
  let domain = '';
  if (atIdx >= 0) {
    localPart = raw.slice(0, atIdx);
    domain = raw.slice(atIdx + 1);
  } else {
    // No `@` - treat the whole string as the local part for display purposes.
    localPart = raw;
  }
  const { valid, error } = isValidEmail(raw);
  return { raw, localPart, domain, isValid: valid, error };
}

/**
 * Detect the human-readable provider name for a domain.
 *
 * Performs an exact match first, then a wildcard suffix match for entries
 * ending in `.*` (e.g. `yahoo.*` matches `yahoo.co.uk`). Returns the domain
 * itself (lowercased) when no provider is recognised.
 */
export function detectProvider(domain: string): string {
  const lower = domain.toLowerCase().trim();
  if (lower.length === 0) return '';
  for (const entry of PROVIDER_MAP) {
    if (entry.pattern.endsWith('.*')) {
      const prefix = entry.pattern.slice(0, -1); // keep trailing dot
      if (lower.startsWith(prefix)) return entry.provider;
    } else if (lower === entry.pattern) {
      return entry.provider;
    }
  }
  return lower;
}

/**
 * Check whether a domain is a known disposable / temp-mail provider.
 *
 * Case-insensitive. Returns `false` for an empty domain.
 */
export function isDisposableDomain(domain: string): boolean {
  const lower = domain.toLowerCase().trim();
  if (lower.length === 0) return false;
  return DISPOSABLE_DOMAINS.has(lower);
}

/**
 * Normalize an email address into its canonical form.
 *
 * Steps:
 *   1. Trim + lowercase the whole address.
 *   2. Split into local part + domain at the `@`.
 *   3. Strip the `+suffix` sub-address tag from the local part (all providers).
 *   4. For Gmail-equivalent domains, also strip every `.` from the local part.
 *   5. Reassemble as `local@domain`.
 *
 * Invalid addresses still return a `NormalizedEmail` (so the UI can show the
 * validation error alongside the attempted normalisation), but `isValid` will
 * be `false` and `normalized` will be the lowercased input (best-effort).
 */
export function normalizeEmail(input: string): NormalizedEmail {
  const parsed = parseEmail(input);
  const originalLocalPart = parsed.localPart;
  const originalDomain = parsed.domain.toLowerCase();

  if (!parsed.isValid) {
    // Best-effort: lowercase the whole input so the UI can still display it.
    const lower = input.trim().toLowerCase();
    return {
      normalized: lower,
      localPart: parsed.localPart.toLowerCase(),
      domain: originalDomain,
      originalLocalPart,
      originalDomain,
      plusStripped: false,
      dotsStripped: false,
      isGmail: GMAIL_DOMAINS.has(originalDomain),
      isValid: false,
      error: parsed.error,
      isDisposable: isDisposableDomain(originalDomain),
      provider: detectProvider(originalDomain),
    };
  }

  const isGmail = GMAIL_DOMAINS.has(originalDomain);
  let local = parsed.localPart.toLowerCase();

  // Strip `+suffix`.
  const plusIdx = local.indexOf('+');
  let plusStripped = false;
  if (plusIdx >= 0) {
    local = local.slice(0, plusIdx);
    plusStripped = true;
  }

  // Strip dots for Gmail-equivalent domains.
  let dotsStripped = false;
  if (isGmail) {
    if (local.includes('.')) {
      local = local.replaceAll('.', '');
      dotsStripped = true;
    }
  }

  const normalized = `${local}@${originalDomain}`;

  return {
    normalized,
    localPart: local,
    domain: originalDomain,
    originalLocalPart,
    originalDomain,
    plusStripped,
    dotsStripped,
    isGmail,
    isValid: true,
    error: null,
    isDisposable: isDisposableDomain(originalDomain),
    provider: detectProvider(originalDomain),
  };
}

/* -------------------------------------------------------------------------- */
/* Composable - reactive state + embed integration                            */
/* -------------------------------------------------------------------------- */

export interface UseEmailNormalizerReturn {
  input: Ref<string>;
  result: Ref<NormalizedEmail | null>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  recompute: () => void;
}

export function useEmailNormalizer(): UseEmailNormalizerReturn {
  const input = ref<string>('');
  const result = ref<NormalizedEmail | null>(null);

  function recompute(): void {
    const text = input.value.trim();
    if (text.length === 0) {
      result.value = null;
      return;
    }
    result.value = normalizeEmail(input.value);
  }

  watch(input, recompute, { immediate: true });

  const { isEmbed, input: embedInput, sendOutput } = useEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.email === 'string') {
        input.value = p.email;
      } else if (typeof p.input === 'string') {
        input.value = p.input;
      } else if (typeof p.value === 'string') {
        input.value = p.value;
      } else if (typeof p.address === 'string') {
        input.value = p.address;
      }
    },
  });

  watch(result, (r) => {
    if (isEmbed.value) {
      if (r) {
        sendOutput({
          normalized: r.normalized,
          localPart: r.localPart,
          domain: r.domain,
          isValid: r.isValid,
          isDisposable: r.isDisposable,
          provider: r.provider,
          plusStripped: r.plusStripped,
          dotsStripped: r.dotsStripped,
          isGmail: r.isGmail,
          error: r.error,
        });
      } else {
        sendOutput({});
      }
    }
  });

  return { input, result, isEmbed, embedInput, recompute };
}
