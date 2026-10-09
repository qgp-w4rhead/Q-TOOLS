/**
 * useCalendarConverter - composable + pure calendar math for the calendar
 * converter tool.
 *
 * Given a Gregorian calendar date, computes: Julian Day Number, day of
 * week, day of year, ISO 8601 week number/year, the equivalent Julian
 * calendar date, and whether the year is a leap year. Also supports the
 * reverse direction: Julian Day Number → Gregorian + Julian dates.
 *
 * JDN algorithms use integer arithmetic (Fliegel-Van Flandern style) so
 * results are exact for the full Date-supported range.
 *
 * No external dependencies.
 */
import { computed, ref, type ComputedRef, type Ref } from 'vue';
import { useToolEmbed } from '@/composables/useToolEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Types - pure logic (no Vue dependency)                                      */
/* -------------------------------------------------------------------------- */

export interface CalendarResult {
  /** Gregorian date as YYYY-MM-DD. */
  gregorian: string;
  /** Julian calendar date as YYYY-MM-DD. */
  julian: string;
  /** Julian Day Number (integer, noon-based). */
  jdn: number;
  /** Day of week name (e.g. "Monday"). */
  dayOfWeek: string;
  /** Day of year (1-366). */
  dayOfYear: number;
  /** ISO 8601 week number (1-53). */
  isoWeek: number;
  /** ISO 8601 week-numbering year. */
  isoYear: number;
  /** Whether the Gregorian year is a leap year. */
  isLeapYear: boolean;
}

export interface UseCalendarConverterReturn {
  /** Date input as YYYY-MM-DD (Gregorian). */
  dateInput: Ref<string>;
  /** JDN input for the reverse direction (string). */
  jdnInput: Ref<string>;
  /** Computed result for the date input, or null when invalid. */
  result: ComputedRef<CalendarResult | null>;
  /** Gregorian date derived from jdnInput, or null when invalid. */
  jdnResult: ComputedRef<CalendarResult | null>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  reset: () => void;
}

/* -------------------------------------------------------------------------- */
/* Pure logic                                                                  */
/* -------------------------------------------------------------------------- */

const DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

