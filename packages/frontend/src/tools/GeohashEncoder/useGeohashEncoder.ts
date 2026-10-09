/**
 * useGeohashEncoder - composable + pure logic for geohash encoding/decoding.
 *
 * Geohash is a base32 encoding of lat/lon that interleaves bits to create
 * a hierarchical spatial index. Longer geohashes = higher precision.
 *
 * No external dependencies - pure arithmetic only.
 */
import { ref, watch, type Ref } from 'vue';
import { useToolEmbed } from '@/composables/useToolEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Types                                                                       */
/* -------------------------------------------------------------------------- */

export interface GeohashResult {
  ok: boolean;
  message?: string;
  geohash: string | null;
  lat: number | null;
  lon: number | null;
  precision: number | null;
  bbox: { minLat: number; maxLat: number; minLon: number; maxLon: number } | null;
}

/* -------------------------------------------------------------------------- */
/* Constants                                                                   */
/* -------------------------------------------------------------------------- */

const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';

/* -------------------------------------------------------------------------- */
/* Pure logic - Encode                                                          */
/* -------------------------------------------------------------------------- */

export function encodeGeohash(lat: number, lon: number, precision = 12): string {
  const validPrecision = Math.max(1, Math.min(12, precision));
  let geohash = '';
  let latRange: [number, number] = [-90, 90];
  let lonRange: [number, number] = [-180, 180];
  let bit = 0;
  let ch = 0;
  let even = true;

  while (geohash.length < validPrecision) {
    if (even) {
      const mid = (lonRange[0] + lonRange[1]) / 2;
      if (lon >= mid) {
        ch = (ch << 1) | 1;
        lonRange[0] = mid;
      } else {
        ch = (ch << 1) | 0;
        lonRange[1] = mid;
      }
    } else {
      const mid = (latRange[0] + latRange[1]) / 2;
      if (lat >= mid) {
        ch = (ch << 1) | 1;
        latRange[0] = mid;
      } else {
        ch = (ch << 1) | 0;
        latRange[1] = mid;
      }
    }
    even = !even;
    bit++;
    if (bit === 5) {
      geohash += BASE32[ch];
      bit = 0;
      ch = 0;
    }
  }

  return geohash;
}

/* -------------------------------------------------------------------------- */
/* Pure logic - Decode                                                          */
/* -------------------------------------------------------------------------- */

