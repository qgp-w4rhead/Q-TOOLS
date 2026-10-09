/**
 * useUrlParser - composable + pure logic for the URL parser tool.
 *
 * Parses an input URL into its components (protocol, username, password,
 * host, port, path, query params, hash) using the native `URL` API, then
 * lets the user edit any component (including the query params as a
 * key/value table) and rebuilds the URL live.
 *
 * Pure helpers (`parseUrl`, `buildUrl`, `parseQueryParams`,
 * `serializeQueryParams`, `normalizeUrlInput`) have no Vue dependency and can
 * be imported standalone for unit testing or reuse. The `useUrlParser()`
 * composable wraps them in reactive state and wires up the embed PostMessage
 * protocol.
 *
 * No external dependencies - only the native `URL` / `URLSearchParams` APIs.
 */
import { ref, watch, type Ref } from 'vue';
import { useEmbed } from '@/composables/useEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Pure logic - no Vue dependency below this point                             */
/* -------------------------------------------------------------------------- */

/** A single query parameter row in the editable table. */
export interface QueryParam {
  /** Stable id used by the UI to track rows across add/remove operations. */
  id: number;
  /** Parameter name (key). May be empty for a `=value`-style entry. */
  key: string;
  /** Parameter value. `null` means "no `=` sign" (bare key). */
  value: string | null;
}

/** Parsed URL components. */
export interface ParsedUrl {
  /** Protocol including trailing `:`, e.g. `https:`. Empty when absent. */
  protocol: string;
  /** Username part of the userinfo. Empty when absent. */
  username: string;
  /** Password part of the userinfo. Empty when absent. */
  password: string;
  /** Hostname (no port), e.g. `example.com`. Empty when absent. */
  hostname: string;
  /** Port as a string (preserves leading zeros / non-numeric edge cases). */
  port: string;
  /** Pathname including leading `/`, e.g. `/path/to/resource`. */
  pathname: string;
  /** Hash including leading `#`, e.g. `#section`. Empty when absent. */
  hash: string;
  /** Parsed query parameters as editable rows. */
  searchParams: QueryParam[];
  /** Origin (`protocol://host[:port]`) - read-only convenience. */
  origin: string;
}

/** Result of a parse attempt. */
export interface ParseResult {
  /** `true` when the URL was successfully parsed. */
  ok: boolean;
  /** Parsed components when `ok`, otherwise `null`. */
  parsed: ParsedUrl | null;
  /** Human-readable error message when `!ok`. */
  error: string;
}

let nextParamId = 1;
function makeParamId(): number {
  return nextParamId++;
}

/**
 * Normalize raw user input into something the `URL` constructor can parse.
 *
 * The `URL` constructor requires an absolute URL with a scheme. Many users
 * paste a bare `example.com/path?x=1` (no scheme). We prepend `https://` in
 * that case so the tool is forgiving. We do **not** alter input that already
 * has a scheme (`http:`, `mailto:`, `file:`, `ws:`, custom schemes, etc.).
 */
export function normalizeUrlInput(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return '';
  // Already has a scheme? `URL` accepts `scheme:` forms. Detect an explicit
  // scheme: an ASCII letter followed by letters/digits/+/-/. and a colon
  // before any `/`, `?` or `#`.
  const schemeMatch = /^([a-zA-Z][a-zA-Z0-9+.-]*):/.exec(trimmed);
  if (schemeMatch) return trimmed;
  // No scheme - prepend `https://` (but never for protocol-relative `//`).
  if (trimmed.startsWith('//')) return `https:${trimmed}`;
  return `https://${trimmed}`;
}

/**
 * Parse a query string (with or without leading `?`) into ordered
 * `QueryParam` rows.
 *
 * Each `&`-separated segment becomes one row, preserving duplicates and
 * order. A segment with no `=` sign yields `value: null` (a bare key); a
 * segment with `=` but an empty value (`key=`) yields `value: ''`. Keys and
 * values are percent-decoded via `decodeURIComponent` (invalid escape
 * sequences fall back to the raw substring so a malformed entry is never
 * dropped silently).
 */
