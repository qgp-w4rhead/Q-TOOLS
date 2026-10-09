/**
 * useTimezoneDatabase - composable for IANA timezone database.
 *
 * Lists IANA timezones with current offsets and DST info via
 * Intl.supportedValuesOf('timeZone') and Intl.DateTimeFormat.
 *
 * No external dependencies.
 */
import { ref, computed, type Ref } from 'vue';
import { useToolEmbed } from '@/composables/useToolEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

export interface TimezoneInfo {
  id: string;
  offset: string;
  offsetMinutes: number;
  isDST: boolean;
  region: string;
  city: string;
}

export interface UseTimezoneDatabaseReturn {
  query: Ref<string>;
  timezones: Ref<TimezoneInfo[]>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  reset: () => void;
}

/* -------------------------------------------------------------------------- */
/* Pure logic                                                                 */
/* -------------------------------------------------------------------------- */

/** Get all supported IANA timezone identifiers. */
export function getSupportedTimezones(): string[] {
  try {
    const values = Intl.supportedValuesOf('timeZone');
    if (values.length > 0) return values;
  } catch {
    // Fallback if Intl.supportedValuesOf is not available
  }
  return FALLBACK_TIMEZONES;
}

/** Compute the current UTC offset (in minutes) for a timezone. */
export function getTimezoneOffset(tz: string): { offsetMinutes: number; offset: string; isDST: boolean } {
  try {
    const now = new Date();
    const longOffset = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      timeZoneName: 'longOffset',
    }).formatToParts(now);
    const offsetPart = longOffset.find((p) => p.type === 'timeZoneName');
    const offsetStr = offsetPart?.value ?? 'GMT+0'; // eslint-disable-line @typescript-eslint/no-unused-vars

    // Parse "GMT+05:30" or "GMT-08:00" → minutes
    const match = offsetStr.match(/GMT([+-])(\d{1,2}):?(\d{2})?/);
    let offsetMinutes = 0;
    if (match) {
      const sign = match[1] === '-' ? -1 : 1;
      const hours = parseInt(match[2] ?? '0', 10);
      const minutes = match[3] ? parseInt(match[3], 10) : 0;
      offsetMinutes = sign * (hours * 60 + minutes);
    }

    // Check DST by comparing January vs July offsets
    const jan = new Date(now.getFullYear(), 0, 15);
    const jul = new Date(now.getFullYear(), 6, 15);
    const janOffset = getOffsetForDate(tz, jan);
    const julOffset = getOffsetForDate(tz, jul);
    const isDST = janOffset !== julOffset;

    return { offsetMinutes, offset: formatOffset(offsetMinutes), isDST };
  } catch {
    return { offsetMinutes: 0, offset: '+00:00', isDST: false };
  }
}

function getOffsetForDate(tz: string, date: Date): number {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      timeZoneName: 'shortOffset',
    }).formatToParts(date);
    const offsetPart = parts.find((p) => p.type === 'timeZoneName');
    const offsetStr = offsetPart?.value ?? 'GMT+0';
    const match = offsetStr.match(/GMT([+-])(\d{1,2}):?(\d{2})?/); // eslint-disable-line @typescript-eslint/no-unused-vars
    if (!match) return 0;
    const sign = match[1] === '-' ? -1 : 1;
    const hours = parseInt(match[2] ?? '0', 10);
    const minutes = match[3] ? parseInt(match[3], 10) : 0;
    return sign * (hours * 60 + minutes);
  } catch {
    return 0;
  }
}

function formatOffset(minutes: number): string {
  const sign = minutes >= 0 ? '+' : '-';
  const abs = Math.abs(minutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `${sign}${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Split "America/New_York" → { region: "America", city: "New York" } */
export function parseTimezoneId(id: string): { region: string; city: string } {
  const slashIdx = id.indexOf('/');
  if (slashIdx === -1) return { region: id, city: id };
  const region = id.slice(0, slashIdx);
  const city = id.slice(slashIdx + 1).replace(/_/g, ' ');
  return { region, city };
}

/** Build full timezone info list. */
export function buildTimezoneList(ids: string[]): TimezoneInfo[] {
  return ids.map((id) => {
    const { offsetMinutes, offset, isDST } = getTimezoneOffset(id);
    const { region, city } = parseTimezoneId(id);
    return { id, offset, offsetMinutes, isDST, region, city };
  });
}

/** Filter timezones by query (matches id, region, or city). */
export function filterTimezones(timezones: TimezoneInfo[], query: string): TimezoneInfo[] {
  const q = query.trim().toLowerCase();
  if (!q) return timezones;
  return timezones.filter((tz) => {
    return (
      tz.id.toLowerCase().includes(q) ||
      tz.region.toLowerCase().includes(q) ||
      tz.city.toLowerCase().includes(q) ||
      tz.offset.includes(q)
    );
  });
}

const FALLBACK_TIMEZONES = [
  'UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'America/Anchorage', 'America/Sao_Paulo', 'America/Toronto', 'America/Mexico_City',
  'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Madrid', 'Europe/Rome',
  'Europe/Amsterdam', 'Europe/Brussels', 'Europe/Stockholm', 'Europe/Oslo', 'Europe/Copenhagen',
  'Europe/Helsinki', 'Europe/Warsand', 'Europe/Athens', 'Europe/Istanbul', 'Europe/Moscow',
  'Asia/Tokyo', 'Asia/Shanghai', 'Asia/Hong_Kong', 'Asia/Singapore', 'Asia/Seoul',
  'Asia/Bangkok', 'Asia/Jakarta', 'Asia/Kolkata', 'Asia/Dubai', 'Asia/Tehran',
  'Asia/Karachi', 'Asia/Manila', 'Australia/Sydney', 'Australia/Melbourne', 'Australia/Perth',
  'Pacific/Auckland', 'Pacific/Honolulu', 'Africa/Cairo', 'Africa/Johannesburg', 'Africa/Lagos',
  'Africa/Nairobi',
];

/* -------------------------------------------------------------------------- */
/* Composable                                                                  */
/* -------------------------------------------------------------------------- */

export function useTimezoneDatabase(): UseTimezoneDatabaseReturn {
  const query = ref<string>('');
  const allTimezones = ref<TimezoneInfo[]>(buildTimezoneList(getSupportedTimezones()));
  const timezones = computed(() => filterTimezones(allTimezones.value, query.value)) as unknown as Ref<TimezoneInfo[]>;

  function reset(): void {
    query.value = '';
  }

  const { isEmbed, input: embedInput } = useToolEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.query === 'string') query.value = p.query;
    },
    output: timezones,
    toOutput: () => ({ timezones: timezones.value }),
  });

  return {
    query,
    timezones,
    isEmbed,
    embedInput,
    reset,
  };
}
