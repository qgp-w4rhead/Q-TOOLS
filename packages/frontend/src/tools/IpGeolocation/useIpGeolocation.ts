/**
 * useIpGeolocation - composable + pure logic for the IP geolocation lookup
 * tool.
 *
 * Queries the free `ipapi.co` JSON endpoint for an IP's approximate
 * geolocation: country, region, city, postal code, coordinates, timezone,
 * ASN, and organisation. An empty query looks up the caller's own IP.
 *
 * Pure helpers (`buildGeoUrl`, `parseGeoResponse`) have no Vue dependency
 * and can be imported standalone for unit testing or reuse. The
 * `useIpGeolocation()` composable manages reactive state, fetch calls, and
 * embed integration.
 *
 * No external dependencies - uses the browser `fetch` API. Requires network
 * access; the free tier is rate-limited (~1k req/day) and failures are
 * surfaced as errors.
 */
import { ref, watch, type Ref } from 'vue';
import { useEmbed } from '@/composables/useEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Pure logic - no Vue dependency below this point                             */
/* -------------------------------------------------------------------------- */

export interface GeoResult {
  /** The IP that was looked up (echoed by the API). */
  ip: string;
  city: string | null;
  region: string | null;
  countryName: string | null;
  countryCode: string | null;
  continentCode: string | null;
  postal: string | null;
  latitude: number | null;
  longitude: number | null;
  timezone: string | null;
  utcOffset: string | null;
  asn: string | null;
  org: string | null;
  /** `lat,lon` string for display/copy. */
  coordinates: string | null;
  /** OpenStreetMap link for the coordinates. */
  mapUrl: string | null;
  /** The API URL that was queried. */
  url: string;
}

/** Build the ipapi.co URL for an IP (empty → caller's own IP). */
export function buildGeoUrl(ip: string): string {
  const q = ip.trim();
  return q.length === 0
    ? 'https://ipapi.co/json/'
    : `https://ipapi.co/${encodeURIComponent(q)}/json/`;
}

/**
 * Flatten the ipapi.co JSON response. The API signals failures with
 * `{ error: true, reason: "…" }` - callers should check `error` first.
 */
export function parseGeoResponse(
  json: unknown,
  url: string,
): { ok: boolean; result: GeoResult | null; error: string | null } {
  const data = (json ?? {}) as Record<string, unknown>;
  if (data.error === true) {
    const reason = typeof data.reason === 'string' ? data.reason : 'Unknown error';
    return { ok: false, result: null, error: `ipapi.co: ${reason}` };
  }
  const str = (k: string): string | null =>
    typeof data[k] === 'string' && (data[k] as string).length > 0
      ? (data[k] as string)
      : null;
  const num = (k: string): number | null =>
    typeof data[k] === 'number' && Number.isFinite(data[k] as number)
      ? (data[k] as number)
      : null;

  const lat = num('latitude');
  const lon = num('longitude');
  const coordinates =
    lat !== null && lon !== null ? `${lat}, ${lon}` : null;
  const mapUrl =
    lat !== null && lon !== null
      ? `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=10/${lat}/${lon}`
      : null;

  return {
    ok: true,
    error: null,
    result: {
      ip: str('ip') ?? '',
      city: str('city'),
      region: str('region'),
      countryName: str('country_name'),
      countryCode: str('country_code'),
      continentCode: str('continent_code'),
      postal: str('postal'),
      latitude: lat,
      longitude: lon,
      timezone: str('timezone'),
      utcOffset: str('utc_offset'),
      asn: str('asn'),
      org: str('org'),
      coordinates,
      mapUrl,
      url,
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Composable - reactive state + fetch + embed integration                     */
/* -------------------------------------------------------------------------- */

export interface UseIpGeolocationReturn {
  ipInput: Ref<string>;
  result: Ref<GeoResult | null>;
  loading: Ref<boolean>;
  error: Ref<string | null>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  lookup: () => Promise<void>;
  reset: () => void;
}

export function useIpGeolocation(): UseIpGeolocationReturn {
  const ipInput = ref<string>('');
  const result = ref<GeoResult | null>(null);
  const loading = ref<boolean>(false);
  const error = ref<string | null>(null);

  async function lookup(): Promise<void> {
    loading.value = true;
    error.value = null;
    result.value = null;
    const url = buildGeoUrl(ipInput.value);
    try {
      const res = await fetch(url, { headers: { accept: 'application/json' } });
      if (res.status === 429) {
        error.value = 'Rate limited by ipapi.co (free tier ≈ 1,000 req/day) - try again later.';
        return;
      }
      if (!res.ok) {
        error.value = `Lookup failed: HTTP ${res.status} ${res.statusText}`;
        return;
      }
      const json = await res.json();
      const parsed = parseGeoResponse(json, url);
      if (!parsed.ok) {
        error.value = parsed.error;
        return;
      }
      result.value = parsed.result;
    } catch (err) {
      error.value =
        err instanceof Error
          ? `Network request failed - this tool requires internet access. (${err.message})`
          : 'Network request failed - this tool requires internet access.';
    } finally {
      loading.value = false;
    }
  }

  function reset(): void {
    ipInput.value = '';
    result.value = null;
    error.value = null;
  }

  const { isEmbed, input: embedInput, sendOutput } = useEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      let shouldLookup = p.lookup === true || p.run === true;
      if (typeof p.ip === 'string') { ipInput.value = p.ip; shouldLookup = true; }
      else if (typeof p.address === 'string') { ipInput.value = p.address; shouldLookup = true; }
      else if (typeof p.input === 'string') { ipInput.value = p.input; shouldLookup = true; }
      else if (typeof p.value === 'string') { ipInput.value = p.value; shouldLookup = true; }
      if (shouldLookup) void lookup();
    },
  });

  watch([result, error], () => {
    if (isEmbed.value) {
      if (result.value) {
        sendOutput({ ...result.value });
      } else {
        sendOutput({ error: error.value, loading: loading.value });
      }
    }
  });

  return { ipInput, result, loading, error, isEmbed, embedInput, lookup, reset };
}
