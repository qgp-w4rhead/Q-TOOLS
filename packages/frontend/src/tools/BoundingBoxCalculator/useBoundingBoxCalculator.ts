/**
 * useBoundingBoxCalculator - composable + pure logic for bounding box calculation.
 *
 * Given a center point (lat, lon) and a radius, computes the bounding box
 * (min/max lat/lon) for spatial queries. Uses the spherical Earth model.
 *
 * No external dependencies - pure arithmetic only.
 */
import { ref, watch, type Ref } from 'vue';
import { useToolEmbed } from '@/composables/useToolEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Types                                                                       */
/* -------------------------------------------------------------------------- */

export type BBoxUnit = 'km' | 'mi' | 'm' | 'nmi';

export interface BoundingBoxResult {
  ok: boolean;
  message?: string;
  centerLat: number | null;
  centerLon: number | null;
  radius: number | null;
  unit: BBoxUnit | null;
  minLat: number | null;
  maxLat: number | null;
  minLon: number | null;
  maxLon: number | null;
  width: number | null;
  height: number | null;
}

/* -------------------------------------------------------------------------- */
/* Constants                                                                    */
/* -------------------------------------------------------------------------- */

const EARTH_RADIUS_M = 6371008.8;

const UNIT_TO_METERS: Record<BBoxUnit, number> = {
  m: 1,
  km: 1000,
  mi: 1609.344,
  nmi: 1852,
};

export const UNIT_LABELS: Record<BBoxUnit, string> = {
  m: 'meters',
  km: 'kilometers',
  mi: 'miles',
  nmi: 'nautical miles',
};

/* -------------------------------------------------------------------------- */
/* Pure logic                                                                   */
/* -------------------------------------------------------------------------- */

export function calculateBoundingBox(
  lat: number,
  lon: number,
  radius: number,
  unit: BBoxUnit,
): BoundingBoxResult {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return { ok: false, message: 'Enter valid latitude and longitude.', centerLat: null, centerLon: null, radius: null, unit: null, minLat: null, maxLat: null, minLon: null, maxLon: null, width: null, height: null };
  }
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return { ok: false, message: 'Coordinates out of range.', centerLat: null, centerLon: null, radius: null, unit: null, minLat: null, maxLat: null, minLon: null, maxLon: null, width: null, height: null };
  }
  if (!Number.isFinite(radius) || radius <= 0) {
    return { ok: false, message: 'Enter a valid radius (> 0).', centerLat: null, centerLon: null, radius: null, unit: null, minLat: null, maxLat: null, minLon: null, maxLon: null, width: null, height: null };
  }

  const radiusM = radius * UNIT_TO_METERS[unit];

  // Angular distance in radians
  const angularDist = radiusM / EARTH_RADIUS_M;

  const latRad = (lat * Math.PI) / 180;
  const lonRad = (lon * Math.PI) / 180;

  const minLatRad = latRad - angularDist;
  const maxLatRad = latRad + angularDist;

  // Clamp latitude
  const clampedMinLat = Math.max(minLatRad, -Math.PI / 2);
  const clampedMaxLat = Math.min(maxLatRad, Math.PI / 2);

  // Longitude adjustment depends on latitude
  const cosLat = Math.cos(latRad);
  let deltaLon: number;
  if (cosLat < 1e-10) {
    // At poles, the bounding box covers all longitudes
    deltaLon = Math.PI;
  } else {
    deltaLon = Math.asin(Math.sin(angularDist) / cosLat);
  }

  const minLonRad = lonRad - deltaLon;
  const maxLonRad = lonRad + deltaLon;

  const minLat = (clampedMinLat * 180) / Math.PI;
  const maxLat = (clampedMaxLat * 180) / Math.PI;
  let minLon = (minLonRad * 180) / Math.PI;
  let maxLon = (maxLonRad * 180) / Math.PI;

  // Normalize longitude to [-180, 180]
  minLon = ((minLon + 540) % 360) - 180;
  maxLon = ((maxLon + 540) % 360) - 180;

  const width = Math.abs(maxLon - minLon);
  const height = Math.abs(maxLat - minLat);

  return {
    ok: true,
    centerLat: lat,
    centerLon: lon,
    radius,
    unit,
    minLat: round6(minLat),
    maxLat: round6(maxLat),
    minLon: round6(minLon),
    maxLon: round6(maxLon),
    width: round6(width),
    height: round6(height),
  };
}

function round6(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                      */
/* -------------------------------------------------------------------------- */

export function formatBBox(r: BoundingBoxResult): string {
  if (!r.ok) return '';
  return `${r.minLat},${r.minLon} → ${r.maxLat},${r.maxLon}`;
}

export function formatGeoJSONBBox(r: BoundingBoxResult): string {
  if (!r.ok) return '';
  return `[${r.minLon}, ${r.minLat}, ${r.maxLon}, ${r.maxLat}]`;
}

/* -------------------------------------------------------------------------- */
/* Composable                                                                   */
/* -------------------------------------------------------------------------- */

export interface UseBoundingBoxCalculatorReturn {
  latInput: Ref<string>;
  lonInput: Ref<string>;
  radiusInput: Ref<string>;
  unit: Ref<BBoxUnit>;
  snapshot: Ref<BoundingBoxResult | null>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  reset: () => void;
}

export function useBoundingBoxCalculator(): UseBoundingBoxCalculatorReturn {
  const latInput = ref<string>('');
  const lonInput = ref<string>('');
  const radiusInput = ref<string>('');
  const unit = ref<BBoxUnit>('km');
  const snapshot = ref<BoundingBoxResult | null>(null);

  function recompute(): void {
    const lat = parseFloat(latInput.value);
    const lon = parseFloat(lonInput.value);
    const radius = parseFloat(radiusInput.value);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(radius)) {
      snapshot.value = null;
      return;
    }
    snapshot.value = calculateBoundingBox(lat, lon, radius, unit.value);
  }

  function reset(): void {
    latInput.value = '';
    lonInput.value = '';
    radiusInput.value = '';
    unit.value = 'km';
    snapshot.value = null;
  }

  watch([latInput, lonInput, radiusInput, unit], () => recompute());
  recompute();

  const { isEmbed, input: embedInput } = useToolEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.lat === 'string' || typeof p.lat === 'number') latInput.value = String(p.lat);
      if (typeof p.lon === 'string' || typeof p.lon === 'number') lonInput.value = String(p.lon);
      if (typeof p.radius === 'string' || typeof p.radius === 'number') radiusInput.value = String(p.radius);
      if (typeof p.unit === 'string' && p.unit in UNIT_TO_METERS) {
        unit.value = p.unit as BBoxUnit;
      }
    },
    output: snapshot,
    toOutput: () => ({ ...(snapshot.value ?? {}) }),
  });

  return { latInput, lonInput, radiusInput, unit, snapshot, isEmbed, embedInput, reset };
}
