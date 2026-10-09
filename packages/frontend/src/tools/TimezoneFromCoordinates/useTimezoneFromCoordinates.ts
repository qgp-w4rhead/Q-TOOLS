/**
 * useTimezoneFromCoordinates - composable + pure logic for timezone estimation.
 *
 * Estimates timezone and UTC offset from latitude/longitude using a simplified
 * longitude-based calculation. Each 15° of longitude = 1 hour offset.
 * For more accuracy, this can be augmented with a timezone polygon lookup API.
 *
 * No external dependencies - pure arithmetic only.
 */
import { ref, watch, type Ref } from 'vue';
import { useToolEmbed } from '@/composables/useToolEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Types                                                                       */
/* -------------------------------------------------------------------------- */

export interface TimezoneResult {
  ok: boolean;
  message?: string;
  lat: number | null;
  lon: number | null;
  utcOffsetHours: number | null;
  utcOffsetLabel: string | null;
  estimatedTimezone: string | null;
  localTime: string | null;
}

/* -------------------------------------------------------------------------- */
/* Constants - rough timezone bands by longitude                                */
/* -------------------------------------------------------------------------- */

interface TimezoneBand {
  minLon: number;
  maxLon: number;
  offset: number;
  name: string;
}

// Simplified timezone bands - each covers 15° of longitude
const TIMEZONE_BANDS: TimezoneBand[] = [
  { minLon: -180, maxLon: -172.5, offset: -12, name: 'UTC-12 (Baker Island)' },
  { minLon: -172.5, maxLon: -157.5, offset: -11, name: 'UTC-11 (American Samoa)' },
  { minLon: -157.5, maxLon: -142.5, offset: -10, name: 'UTC-10 (Hawaii)' },
  { minLon: -142.5, maxLon: -127.5, offset: -9, name: 'UTC-9 (Alaska)' },
  { minLon: -127.5, maxLon: -112.5, offset: -8, name: 'UTC-8 (Pacific Time)' },
  { minLon: -112.5, maxLon: -97.5, offset: -7, name: 'UTC-7 (Mountain Time)' },
  { minLon: -97.5, maxLon: -82.5, offset: -6, name: 'UTC-6 (Central Time)' },
  { minLon: -82.5, maxLon: -67.5, offset: -5, name: 'UTC-5 (Eastern Time)' },
  { minLon: -67.5, maxLon: -52.5, offset: -4, name: 'UTC-4 (Atlantic Time)' },
  { minLon: -52.5, maxLon: -37.5, offset: -3, name: 'UTC-3 (Brazil/Argentina)' },
  { minLon: -37.5, maxLon: -22.5, offset: -2, name: 'UTC-2 (Mid-Atlantic)' },
  { minLon: -22.5, maxLon: -7.5, offset: -1, name: 'UTC-1 (Cape Verde)' },
  { minLon: -7.5, maxLon: 7.5, offset: 0, name: 'UTC+0 (GMT/UTC)' },
  { minLon: 7.5, maxLon: 22.5, offset: 1, name: 'UTC+1 (Central European)' },
  { minLon: 22.5, maxLon: 37.5, offset: 2, name: 'UTC+2 (Eastern European)' },
  { minLon: 37.5, maxLon: 52.5, offset: 3, name: 'UTC+3 (Moscow/Nairobi)' },
  { minLon: 52.5, maxLon: 67.5, offset: 4, name: 'UTC+4 (Dubai/Baku)' },
  { minLon: 67.5, maxLon: 82.5, offset: 5, name: 'UTC+5 (Pakistan/India)' },
  { minLon: 82.5, maxLon: 97.5, offset: 6, name: 'UTC+6 (Bangladesh)' },
  { minLon: 97.5, maxLon: 112.5, offset: 7, name: 'UTC+7 (Thailand/Vietnam)' },
  { minLon: 112.5, maxLon: 127.5, offset: 8, name: 'UTC+8 (China/Singapore)' },
  { minLon: 127.5, maxLon: 142.5, offset: 9, name: 'UTC+9 (Japan/Korea)' },
  { minLon: 142.5, maxLon: 157.5, offset: 10, name: 'UTC+10 (Australia East)' },
  { minLon: 157.5, maxLon: 172.5, offset: 11, name: 'UTC+11 (Solomon Islands)' },
  { minLon: 172.5, maxLon: 180, offset: 12, name: 'UTC+12 (New Zealand)' },
];

/* -------------------------------------------------------------------------- */
/* Pure logic                                                                   */
/* -------------------------------------------------------------------------- */

export function estimateTimezone(lat: number, lon: number): TimezoneResult {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return { ok: false, message: 'Enter valid latitude and longitude.', lat: null, lon: null, utcOffsetHours: null, utcOffsetLabel: null, estimatedTimezone: null, localTime: null };
  }
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return { ok: false, message: 'Coordinates out of range.', lat: null, lon: null, utcOffsetHours: null, utcOffsetLabel: null, estimatedTimezone: null, localTime: null };
  }

  const band = TIMEZONE_BANDS.find((b) => lon >= b.minLon && lon < b.maxLon) ??
    (lon >= 172.5 ? TIMEZONE_BANDS[TIMEZONE_BANDS.length - 1] : TIMEZONE_BANDS[0]);

  if (!band) {
    return { ok: false, message: 'Could not determine timezone band.', lat: null, lon: null, utcOffsetHours: null, utcOffsetLabel: null, estimatedTimezone: null, localTime: null };
  }

  const offset = band.offset;
  const offsetLabel = `UTC${offset >= 0 ? '+' : ''}${offset}`;
  const localTime = computeLocalTime(offset);

  return {
    ok: true,
    lat,
    lon,
    utcOffsetHours: offset,
    utcOffsetLabel: offsetLabel,
    estimatedTimezone: band.name,
    localTime,
  };
}

function computeLocalTime(offsetHours: number): string {
  const now = new Date();
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
  const localMs = utcMs + offsetHours * 3600000;
  const local = new Date(localMs);
  return local.toLocaleString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

/* -------------------------------------------------------------------------- */
/* Composable                                                                   */
/* -------------------------------------------------------------------------- */

export interface UseTimezoneFromCoordinatesReturn {
  latInput: Ref<string>;
  lonInput: Ref<string>;
  snapshot: Ref<TimezoneResult | null>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  reset: () => void;
}

export function useTimezoneFromCoordinates(): UseTimezoneFromCoordinatesReturn {
  const latInput = ref<string>('');
  const lonInput = ref<string>('');
  const snapshot = ref<TimezoneResult | null>(null);

  function recompute(): void {
    const lat = parseFloat(latInput.value);
    const lon = parseFloat(lonInput.value);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      snapshot.value = null;
      return;
    }
    snapshot.value = estimateTimezone(lat, lon);
  }

  function reset(): void {
    latInput.value = '';
    lonInput.value = '';
    snapshot.value = null;
  }

  watch([latInput, lonInput], () => recompute());
  recompute();

  const { isEmbed, input: embedInput } = useToolEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.lat === 'string' || typeof p.lat === 'number') latInput.value = String(p.lat);
      if (typeof p.lon === 'string' || typeof p.lon === 'number') lonInput.value = String(p.lon);
    },
    output: snapshot,
    toOutput: () => ({ ...(snapshot.value ?? {}) }),
  });

  return { latInput, lonInput, snapshot, isEmbed, embedInput, reset };
}