export function decodeGeohash(geohash: string): {
  lat: number;
  lon: number;
  bbox: { minLat: number; maxLat: number; minLon: number; maxLon: number };
} {
  let latRange: [number, number] = [-90, 90];
  let lonRange: [number, number] = [-180, 180];
  let even = true;

  for (const c of geohash) {
    const idx = BASE32.indexOf(c);
    if (idx === -1) throw new Error(`Invalid geohash character: ${c}`);

    for (let bit = 4; bit >= 0; bit--) {
      const b = (idx >> bit) & 1;
      if (even) {
        const mid = (lonRange[0] + lonRange[1]) / 2;
        if (b) lonRange[0] = mid;
        else lonRange[1] = mid;
      } else {
        const mid = (latRange[0] + latRange[1]) / 2;
        if (b) latRange[0] = mid;
        else latRange[1] = mid;
      }
      even = !even;
    }
  }

  const lat = (latRange[0] + latRange[1]) / 2;
  const lon = (lonRange[0] + lonRange[1]) / 2;

  return {
    lat,
    lon,
    bbox: {
      minLat: latRange[0],
      maxLat: latRange[1],
      minLon: lonRange[0],
      maxLon: lonRange[1],
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Validation                                                                   */
/* -------------------------------------------------------------------------- */

export function isValidGeohash(geohash: string): boolean {
  if (!geohash) return false;
  for (const c of geohash) {
    if (BASE32.indexOf(c) === -1) return false;
  }
  return true;
}

/* -------------------------------------------------------------------------- */
/* Main computation                                                             */
/* -------------------------------------------------------------------------- */

export function computeGeohash(
  mode: 'encode' | 'decode',
  latInput: string,
  lonInput: string,
  geohashInput: string,
  precision: number,
): GeohashResult {
  if (mode === 'encode') {
    const lat = parseFloat(latInput);
    const lon = parseFloat(lonInput);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return { ok: false, message: 'Enter valid latitude and longitude.', geohash: null, lat: null, lon: null, precision: null, bbox: null };
    }
    if (Math.abs(lat) > 90 || Math.abs(lon) > 180) {
      return { ok: false, message: 'Coordinates out of range (lat: -90 to 90, lon: -180 to 180).', geohash: null, lat: null, lon: null, precision: null, bbox: null };
    }
    const gh = encodeGeohash(lat, lon, precision);
    const decoded = decodeGeohash(gh);
    return {
      ok: true,
      geohash: gh,
      lat,
      lon,
      precision,
      bbox: decoded.bbox,
    };
  } else {
    const gh = geohashInput.trim().toLowerCase();
    if (!gh) {
      return { ok: false, message: 'Enter a geohash to decode.', geohash: null, lat: null, lon: null, precision: null, bbox: null };
    }
    if (!isValidGeohash(gh)) {
      return { ok: false, message: 'Invalid geohash. Use only characters: 0-9, b-z (excluding a, i, l, o).', geohash: null, lat: null, lon: null, precision: null, bbox: null };
    }
    try {
      const decoded = decodeGeohash(gh);
      return {
        ok: true,
        geohash: gh,
        lat: decoded.lat,
        lon: decoded.lon,
        precision: gh.length,
        bbox: decoded.bbox,
      };
    } catch {
      return { ok: false, message: 'Failed to decode geohash.', geohash: null, lat: null, lon: null, precision: null, bbox: null };
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Composable                                                                   */
/* -------------------------------------------------------------------------- */

export interface UseGeohashEncoderReturn {
  mode: Ref<'encode' | 'decode'>;
  latInput: Ref<string>;
  lonInput: Ref<string>;
  geohashInput: Ref<string>;
  precision: Ref<number>;
  snapshot: Ref<GeohashResult | null>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  reset: () => void;
}

export function useGeohashEncoder(): UseGeohashEncoderReturn {
  const mode = ref<'encode' | 'decode'>('encode');
  const latInput = ref<string>('');
  const lonInput = ref<string>('');
  const geohashInput = ref<string>('');
  const precision = ref<number>(12);
  const snapshot = ref<GeohashResult | null>(null);

  function recompute(): void {
    const result = computeGeohash(
      mode.value,
      latInput.value,
      lonInput.value,
      geohashInput.value,
      precision.value,
    );
    snapshot.value = result.ok ? result : result;
  }

  function reset(): void {
    mode.value = 'encode';
    latInput.value = '';
    lonInput.value = '';
    geohashInput.value = '';
    precision.value = 12;
    snapshot.value = null;
  }

  watch([mode, latInput, lonInput, geohashInput, precision], () => recompute());
  recompute();

  const { isEmbed, input: embedInput } = useToolEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.mode === 'string') {
        mode.value = p.mode === 'decode' ? 'decode' : 'encode';
      }
      if (typeof p.lat === 'string' || typeof p.lat === 'number') {
        latInput.value = String(p.lat);
      }
      if (typeof p.lon === 'string' || typeof p.lon === 'number') {
        lonInput.value = String(p.lon);
      }
      if (typeof p.geohash === 'string') {
        geohashInput.value = p.geohash;
      }
      if (typeof p.precision === 'number') {
        precision.value = p.precision;
      }
    },
    output: snapshot,
    toOutput: () => ({ ...(snapshot.value ?? {}) }),
  });

  return { mode, latInput, lonInput, geohashInput, precision, snapshot, isEmbed, embedInput, reset };
}
