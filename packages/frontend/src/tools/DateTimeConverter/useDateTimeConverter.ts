/**
 * useDateTimeConverter — composable + pure logic for the date-time converter.
 *
 * Converts between date-time formats using only the standard `Date` object and
 * the `Intl` API (no external dependencies).
 *
 * Inputs accepted:
 *  - ISO 8601 strings (e.g. `2024-01-15T10:30:00Z`, `2024-01-15T10:30:00+02:00`)
 *  - Unix timestamps in seconds (10 digits) or milliseconds (13 digits)
 *  - RFC 2822 strings (e.g. `Mon, 15 Jan 2024 10:30:00 +0200`)
 *  - Custom token-formatted strings (e.g. `YYYY-MM-DD HH:mm:ss`)
 *  - Auto-detect mode tries each parser in turn.
 *
 * Outputs produced:
 *  - ISO 8601 (in the selected timezone)
 *  - Unix timestamp (seconds)
 *  - Unix timestamp (milliseconds)
 *  - RFC 2822
 *  - Custom token-formatted string
 *  - Relative time (via `Intl.RelativeTimeFormat`)
 *
 * The pure helpers have no Vue dependency and can be imported standalone for
 * unit testing or reuse. The `useDateTimeConverter()` composable wraps them in
 * reactive state, debounces recompute, and wires up the embed PostMessage
 * protocol.
 *
 * No external dependencies — uses only `Date` and the `Intl` API.
 */
import { ref, watch, type Ref } from 'vue';
import { useEmbed } from '@/composables/useEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Pure logic — no Vue dependency below this point                            */
/* -------------------------------------------------------------------------- */

/** Input format modes. */
export type InputFormat = 'auto' | 'iso' | 'unix-seconds' | 'unix-ms' | 'custom';

export const INPUT_FORMATS: { id: InputFormat; label: string; hint: string }[] = [
  { id: 'auto', label: 'Auto-detect', hint: 'Try ISO, Unix, RFC 2822, custom' },
  { id: 'iso', label: 'ISO 8601', hint: '2024-01-15T10:30:00Z' },
  { id: 'unix-seconds', label: 'Unix seconds', hint: '1705312200' },
  { id: 'unix-ms', label: 'Unix milliseconds', hint: '1705312200000' },
  { id: 'custom', label: 'Custom format', hint: 'Tokens: YYYY MM DD HH mm ss SSS Z' },
];

/**
 * Custom-format tokens. The formatter replaces each token with the
 * corresponding component; the parser reads fixed-width components per token.
 *
 *  Token  Meaning                       Example
 *  -----  ----------------------------  -------
 *  YYYY   4-digit year                  2024
 *  YY     2-digit year                  24
 *  MM     2-digit month (01-12)         01
 *  DD     2-digit day (01-31)           15
 *  HH     2-digit hour 00-23            10
 *  mm     2-digit minute 00-59          30
 *  ss     2-digit second 00-59          00
 *  SSS    3-digit millisecond           000
 *  Z      Offset ±HH:mm                 +02:00
 *
 * Tokens are matched longest-first so `YYYY` wins over `YY`, `SSS` over `SS`,
 * etc. Literal characters between tokens are matched verbatim.
 */
export const TOKEN_DEFS: { token: string; width: number; kind: string }[] = [
  { token: 'YYYY', width: 4, kind: 'year' },
  { token: 'YY', width: 2, kind: 'year2' },
  { token: 'MM', width: 2, kind: 'month' },
  { token: 'DD', width: 2, kind: 'day' },
  { token: 'HH', width: 2, kind: 'hour' },
  { token: 'mm', width: 2, kind: 'minute' },
  { token: 'SSS', width: 3, kind: 'ms' },
  { token: 'ss', width: 2, kind: 'second' },
  { token: 'Z', width: 0, kind: 'offset' }, // variable width
];

/** Default custom format strings. */
export const DEFAULT_INPUT_CUSTOM_FORMAT = 'YYYY-MM-DDTHH:mm:ssZ';
export const DEFAULT_OUTPUT_CUSTOM_FORMAT = 'YYYY-MM-DD HH:mm:ss';

/** Default timezone (the user's local timezone, or UTC if unavailable). */
export const DEFAULT_TIMEZONE =
  typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' : 'UTC';

/** `true` when `value` is a valid `Date` and not `NaN`. */
export function isValidDate(value: Date): boolean {
  return value instanceof Date && !Number.isNaN(value.getTime());
}

