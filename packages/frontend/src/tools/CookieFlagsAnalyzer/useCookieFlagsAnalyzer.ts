/**
 * useCookieFlagsAnalyzer - composable + pure logic for the cookie flags
 * analyzer tool.
 *
 * Parses pasted `Set-Cookie` response headers (one per line, or a raw header
 * block) into name/value + attributes, then flags security issues: missing
 * `Secure`, `HttpOnly`, `SameSite`, overly broad `Domain`/`Path` scope,
 * `SameSite=None` without `Secure`, missing `__Host-`/`__Secure-` prefix
 * requirements, and session vs persistent lifetime notes.
 *
 * Pure helpers have no Vue dependency and can be imported standalone for
 * unit testing or reuse. The `useCookieFlagsAnalyzer()` composable wraps them
 * in reactive state and wires up the embed PostMessage protocol.
 *
 * No external dependencies.
 */
import { ref, watch, type Ref } from 'vue';
import { useToolEmbed } from '@/composables/useToolEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Pure logic - no Vue dependency below this point                             */
/* -------------------------------------------------------------------------- */

/** A parsed cookie attribute (flag attributes have `value === null`). */
export interface CookieAttribute {
  name: string;
  value: string | null;
}

/** A single parsed Set-Cookie header. */
export interface ParsedCookie {
  name: string;
  value: string;
  attributes: CookieAttribute[];
  /** The raw header line. */
  raw: string;
}

/** A flagged issue for a cookie. */
export interface CookieIssue {
  level: 'error' | 'warning' | 'info';
  message: string;
}

/** Analysis result for one cookie. */
export interface CookieAnalysis {
  cookie: ParsedCookie;
  issues: CookieIssue[];
  /** Convenience flags. */
  secure: boolean;
  httpOnly: boolean;
  sameSite: 'strict' | 'lax' | 'none' | null;
  domain: string | null;
  path: string | null;
  maxAge: number | null;
  expires: string | null;
  partitioned: boolean;
  isSession: boolean;
  prefix: '__Host-' | '__Secure-' | '__Http-' | null;
}

/**
 * Split a pasted input into individual Set-Cookie header strings. Accepts
 * one cookie per line, a raw HTTP header block (`Set-Cookie: ...` lines), or
 * a single line. Returns raw cookie strings (without the `Set-Cookie:` prefix).
 */
export function splitSetCookieLines(input: string): string[] {
  const out: string[] = [];
  for (const rawLine of input.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const m = /^set-cookie:\s*(.+)$/i.exec(line);
    out.push((m ? m[1]! : line).trim());
  }
  return out.filter(Boolean);
}

/**
 * Parse a single Set-Cookie header string. The first `name=value` pair is the
 * cookie; subsequent `;`-separated tokens are attributes (flag attributes
 * like `Secure`/`HttpOnly`/`Partitioned` have no `=`).
 */
export function parseSetCookie(header: string): ParsedCookie | null {
  const parts = header.split(';');
  const first = parts[0]?.trim();
  if (!first) return null;
  const eq = first.indexOf('=');
  if (eq < 0) return null;
  const name = first.slice(0, eq).trim();
  const value = first.slice(eq + 1).trim();
  if (!name) return null;
  const attributes: CookieAttribute[] = [];
  for (const part of parts.slice(1)) {
    const p = part.trim();
    if (!p) continue;
    const i = p.indexOf('=');
    if (i < 0) attributes.push({ name: p, value: null });
    else attributes.push({ name: p.slice(0, i).trim(), value: p.slice(i + 1).trim() });
  }
  return { name, value, attributes, raw: header };
}

function attr(c: ParsedCookie, name: string): CookieAttribute | undefined {
  const n = name.toLowerCase();
  return c.attributes.find((a) => a.name.toLowerCase() === n);
}
function hasFlag(c: ParsedCookie, name: string): boolean {
  return attr(c, name) !== undefined;
}