/** Gregorian leap-year test. */
export function isGregorianLeap(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

/**
 * Gregorian (y, m, d) → Julian Day Number. Valid for all proleptic
 * Gregorian dates. Integer arithmetic, no Date dependency.
 */
export function gregorianToJdn(y: number, m: number, d: number): number {
  const a = Math.floor((14 - m) / 12);
  const y2 = y + 4800 - a;
  const m2 = m + 12 * a - 3;
  return (
    d +
    Math.floor((153 * m2 + 2) / 5) +
    365 * y2 +
    Math.floor(y2 / 4) -
    Math.floor(y2 / 100) +
    Math.floor(y2 / 400) -
    32045
  );
}

/**
 * Julian calendar (y, m, d) → Julian Day Number.
 */
export function julianToJdn(y: number, m: number, d: number): number {
  const a = Math.floor((14 - m) / 12);
  const y2 = y + 4800 - a;
  const m2 = m + 12 * a - 3;
  return (
    d +
    Math.floor((153 * m2 + 2) / 5) +
    365 * y2 +
    Math.floor(y2 / 4) -
    32083
  );
}

/** Julian Day Number → Gregorian (y, m, d). */
export function jdnToGregorian(jdn: number): { y: number; m: number; d: number } {
  const a = jdn + 32044;
  const b = Math.floor((4 * a + 3) / 146097);
  const c = a - Math.floor(146097 * b / 4);
  const dd = Math.floor((4 * c + 3) / 1461);
  const e = c - Math.floor(1461 * dd / 4);
  const m2 = Math.floor((5 * e + 2) / 153);
  const d = e - Math.floor((153 * m2 + 2) / 5) + 1;
  const m = m2 + 3 - 12 * Math.floor(m2 / 10);
  const y = 100 * b + dd - 4800 + Math.floor(m2 / 10);
  return { y, m, d };
}

/** Julian Day Number → Julian calendar (y, m, d). */
export function jdnToJulian(jdn: number): { y: number; m: number; d: number } {
  const b = jdn + 32082;
  const c = Math.floor((4 * b + 3) / 1461);
  const e = b - Math.floor(1461 * c / 4);
  const m2 = Math.floor((5 * e + 2) / 153);
  const d = e - Math.floor((153 * m2 + 2) / 5) + 1;
  const m = m2 + 3 - 12 * Math.floor(m2 / 10);
  const y = c - 4800 + Math.floor(m2 / 10);
  return { y, m, d };
}

/** ISO 8601 week number + week-numbering year for a Gregorian date. */
export function isoWeekNumber(y: number, m: number, d: number): { week: number; year: number } {
  // Algorithm: find the Thursday of the current week; its Gregorian year is
  // the ISO week-numbering year; the week is the ordinal of that Thursday.
  const jdn = gregorianToJdn(y, m, d);
  // Day of week: (jdn + 1) % 7 → 0=Sun, 1=Mon, ..., 6=Sat.
  const dow = (jdn + 1) % 7;
  // Thursday of the same week: Mon +3, Tue +2, Wed +1, Thu 0, Fri -1,
  // Sat -2, Sun -3.
  const thursday = jdn + (4 - dow) - (dow === 0 ? 7 : 0);
  const tg = jdnToGregorian(thursday);
  const jan1 = gregorianToJdn(tg.y, 1, 1);
  const week = Math.floor((thursday - jan1) / 7) + 1;
  return { week, year: tg.y };
}

/** Day of year for a Gregorian date. */
export function dayOfYear(y: number, m: number, d: number): number {
  return gregorianToJdn(y, m, d) - gregorianToJdn(y, 1, 1) + 1;
}

function pad(n: number, w = 2): string {
  return String(Math.abs(n)).padStart(w, '0');
}
function fmt(y: number, m: number, d: number): string {
  const sign = y < 0 ? '-' : '';
  return `${sign}${pad(y, 4)}-${pad(m)}-${pad(d)}`;
}

/** Parse a YYYY-MM-DD string into {y,m,d} or null. */
export function parseDateInput(s: string): { y: number; m: number; d: number } | null {
  const match = /^(-?\d{1,6})-(\d{1,2})-(\d{1,2})$/.exec(s.trim());
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return null;
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  // Validate against the Gregorian calendar.
  if (jdnToGregorian(gregorianToJdn(y, m, d)).d !== d) return null;
  const back = jdnToGregorian(gregorianToJdn(y, m, d));
  if (back.y !== y || back.m !== m || back.d !== d) return null;
  return { y, m, d };
}

/** Compute the full calendar result for a Gregorian date. */
export function computeCalendar(y: number, m: number, d: number): CalendarResult {
  const jdn = gregorianToJdn(y, m, d);
  const jul = jdnToJulian(jdn);
  const dow = (jdn + 1) % 7; // 0=Sunday
  const iso = isoWeekNumber(y, m, d);
  return {
    gregorian: fmt(y, m, d),
    julian: fmt(jul.y, jul.m, jul.d),
    jdn,
    dayOfWeek: DAY_NAMES[dow] ?? '-',
    dayOfYear: dayOfYear(y, m, d),
    isoWeek: iso.week,
    isoYear: iso.year,
    isLeapYear: isGregorianLeap(y),
  };
}

/* -------------------------------------------------------------------------- */
/* Composable                                                                  */
/* -------------------------------------------------------------------------- */

function todayString(): string {
  const now = new Date();
  return fmt(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

export function useCalendarConverter(): UseCalendarConverterReturn {
  const dateInput = ref<string>(todayString());
  const jdnInput = ref<string>('');

  const result = computed<CalendarResult | null>(() => {
    const parsed = parseDateInput(dateInput.value);
    if (!parsed) return null;
    return computeCalendar(parsed.y, parsed.m, parsed.d);
  });

  const jdnResult = computed<CalendarResult | null>(() => {
    const s = jdnInput.value.trim();
    if (!s) return null;
    const jdn = Number(s);
    if (!Number.isInteger(jdn) || jdn < 0) return null;
    const g = jdnToGregorian(jdn);
    return computeCalendar(g.y, g.m, g.d);
  });

  function reset(): void {
    dateInput.value = todayString();
    jdnInput.value = '';
  }

  const { isEmbed, input: embedInput } = useToolEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      const dt = p.date ?? p.input ?? p.value;
      if (typeof dt === 'string' && parseDateInput(dt)) {
        dateInput.value = dt;
      }
      const j = p.jdn ?? p.julianDay;
      if (typeof j === 'string' || typeof j === 'number') {
        jdnInput.value = String(j);
      }
    },
    output: result,
    toOutput: () => {
      const r = result.value;
      if (!r) {
        return {
          gregorian: null,
          julian: null,
          jdn: null,
          dayOfWeek: null,
          dayOfYear: null,
          isoWeek: null,
          isoYear: null,
          isLeapYear: null,
        };
      }
      return { ...r };
    },
  });

  return {
    dateInput,
    jdnInput,
    result,
    jdnResult,
    isEmbed,
    embedInput,
    reset,
  };
}