/**
 * List all IANA timezones supported by the host engine. Falls back to a small
 * curated list when `Intl.supportedValuesOf` is unavailable.
 */
export function listTimezones(): string[] {
  try {
    if (typeof Intl !== 'undefined' && typeof (Intl as unknown as {
      supportedValuesOf?: (key: string) => string[];
    }).supportedValuesOf === 'function') {
      const tz = (Intl as unknown as {
        supportedValuesOf: (key: string) => string[];
      }).supportedValuesOf('timeZone');
      if (tz && tz.length > 0) return tz;
    }
  } catch {
    /* ignore */
  }
  return [
    'UTC',
    'Africa/Cairo',
    'America/Argentina/Buenos_Aires',
    'America/Chicago',
    'America/Los_Angeles',
    'America/New_York',
    'America/Sao_Paulo',
    'Asia/Dubai',
    'Asia/Kolkata',
    'Asia/Shanghai',
    'Asia/Tokyo',
    'Australia/Sydney',
    'Europe/Amsterdam',
    'Europe/Berlin',
    'Europe/London',
    'Europe/Moscow',
    'Europe/Paris',
    'Pacific/Auckland',
  ];
}

/** Parse a Unix-seconds timestamp. Returns an invalid Date on bad input. */
export function parseUnixSeconds(text: string): Date {
  const trimmed = text.trim();
  if (!/^-?\d{1,12}$/.test(trimmed)) return new Date(NaN);
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return new Date(NaN);
  return new Date(n * 1000);
}

/** Parse a Unix-milliseconds timestamp. Returns an invalid Date on bad input. */
export function parseUnixMs(text: string): Date {
  const trimmed = text.trim();
  if (!/^-?\d{10,16}$/.test(trimmed)) return new Date(NaN);
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return new Date(NaN);
  return new Date(n);
}

/** Parse an ISO 8601 string. Returns an invalid Date on bad input. */
export function parseIso(text: string): Date {
  const trimmed = text.trim();
  if (!trimmed) return new Date(NaN);
  // `Date.parse` accepts ISO 8601 with timezone; bare date-only is also valid.
  const ms = Date.parse(trimmed);
  if (Number.isNaN(ms)) return new Date(NaN);
  return new Date(ms);
}

/** Parse an RFC 2822 string. Returns an invalid Date on bad input. */
export function parseRfc2822(text: string): Date {
  const trimmed = text.trim();
  if (!trimmed) return new Date(NaN);
  const ms = Date.parse(trimmed);
  if (Number.isNaN(ms)) return new Date(NaN);
  // Heuristic: RFC 2822 starts with a day-of-week abbreviation + comma.
  return new Date(ms);
}

/** A parsed piece of a custom format string — either a token or a literal. */
export type FormatPart =
  | { kind: 'token'; token: string }
  | { kind: 'literal'; text: string };

/**
 * Tokenise a custom format string into a list of `{ token, literal }` parts.
 * Tokens are matched longest-first; everything else is a literal.
 */
export function tokeniseFormat(format: string): FormatPart[] {
  const parts: FormatPart[] = [];
  let i = 0;
  while (i < format.length) {
    let matched: string | null = null;
    for (const def of TOKEN_DEFS) {
      if (format.startsWith(def.token, i)) {
        matched = def.token;
        break;
      }
    }
    if (matched) {
      parts.push({ kind: 'token', token: matched });
      i += matched.length;
    } else {
      // Coalesce consecutive literal chars.
      let lit = format[i]!;
      i++;
      while (i < format.length) {
        let isToken = false;
        for (const def of TOKEN_DEFS) {
          if (format.startsWith(def.token, i)) {
            isToken = true;
            break;
          }
        }
        if (isToken) break;
        lit += format[i];
        i++;
      }
      parts.push({ kind: 'literal', text: lit });
    }
  }
  return parts;
}

/**
 * Parse a custom-formatted string `text` using `format`. Returns an invalid
 * Date on failure. The timezone is interpreted as the offset embedded in the
 * string (via the `Z` token); when no `Z` token is present the components are
 * treated as local time.
 */