/** Analyze a single parsed cookie and return issues + extracted flags. */
export function analyzeCookie(cookie: ParsedCookie): CookieAnalysis {
  const issues: CookieIssue[] = [];
  const secure = hasFlag(cookie, 'secure');
  const httpOnly = hasFlag(cookie, 'httponly');
  const partitioned = hasFlag(cookie, 'partitioned');
  const sameSiteAttr = attr(cookie, 'samesite');
  const sameSiteRaw = sameSiteAttr?.value?.toLowerCase() ?? null;
  const sameSite =
    sameSiteRaw === 'strict' || sameSiteRaw === 'lax' || sameSiteRaw === 'none'
      ? (sameSiteRaw as 'strict' | 'lax' | 'none')
      : null;
  const domain = attr(cookie, 'domain')?.value ?? null;
  const path = attr(cookie, 'path')?.value ?? null;
  const maxAgeRaw = attr(cookie, 'max-age')?.value ?? null;
  const maxAge = maxAgeRaw !== null ? Number(maxAgeRaw) : null;
  const expires = attr(cookie, 'expires')?.value ?? null;
  const isSession = maxAge === null && expires === null;

  const prefix = cookie.name.startsWith('__Host-')
    ? ('__Host-' as const)
    : cookie.name.startsWith('__Secure-')
      ? ('__Secure-' as const)
      : cookie.name.startsWith('__Http-')
        ? ('__Http-' as const)
        : null;

  // ---- Flag checks ----
  if (!secure) {
    issues.push({
      level: 'error',
      message: 'Missing Secure - the cookie can be sent over plain HTTP.',
    });
  }
  if (!httpOnly) {
    issues.push({
      level: 'warning',
      message: 'Missing HttpOnly - readable by JavaScript (XSS can steal it).',
    });
  }
  if (sameSite === null) {
    issues.push({
      level: 'warning',
      message: 'Missing/invalid SameSite - defaults to Lax in modern browsers but be explicit.',
    });
  }
  if (sameSite === 'none' && !secure) {
    issues.push({
      level: 'error',
      message: 'SameSite=None requires Secure - browsers will reject this cookie.',
    });
  }
  if (sameSite === 'none') {
    issues.push({
      level: 'info',
      message: 'SameSite=None allows cross-site sending - ensure CSRF protection.',
    });
  }

  // ---- Scope checks ----
  if (domain) {
    const d = domain.replace(/^\./, '');
    const labels = d.split('.').filter(Boolean).length;
    if (labels <= 2) {
      issues.push({
        level: 'warning',
        message: `Domain=${d} is broad - the cookie is sent to every subdomain.`,
      });
    }
  }
  if (path && path !== '/') {
    // Narrow path is fine; only note when it's unusually permissive is not an issue.
  } else if (path === null) {
    issues.push({
      level: 'info',
      message: 'No Path - defaults to the request path directory.',
    });
  }

  // ---- Prefix rules (RFC 6265bis) ----
  if (prefix === '__Host-') {
    if (!secure) {
      issues.push({ level: 'error', message: '__Host- requires Secure.' });
    }
    if (domain) {
      issues.push({ level: 'error', message: '__Host- must NOT set Domain.' });
    }
    if (path !== '/') {
      issues.push({ level: 'error', message: '__Host- requires Path=/.' });
    }
  } else if (prefix === '__Secure-' || prefix === '__Http-') {
    if (!secure) {
      issues.push({ level: 'error', message: `${prefix} requires Secure.` });
    }
  } else {
    issues.push({
      level: 'info',
      message: 'Consider a __Host- prefix for session cookies (locks to host + Path=/).',
    });
  }

  // ---- Lifetime ----
  if (maxAge !== null && (Number.isNaN(maxAge) || !Number.isFinite(maxAge))) {
    issues.push({ level: 'error', message: `Max-Age "${maxAgeRaw}" is not a number.` });
  }
  if (maxAge !== null && maxAge <= 0) {
    issues.push({ level: 'info', message: 'Max-Age <= 0 deletes the cookie.' });
  }
  if (isSession) {
    issues.push({ level: 'info', message: 'Session cookie - cleared when the browser closes.' });
  }
  if (expires !== null && Number.isNaN(Date.parse(expires))) {
    issues.push({ level: 'warning', message: `Expires "${expires}" is not a parseable date.` });
  }
  if (partitioned) {
    issues.push({ level: 'info', message: 'Partitioned (CHIPS) - cookie is isolated per top-level site.' });
  }

  return {
    cookie,
    issues,
    secure,
    httpOnly,
    sameSite,
    domain,
    path,
    maxAge,
    expires,
    partitioned,
    isSession,
    prefix,
  };
}

/** Parse and analyze every cookie in the pasted input. */
export function analyzeCookies(input: string): CookieAnalysis[] {
  return splitSetCookieLines(input)
    .map(parseSetCookie)
    .filter((c): c is ParsedCookie => c !== null)
    .map(analyzeCookie);
}

/* -------------------------------------------------------------------------- */
/* Composable - reactive state + embed integration                             */
/* -------------------------------------------------------------------------- */

export interface UseCookieFlagsAnalyzerReturn {
  input: Ref<string>;
  results: Ref<CookieAnalysis[]>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  clear: () => void;
}

export function useCookieFlagsAnalyzer(): UseCookieFlagsAnalyzerReturn {
  const input = ref<string>('');
  const results = ref<CookieAnalysis[]>([]);

  function recompute(): void {
    results.value = input.value.trim() ? analyzeCookies(input.value) : [];
  }

  function clear(): void {
    input.value = '';
  }

  watch(input, recompute, { immediate: true });

  const { isEmbed, input: embedInput } = useToolEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.input === 'string') input.value = p.input;
      else if (typeof p.header === 'string') input.value = p.header;
      else if (typeof p.setCookie === 'string') input.value = p.setCookie;
    },
    output: results,
    toOutput: () => ({
      count: results.value.length,
      cookies: results.value.map((c) => ({
        name: c.cookie.name,
        secure: c.secure,
        httpOnly: c.httpOnly,
        sameSite: c.sameSite,
        issues: c.issues.map((i) => `${i.level}: ${i.message}`),
      })),
    }),
  });

  return { input, results, isEmbed, embedInput, clear };
}