export function parseQueryParams(search: string): QueryParam[] {
  const body = search.startsWith('?') ? search.slice(1) : search;
  if (body.length === 0) return [];
  const rows: QueryParam[] = [];
  for (const segment of body.split('&')) {
    if (segment.length === 0) continue; // skip empty segments (trailing `&`)
    const eq = segment.indexOf('=');
    let key: string;
    let value: string | null;
    if (eq === -1) {
      key = segment;
      value = null;
    } else {
      key = segment.slice(0, eq);
      value = segment.slice(eq + 1);
    }
    rows.push({
      id: makeParamId(),
      key: safeDecode(key),
      value: value === null ? null : safeDecode(value),
    });
  }
  return rows;
}

/** Percent-decode, falling back to the raw string on bad escape sequences. */
function safeDecode(input: string): string {
  try {
    return decodeURIComponent(input);
  } catch {
    // Replace lone `%` with `%25` and retry, or just return raw on failure.
    try {
      return decodeURIComponent(input.replace(/%(?![0-9A-Fa-f]{2})/g, '%25'));
    } catch {
      return input;
    }
  }
}

/**
 * Serialize `QueryParam` rows back into a query string (without leading `?`).
 *
 * - Rows with an empty key AND empty/null value are skipped (they contribute
 *   nothing meaningful).
 * - `value: null` produces a bare `key` (no `=`).
 * - `value: ''` produces `key=`.
 * - Duplicate keys are preserved (multiple rows with the same key emit
 *   multiple `key=value` pairs).
 */
export function serializeQueryParams(params: QueryParam[]): string {
  const parts: string[] = [];
  for (const p of params) {
    if (p.key.length === 0 && (p.value === null || p.value.length === 0)) {
      continue;
    }
    const encodedKey = encodeURIComponent(p.key);
    if (p.value === null) {
      parts.push(encodedKey);
    } else {
      parts.push(`${encodedKey}=${encodeURIComponent(p.value)}`);
    }
  }
  return parts.join('&');
}

/**
 * Parse a URL string into structured components.
 *
 * Accepts the raw user input (which may omit the scheme) and returns a
 * `ParseResult`. When parsing fails, `error` contains a friendly message.
 */
export function parseUrl(raw: string): ParseResult {
  const normalized = normalizeUrlInput(raw);
  if (normalized.length === 0) {
    return { ok: false, parsed: null, error: 'Enter a URL to parse.' };
  }
  let url: URL;
  try {
    url = new URL(normalized);
  } catch (e) {
    const msg = e instanceof TypeError ? e.message : String(e);
    return { ok: false, parsed: null, error: `Invalid URL: ${msg}` };
  }
  // `URL` always lowercases the protocol and includes the trailing colon.
  // `url.username` / `url.password` are decoded by the URL parser.
  const parsed: ParsedUrl = {
    protocol: url.protocol,
    username: url.username,
    password: url.password,
    hostname: url.hostname,
    port: url.port,
    pathname: url.pathname,
    hash: url.hash,
    searchParams: parseQueryParams(url.search),
    origin: url.origin,
  };
  return { ok: true, parsed, error: '' };
}

/**
 * Rebuild a URL string from edited components.
 *
 * Uses the `URL` API to assemble the final string so percent-encoding is
 * applied correctly. Returns the serialized URL, or `null` when the
 * components do not form a valid URL (e.g. empty hostname with a non-special
 * scheme is fine, but an invalid port is not).
 */