export function parseCustomFormat(text: string, format: string): Date {
  const trimmed = text.trim();
  if (!trimmed) return new Date(NaN);
  const parts = tokeniseFormat(format);
  let pos = 0;
  let year: number | null = null;
  let year2: number | null = null;
  let month: number | null = null;
  let day: number | null = null;
  let hour = 0;
  let minute = 0;
  let second = 0;
  let ms = 0;
  let offsetMinutes: number | null = null;

  for (const part of parts) {
    if (part.kind === 'literal') {
      if (!trimmed.startsWith(part.text, pos)) return new Date(NaN);
      pos += part.text.length;
      continue;
    }
    const def = TOKEN_DEFS.find((d) => d.token === part.token)!;
    switch (def.kind) {
      case 'year': {
        const seg = trimmed.slice(pos, pos + 4);
        if (!/^\d{4}$/.test(seg)) return new Date(NaN);
        year = Number(seg);
        pos += 4;
        break;
      }
      case 'year2': {
        const seg = trimmed.slice(pos, pos + 2);
        if (!/^\d{2}$/.test(seg)) return new Date(NaN);
        year2 = Number(seg);
        pos += 2;
        break;
      }
      case 'month': {
        const seg = trimmed.slice(pos, pos + 2);
        if (!/^\d{2}$/.test(seg)) return new Date(NaN);
        month = Number(seg);
        pos += 2;
        break;
      }
      case 'day': {
        const seg = trimmed.slice(pos, pos + 2);
        if (!/^\d{2}$/.test(seg)) return new Date(NaN);
        day = Number(seg);
        pos += 2;
        break;
      }
      case 'hour': {
        const seg = trimmed.slice(pos, pos + 2);
        if (!/^\d{2}$/.test(seg)) return new Date(NaN);
        hour = Number(seg);
        pos += 2;
        break;
      }
      case 'minute': {
        const seg = trimmed.slice(pos, pos + 2);
        if (!/^\d{2}$/.test(seg)) return new Date(NaN);
        minute = Number(seg);
        pos += 2;
        break;
      }
      case 'second': {
        const seg = trimmed.slice(pos, pos + 2);
        if (!/^\d{2}$/.test(seg)) return new Date(NaN);
        second = Number(seg);
        pos += 2;
        break;
      }
      case 'ms': {
        const seg = trimmed.slice(pos, pos + 3);
        if (!/^\d{3}$/.test(seg)) return new Date(NaN);
        ms = Number(seg);
        pos += 3;
        break;
      }
      case 'offset': {
        // ±HH:mm or Z (UTC). The `Z` token is special: a literal `Z` in the
        // input means UTC; otherwise expect `[+-]HH:mm`.
        const ch = trimmed[pos];
        if (ch === 'Z' || ch === 'z') {
          offsetMinutes = 0;
          pos += 1;
          break;
        }
        const seg = trimmed.slice(pos, pos + 6);
        const m = /^([+-])(\d{2}):(\d{2})$/.exec(seg);
        if (!m) return new Date(NaN);
        const sign = m[1] === '-' ? -1 : 1;
        const hh = Number(m[2]);
        const mm = Number(m[3]);
        if (hh > 14 || mm > 59) return new Date(NaN);
        offsetMinutes = sign * (hh * 60 + mm);
        pos += 6;
        break;
      }
      default:
        return new Date(NaN);
    }
  }
  if (pos !== trimmed.length) return new Date(NaN);

  // Resolve year (2-digit → 19xx/20xx pivot at 2000).
  let resolvedYear: number;
  if (year !== null) {
    resolvedYear = year;
  } else if (year2 !== null) {
    resolvedYear = year2 >= 50 ? 1900 + year2 : 2000 + year2;
  } else {
    resolvedYear = 1970;
  }
  const resolvedMonth = month !== null ? month - 1 : 0;
  const resolvedDay = day ?? 1;

  if (offsetMinutes !== null) {
    // Build as UTC then subtract the offset to get the correct instant.
    const utcMs = Date.UTC(
      resolvedYear,
      resolvedMonth,
      resolvedDay,
      hour,
      minute,
      second,
      ms,
    );
    return new Date(utcMs - offsetMinutes * 60 * 1000);
  }
  return new Date(
    resolvedYear,
    resolvedMonth,
    resolvedDay,
    hour,
    minute,
    second,
    ms,
  );
}

/**
 * Get the date-time components in a specific IANA timezone. Returns the parts
 * needed to build ISO/custom strings + the offset string.
 */
export function getZonedParts(date: Date, timeZone: string): {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  second: number;
  ms: number;
  offsetMinutes: number;
  offsetString: string;
} {
  // Use Intl.DateTimeFormat with formatToParts to get the wall-clock components
  // in the target timezone, plus the long offset string for the offset.
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3,
    hour12: false,
    timeZoneName: 'longOffset',
  });
  const parts = dtf.formatToParts(date);
  const map: Record<string, string> = {};
  for (const p of parts) {
    if (p.type !== 'literal') map[p.type] = p.value;
  }
  // `hour12: false` still emits "24" for midnight on some engines; normalise.
  let hour = Number(map.hour ?? '0');
  if (hour === 24) hour = 0;
  const year = Number(map.year ?? '1970');
  const month = Number(map.month ?? '1');
  const day = Number(map.day ?? '1');
  const minute = Number(map.minute ?? '0');
  const second = Number(map.second ?? '0');
  const ms = Number(map.fractionalSecond ?? '0');
  // Offset string looks like "GMT+02:00" or "GMT" or "GMT-05:00".
  const rawOffset = map.timeZoneName ?? 'GMT';
  const offsetString = normaliseOffsetString(rawOffset);
  const offsetMinutes = parseOffsetString(offsetString);
  return { year, month, day, hour, minute, second, ms, offsetMinutes, offsetString };
}

/** Normalise an Intl offset string like "GMT+02:00" / "GMT" / "GMT-05:30" → "+02:00" / "Z" / "-05:30". */
export function normaliseOffsetString(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed === 'GMT' || trimmed === 'UTC') return 'Z';
  const m = /^GMT([+-])(\d{1,2}):?(\d{2})?$/.exec(trimmed);
  if (!m) return 'Z';
  const sign = m[1]!;
  const hh = m[2]!.padStart(2, '0');
  const mm = (m[3] ?? '0').padStart(2, '0');
  // A zero offset is conventionally rendered as "Z" (UTC) in ISO 8601.
  if (sign === '+' && hh === '00' && mm === '00') return 'Z';
  return `${sign}${hh}:${mm}`;
}

/** Parse an offset string like "+02:00" / "-05:30" / "Z" → minutes. */
export function parseOffsetString(s: string): number {
  if (s === 'Z') return 0;
  const m = /^([+-])(\d{2}):(\d{2})$/.exec(s);
  if (!m) return 0;
  const sign = m[1] === '-' ? -1 : 1;
  return sign * (Number(m[2]) * 60 + Number(m[3]));
}

/** Pad a number to a fixed width with leading zeros. */
function pad(n: number, width: number): string {
  const s = Math.abs(n).toString().padStart(width, '0');
  return n < 0 ? '-' + s : s;
}

/** Format a `Date` as ISO 8601 in the given timezone (e.g. `2024-01-15T10:30:00.000+02:00`). */
export function formatIso(date: Date, timeZone: string): string {
  if (!isValidDate(date)) return '';
  const p = getZonedParts(date, timeZone);
  const y = pad(p.year, 4);
  const mo = pad(p.month, 2);
  const d = pad(p.day, 2);
  const h = pad(p.hour, 2);
  const mi = pad(p.minute, 2);
  const s = pad(p.second, 2);
  const ms = pad(p.ms, 3);
  return `${y}-${mo}-${d}T${h}:${mi}:${s}.${ms}${p.offsetString}`;
}

/** Format a `Date` as Unix seconds. */
export function formatUnixSeconds(date: Date): string {
  if (!isValidDate(date)) return '';
  return Math.floor(date.getTime() / 1000).toString();
}

/** Format a `Date` as Unix milliseconds. */
export function formatUnixMs(date: Date): string {
  if (!isValidDate(date)) return '';
  return date.getTime().toString();
}

/** Format a `Date` as RFC 2822 in the given timezone (e.g. `Mon, 15 Jan 2024 10:30:00 +0200`). */
export function formatRfc2822(date: Date, timeZone: string): string {
  if (!isValidDate(date)) return '';
  const p = getZonedParts(date, timeZone);
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  // Compute the day-of-week in the target timezone by building a UTC Date from
  // the zoned parts + offset and reading its UTC day.
  const zonedUtcMs = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second, p.ms);
  const dow = new Date(zonedUtcMs).getUTCDay();
  const offset = p.offsetString === 'Z' ? '+0000' : p.offsetString.replace(':', '');
  return `${days[dow]}, ${pad(p.day, 2)} ${months[p.month - 1]} ${p.year} ${pad(p.hour, 2)}:${pad(p.minute, 2)}:${pad(p.second, 2)} ${offset}`;
}