export function buildUrl(components: {
  protocol: string;
  username: string;
  password: string;
  hostname: string;
  port: string;
  pathname: string;
  searchParams: QueryParam[];
  hash: string;
}): string | null {
  // Construct a base URL. We need *some* valid base to mutate; pick a
  // placeholder origin and replace it. For non-special schemes (e.g.
  // `mailto:`) the host/port/path concepts don't apply the same way, so we
  // fall back to a manual assembly.
  const protocol = components.protocol;
  const isSpecial = /^(https?:|ftp:|file:|ws:|wss:)$/.test(protocol);

  if (isSpecial) {
    let base: URL;
    try {
      // Start from a known-valid special URL, then override every part.
      base = new URL(`${protocol}//placeholder.invalid`);
    } catch {
      return null;
    }
    base.username = components.username;
    base.password = components.password;
    if (components.hostname.length > 0) {
      base.hostname = components.hostname;
    } else {
      // Clearing hostname on a special URL is invalid - keep placeholder.
      base.hostname = 'placeholder.invalid';
    }
    // Setting an invalid port throws; fall back to no port.
    try {
      base.port = components.port;
    } catch {
      base.port = '';
    }
    // Pathname must start with `/` for special URLs.
    const path = components.pathname.length > 0
      ? (components.pathname.startsWith('/') ? components.pathname : `/${components.pathname}`)
      : '/';
    base.pathname = path;
    base.search = serializeQueryParams(components.searchParams);
    // Hash must start with `#` - if user typed one, keep as-is; otherwise add.
    base.hash = components.hash.length > 0
      ? (components.hash.startsWith('#') ? components.hash : `#${components.hash}`)
      : '';

    // If the hostname ended up as the placeholder and the user really wanted
    // an empty host, the URL is invalid for special schemes - return null.
    if (base.hostname === 'placeholder.invalid' && components.hostname.length === 0) {
      return null;
    }
    return base.href;
  }

  // Non-special scheme (mailto:, tel:, javascript:, custom:). Build manually
  // because the URL API is picky about hosts on these schemes.
  let result = protocol;
  // Most non-special schemes have no `//authority`, but some (like `file:`)
  // do. We follow the user's lead: if hostname is non-empty, emit
  // `//host[:port]`.
  if (components.hostname.length > 0) {
    result += '//';
    if (components.username.length > 0 || components.password.length > 0) {
      result += components.username;
      if (components.password.length > 0) {
        result += `:${components.password}`;
      }
      result += '@';
    }
    result += components.hostname;
    if (components.port.length > 0) result += `:${components.port}`;
  }
  if (components.pathname.length > 0) {
    result += components.pathname;
  }
  const qs = serializeQueryParams(components.searchParams);
  if (qs.length > 0) result += `?${qs}`;
  if (components.hash.length > 0) {
    result += components.hash.startsWith('#') ? components.hash : `#${components.hash}`;
  }
  // Validate by round-tripping through the URL constructor.
  try {
    // eslint-disable-next-line no-new
    new URL(result);
  } catch {
    return null;
  }
  return result;
}

/* -------------------------------------------------------------------------- */
/* Composable - reactive state + embed integration                            */
/* -------------------------------------------------------------------------- */

export interface UrlParserOutputs {
  /** The rebuilt URL string. */
  url: string;
  /** Whether the rebuilt URL is valid. */
  valid: boolean;
}

/** Debounce window (ms) for recomputing on input changes. */
const DEBOUNCE_MS = 120;

export interface UseUrlParserReturn {
  input: Ref<string>;
  parsed: Ref<ParsedUrl | null>;
  error: Ref<string>;
  rebuilt: Ref<string>;
  rebuiltValid: Ref<boolean>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  recompute: () => void;
  /** Update a single component field (e.g. `hostname`, `port`). */
  setComponent: (field: keyof Omit<ParsedUrl, 'searchParams' | 'origin'>, value: string) => void;
  /** Replace all query params. */
  setQueryParams: (params: QueryParam[]) => void;
  /** Update a single query param row by id. */
  updateQueryParam: (id: number, patch: Partial<Pick<QueryParam, 'key' | 'value'>>) => void;
  /** Add a new empty query param row. */
  addQueryParam: () => void;
  /** Remove a query param row by id. */
  removeQueryParam: (id: number) => void;
  /** Move a query param row up (swap with previous). */
  moveQueryParamUp: (id: number) => void;
  /** Move a query param row down (swap with next). */
  moveQueryParamDown: (id: number) => void;
  /** Feed the rebuilt URL back into the input. */
  applyRebuilt: () => void;
}