/** Format a `Date` using a custom token format in the given timezone. */
export function formatCustom(date: Date, format: string, timeZone: string): string {
  if (!isValidDate(date)) return '';
  const p = getZonedParts(date, timeZone);
  const parts = tokeniseFormat(format);
  let out = '';
  for (const part of parts) {
    if (part.kind === 'literal') {
      out += part.text;
      continue;
    }
    switch (part.token) {
      case 'YYYY': out += pad(p.year, 4); break;
      case 'YY': out += pad(p.year % 100, 2); break;
      case 'MM': out += pad(p.month, 2); break;
      case 'DD': out += pad(p.day, 2); break;
      case 'HH': out += pad(p.hour, 2); break;
      case 'mm': out += pad(p.minute, 2); break;
      case 'ss': out += pad(p.second, 2); break;
      case 'SSS': out += pad(p.ms, 3); break;
      case 'Z': out += p.offsetString; break;
      default: out += part.token; break;
    }
  }
  return out;
}

/**
 * Format a `Date` as a relative time string (e.g. "in 2 days", "3 hours ago")
 * using `Intl.RelativeTimeFormat`. `now` defaults to the current time.
 */
export function formatRelative(date: Date, now: Date = new Date()): string {
  if (!isValidDate(date)) return '';
  const diffMs = date.getTime() - now.getTime();
  const abs = Math.abs(diffMs);
  const sign = diffMs < 0 ? -1 : 1;
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

  // Each entry is the threshold (in current units) below which we render in
  // that unit. We start in seconds and divide by each threshold as we go.
  const divisions: { threshold: number; unit: Intl.RelativeTimeFormatUnit }[] = [
    { threshold: 60, unit: 'second' },
    { threshold: 60, unit: 'minute' },
    { threshold: 24, unit: 'hour' },
    { threshold: 7, unit: 'day' },
    { threshold: 4.34524, unit: 'week' },
    { threshold: 12, unit: 'month' },
  ];
  let duration = abs / 1000; // seconds
  for (const div of divisions) {
    if (duration < div.threshold) {
      return rtf.format(sign * Math.round(duration), div.unit);
    }
    duration /= div.threshold;
  }
  // Beyond 12 months → years.
  return rtf.format(sign * Math.round(duration), 'year');
}

/** Parse `text` according to `format` (auto-detect when `auto`). Returns `null` on failure. */
export function parseInput(
  text: string,
  format: InputFormat,
  customFormat: string,
): Date | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  let date: Date;
  switch (format) {
    case 'iso':
      date = parseIso(trimmed);
      break;
    case 'unix-seconds':
      date = parseUnixSeconds(trimmed);
      break;
    case 'unix-ms':
      date = parseUnixMs(trimmed);
      break;
    case 'custom':
      date = parseCustomFormat(trimmed, customFormat);
      break;
    case 'auto':
    default: {
      date = tryAutoParse(trimmed, customFormat);
      break;
    }
  }
  return isValidDate(date) ? date : null;
}

/** Auto-detect: try ISO, Unix seconds, Unix ms, RFC 2822, then custom. */
export function tryAutoParse(text: string, customFormat: string): Date {
  // ISO 8601 heuristic: contains a `T` or a `-`-separated date, or ends with `Z`.
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) {
    const d = parseIso(text);
    if (isValidDate(d)) return d;
  }
  // Unix seconds: 1-10 digit positive integer (≤ 9999999999 → before 2286).
  if (/^-?\d{1,10}$/.test(text)) {
    const d = parseUnixSeconds(text);
    if (isValidDate(d)) return d;
  }
  // Unix ms: 11-16 digit integer.
  if (/^-?\d{11,16}$/.test(text)) {
    const d = parseUnixMs(text);
    if (isValidDate(d)) return d;
  }
  // RFC 2822: starts with a 3-letter day + comma.
  if (/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun),\s/.test(text)) {
    const d = parseRfc2822(text);
    if (isValidDate(d)) return d;
  }
  // Fallback: let `Date.parse` try anything (locale-dependent but useful).
  const fallback = new Date(text);
  if (isValidDate(fallback)) return fallback;
  // Custom format last resort.
  const d = parseCustomFormat(text, customFormat);
  if (isValidDate(d)) return d;
  return new Date(NaN);
}

/** The full set of computed outputs for a parsed date. */
export interface DateTimeOutputs {
  iso: string;
  unixSeconds: string;
  unixMs: string;
  rfc2822: string;
  custom: string;
  relative: string;
}

/** Compute all outputs for a parsed `Date` in `timeZone` with `customFormat`. */
export function computeOutputs(
  date: Date,
  timeZone: string,
  customFormat: string,
): DateTimeOutputs {
  return {
    iso: formatIso(date, timeZone),
    unixSeconds: formatUnixSeconds(date),
    unixMs: formatUnixMs(date),
    rfc2822: formatRfc2822(date, timeZone),
    custom: formatCustom(date, customFormat, timeZone),
    relative: formatRelative(date),
  };
}

/* -------------------------------------------------------------------------- */
/* Composable — reactive state + embed integration                            */
/* -------------------------------------------------------------------------- */

export interface DateTimeConverterConfig {
  input: string;
  format: InputFormat;
  customFormat: string;
  outputCustomFormat: string;
  timeZone: string;
}

export const DEFAULT_CONFIG: DateTimeConverterConfig = {
  input: '',
  format: 'auto',
  customFormat: DEFAULT_INPUT_CUSTOM_FORMAT,
  outputCustomFormat: DEFAULT_OUTPUT_CUSTOM_FORMAT,
  timeZone: DEFAULT_TIMEZONE,
};

/** Debounce window (ms) for recomputing on input changes. */
const DEBOUNCE_MS = 150;

export interface UseDateTimeConverterReturn {
  input: Ref<string>;
  format: Ref<InputFormat>;
  customFormat: Ref<string>;
  outputCustomFormat: Ref<string>;
  timeZone: Ref<string>;
  date: Ref<Date | null>;
  outputs: Ref<DateTimeOutputs | null>;
  error: Ref<string>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  timezones: string[];
  recompute: () => void;
  setFormat: (f: InputFormat) => void;
  setTimeZone: (tz: string) => void;
  now: () => void;
}

export function useDateTimeConverter(): UseDateTimeConverterReturn {
  const input = ref<string>('');
  const format = ref<InputFormat>('auto');
  const customFormat = ref<string>(DEFAULT_INPUT_CUSTOM_FORMAT);
  const outputCustomFormat = ref<string>(DEFAULT_OUTPUT_CUSTOM_FORMAT);
  const timeZone = ref<string>(DEFAULT_TIMEZONE);
  const date = ref<Date | null>(null);
  const outputs = ref<DateTimeOutputs | null>(null);
  const error = ref<string>('');

  const timezones = listTimezones();

  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  function run(): void {
    const text = input.value;
    if (!text.trim()) {
      date.value = null;
      outputs.value = null;
      error.value = '';
      return;
    }
    const parsed = parseInput(text, format.value, customFormat.value);
    if (!parsed) {
      date.value = null;
      outputs.value = null;
      error.value = 'Could not parse the input. Try a different format mode.';
      return;
    }
    date.value = parsed;
    error.value = '';
    outputs.value = computeOutputs(parsed, timeZone.value, outputCustomFormat.value);
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

  function setFormat(f: InputFormat): void {
    format.value = f;
  }

  function setTimeZone(tz: string): void {
    timeZone.value = tz;
  }

  /** Set the input to the current time (in the selected timezone's ISO form). */
  function now(): void {
    const d = new Date();
    input.value = formatIso(d, timeZone.value);
    format.value = 'iso';
  }

  // Recompute (debounced) whenever inputs change.
  watch(input, scheduleRun);
  watch(format, scheduleRun);
  watch(customFormat, scheduleRun);
  watch(outputCustomFormat, scheduleRun);
  watch(timeZone, scheduleRun);

  const { isEmbed, input: embedInput, sendOutput } = useEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.input === 'string') input.value = p.input;
      if (typeof p.format === 'string') {
        const f = p.format as InputFormat;
        if (INPUT_FORMATS.some((x) => x.id === f)) format.value = f;
      }
      if (typeof p.customFormat === 'string') customFormat.value = p.customFormat;
      if (typeof p.outputCustomFormat === 'string') outputCustomFormat.value = p.outputCustomFormat;
      if (typeof p.timeZone === 'string' && timezones.includes(p.timeZone)) timeZone.value = p.timeZone;
    },
  });

  // Relay output to the parent whenever the result changes (embed mode only).
  watch(outputs, (o) => {
    if (isEmbed.value) {
      sendOutput(o ?? {});
    }
  });

  return {
    input,
    format,
    customFormat,
    outputCustomFormat,
    timeZone,
    date,
    outputs,
    error,
    isEmbed,
    embedInput,
    timezones,
    recompute,
    setFormat,
    setTimeZone,
    now,
  };
}