export function useUrlParser(): UseUrlParserReturn {
  const input = ref<string>('');
  const parsed = ref<ParsedUrl | null>(null);
  const error = ref<string>('');
  const rebuilt = ref<string>('');
  const rebuiltValid = ref<boolean>(false);

  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  function run(): void {
    const raw = input.value;
    if (raw.trim().length === 0) {
      parsed.value = null;
      error.value = '';
      rebuilt.value = '';
      rebuiltValid.value = false;
      return;
    }
    const result = parseUrl(raw);
    if (!result.ok || !result.parsed) {
      parsed.value = null;
      error.value = result.error;
      rebuilt.value = '';
      rebuiltValid.value = false;
      return;
    }
    parsed.value = result.parsed;
    error.value = '';
    rebuild();
  }

  function rebuild(): void {
    const p = parsed.value;
    if (!p) {
      rebuilt.value = '';
      rebuiltValid.value = false;
      return;
    }
    const out = buildUrl({
      protocol: p.protocol,
      username: p.username,
      password: p.password,
      hostname: p.hostname,
      port: p.port,
      pathname: p.pathname,
      searchParams: p.searchParams,
      hash: p.hash,
    });
    if (out === null) {
      rebuilt.value = '';
      rebuiltValid.value = false;
    } else {
      rebuilt.value = out;
      rebuiltValid.value = true;
    }
  }

  function scheduleRun(): void {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = undefined;
      run();
    }, DEBOUNCE_MS);
  }

  function recompute(): void {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = undefined;
    }
    run();
  }

  function setComponent(
    field: keyof Omit<ParsedUrl, 'searchParams' | 'origin'>,
    value: string,
  ): void {
    const p = parsed.value;
    if (!p) return;
    (p as ParsedUrl)[field] = value;
    // Trigger reactivity - replace the object so watchers fire.
    parsed.value = { ...p, searchParams: p.searchParams, origin: p.origin };
    rebuild();
  }

  function setQueryParams(params: QueryParam[]): void {
    const p = parsed.value;
    if (!p) return;
    parsed.value = { ...p, searchParams: params.slice() };
    rebuild();
  }

  function updateQueryParam(
    id: number,
    patch: Partial<Pick<QueryParam, 'key' | 'value'>>,
  ): void {
    const p = parsed.value;
    if (!p) return;
    const params = p.searchParams.map((row) =>
      row.id === id ? { ...row, ...patch } : row,
    );
    parsed.value = { ...p, searchParams: params };
    rebuild();
  }

  function addQueryParam(): void {
    const p = parsed.value;
    if (!p) return;
    const params = p.searchParams.concat({
      id: makeParamId(),
      key: '',
      value: '',
    });
    parsed.value = { ...p, searchParams: params };
    rebuild();
  }

  function removeQueryParam(id: number): void {
    const p = parsed.value;
    if (!p) return;
    const params = p.searchParams.filter((row) => row.id !== id);
    parsed.value = { ...p, searchParams: params };
    rebuild();
  }

  function moveQueryParamUp(id: number): void {
    const p = parsed.value;
    if (!p) return;
    const idx = p.searchParams.findIndex((r) => r.id === id);
    if (idx <= 0) return;
    const params = p.searchParams.slice();
    const prev = params[idx - 1];
    const cur = params[idx];
    if (!prev || !cur) return;
    params[idx - 1] = cur;
    params[idx] = prev;
    parsed.value = { ...p, searchParams: params };
    rebuild();
  }

  function moveQueryParamDown(id: number): void {
    const p = parsed.value;
    if (!p) return;
    const idx = p.searchParams.findIndex((r) => r.id === id);
    if (idx === -1 || idx >= p.searchParams.length - 1) return;
    const params = p.searchParams.slice();
    const cur = params[idx];
    const next = params[idx + 1];
    if (!cur || !next) return;
    params[idx + 1] = cur;
    params[idx] = next;
    parsed.value = { ...p, searchParams: params };
    rebuild();
  }

  function applyRebuilt(): void {
    if (rebuiltValid.value && rebuilt.value.length > 0) {
      input.value = rebuilt.value;
    }
  }

  watch(input, scheduleRun);

  const { isEmbed, input: embedInput, sendOutput } = useEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.input === 'string') input.value = p.input;
    },
  });

  watch(rebuilt, (url) => {
    if (isEmbed.value) {
      sendOutput({ url, valid: rebuiltValid.value });
    }
  });

  return {
    input,
    parsed,
    error,
    rebuilt,
    rebuiltValid,
    isEmbed,
    embedInput,
    recompute,
    setComponent,
    setQueryParams,
    updateQueryParam,
    addQueryParam,
    removeQueryParam,
    moveQueryParamUp,
    moveQueryParamDown,
    applyRebuilt,
  };
}
