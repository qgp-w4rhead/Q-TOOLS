/**
 * useDistanceCalculator - composable + pure logic for great-circle distance.
 *
 * Supports Haversine and Vincenty formulas for computing the distance
 * between two coordinate pairs on the WGS84 ellipsoid.
 *
 * No external dependencies - pure arithmetic only.
 */
import { ref, watch, type Ref } from 'vue';
import { useToolEmbed } from '@/composables/useToolEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Types                                                                       */
/* -------------------------------------------------------------------------- */

export type DistanceFormula = 'haversine' | 'vincenty';
export type DistanceUnit = 'km' | 'mi' | 'm' | 'ft' | 'nmi';

export interface DistanceResult {
  ok: boolean;
  message?: string;
  distanceM: number | null;
  distance: number | null;
  unit: DistanceUnit | null;
  formula: DistanceFormula | null;
  bearing: number | null;
}

/* -------------------------------------------------------------------------- */
/* Constants - WGS84 ellipsoid                                                 */
/* -------------------------------------------------------------------------- */

const WGS84_A = 6378137.0;
const WGS84_F = 1 / 298.257223563;
const WGS84_B = WGS84_A * (1 - WGS84_F);

const UNIT_FACTORS: Record<DistanceUnit, number> = {
  m: 1,
  km: 1000,
  mi: 1609.344,
  ft: 0.3048,
  nmi: 1852,
};

const UNIT_LABELS: Record<DistanceUnit, string> = {
  m: 'meters',
  km: 'kilometers',
  mi: 'miles',
  ft: 'feet',
  nmi: 'nautical miles',
};

/* -------------------------------------------------------------------------- */
/* Pure logic - Haversine                                                       */
/* -------------------------------------------------------------------------- */

export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371008.8; // Mean Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const dPhi = ((lat2 - lat1) * Math.PI) / 180;
  const dLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dPhi / 2) ** 2 +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/* -------------------------------------------------------------------------- */
/* Pure logic - Vincenty                                                        */
/* -------------------------------------------------------------------------- */

export function vincentyDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const a = WGS84_A;
  const f = WGS84_F;
  const b = WGS84_B;

  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const L = ((lon2 - lon1) * Math.PI) / 180;

  const U1 = Math.atan((1 - f) * Math.tan(phi1));
  const U2 = Math.atan((1 - f) * Math.tan(phi2));
  const sinU1 = Math.sin(U1);
  const cosU1 = Math.cos(U1);
  const sinU2 = Math.sin(U2);
  const cosU2 = Math.cos(U2);

  let lambda = L;
  let lambdaP: number;
  let iter = 0;
  let sinSigma: number;
  let cosSigma: number;
  let sigma: number;
  let cosSqAlpha: number;
  let cos2SigmaM: number;
  let sinLambda: number;
  let cosLambda: number;

  do {
    sinLambda = Math.sin(lambda);
    cosLambda = Math.cos(lambda);
    sinSigma = Math.sqrt(
      (cosU2 * sinLambda) ** 2 + (cosU1 * sinU2 - sinU1 * cosU2 * cosLambda) ** 2,
    );
    if (sinSigma === 0) return 0; // Co-incident points
    cosSigma = sinU1 * sinU2 + cosU1 * cosU2 * cosLambda;
    sigma = Math.atan2(sinSigma, cosSigma);
    const sinAlpha = (cosU1 * cosU2 * sinLambda) / sinSigma;
    cosSqAlpha = 1 - sinAlpha ** 2;
    cos2SigmaM = cosSigma - (2 * sinU1 * sinU2) / (cosSqAlpha || 1);
    lambdaP = lambda;
    const C = (f / 16) * cosSqAlpha * (4 + f * (4 - 3 * cosSqAlpha));
    lambda =
      L +
      (1 - C) *
        f *
        sinAlpha *
        (sigma + C * sinSigma * (cos2SigmaM + C * cosSigma * (-1 + 2 * cos2SigmaM ** 2)));
    iter++;
  } while (Math.abs(lambda - lambdaP) > 1e-12 && iter < 200);

  if (iter >= 200) {
    // Fall back to haversine if Vincenty doesn't converge
    return haversineDistance(lat1, lon1, lat2, lon2);
  }

  const uSq = (cosSqAlpha * (a ** 2 - b ** 2)) / (b ** 2);
  const A = 1 + (uSq / 16384) * (4096 + uSq * (-768 + uSq * (320 - 175 * uSq)));
  const B = (uSq / 1024) * (256 + uSq * (-128 + uSq * (74 - 47 * uSq)));
  const deltaSigma =
    B *
    sinSigma *
    (cos2SigmaM + (B / 4) * (cosSigma * (-1 + 2 * cos2SigmaM ** 2) -
      (B / 6) * cos2SigmaM * (-3 + 4 * sinSigma ** 2) * (-3 + 4 * cos2SigmaM ** 2)));

  return b * A * (sigma - deltaSigma);
}

/* -------------------------------------------------------------------------- */
/* Pure logic - Bearing                                                         */
/* -------------------------------------------------------------------------- */

export function calculateBearing(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const dLambda = ((lon2 - lon1) * Math.PI) / 180;

  const y = Math.sin(dLambda) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLambda);

  const theta = Math.atan2(y, x);
  return ((theta * 180) / Math.PI + 360) % 360;
}

/* -------------------------------------------------------------------------- */
/* Main computation                                                             */
/* -------------------------------------------------------------------------- */

export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
  formula: DistanceFormula,
  unit: DistanceUnit,
): DistanceResult {
  if (!Number.isFinite(lat1) || !Number.isFinite(lon1) || !Number.isFinite(lat2) || !Number.isFinite(lon2)) {
    return { ok: false, message: 'Enter valid coordinates for both points.', distanceM: null, distance: null, unit: null, formula: null, bearing: null };
  }
  if (Math.abs(lat1) > 90 || Math.abs(lat2) > 90 || Math.abs(lon1) > 180 || Math.abs(lon2) > 180) {
    return { ok: false, message: 'Coordinates out of range.', distanceM: null, distance: null, unit: null, formula: null, bearing: null };
  }

  const distM = formula === 'haversine'
    ? haversineDistance(lat1, lon1, lat2, lon2)
    : vincentyDistance(lat1, lon1, lat2, lon2);

  const dist = distM / UNIT_FACTORS[unit];
  const bearing = calculateBearing(lat1, lon1, lat2, lon2);

  return {
    ok: true,
    distanceM: distM,
    distance: dist,
    unit,
    formula,
    bearing,
  };
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                      */
/* -------------------------------------------------------------------------- */

export function formatDistance(n: number, unit: DistanceUnit): string {
  if (!Number.isFinite(n)) return '-';
  const decimals = unit === 'm' || unit === 'ft' ? 1 : 4;
  return `${n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })} ${UNIT_LABELS[unit]}`;
}

export function formatBearing(deg: number): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const idx = Math.round(deg / 45) % 8;
  return `${deg.toFixed(1)}° (${dirs[idx]})`;
}

/* -------------------------------------------------------------------------- */
/* Composable                                                                   */
/* -------------------------------------------------------------------------- */

export interface UseDistanceCalculatorReturn {
  lat1: Ref<string>;
  lon1: Ref<string>;
  lat2: Ref<string>;
  lon2: Ref<string>;
  formula: Ref<DistanceFormula>;
  unit: Ref<DistanceUnit>;
  snapshot: Ref<DistanceResult | null>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  reset: () => void;
}

export function useDistanceCalculator(): UseDistanceCalculatorReturn {
  const lat1 = ref<string>('');
  const lon1 = ref<string>('');
  const lat2 = ref<string>('');
  const lon2 = ref<string>('');
  const formula = ref<DistanceFormula>('haversine');
  const unit = ref<DistanceUnit>('km');
  const snapshot = ref<DistanceResult | null>(null);

  function recompute(): void {
    const la1 = parseFloat(lat1.value);
    const lo1 = parseFloat(lon1.value);
    const la2 = parseFloat(lat2.value);
    const lo2 = parseFloat(lon2.value);
    if (!Number.isFinite(la1) || !Number.isFinite(lo1) || !Number.isFinite(la2) || !Number.isFinite(lo2)) {
      snapshot.value = null;
      return;
    }
    snapshot.value = calculateDistance(la1, lo1, la2, lo2, formula.value, unit.value);
  }

  function reset(): void {
    lat1.value = '';
    lon1.value = '';
    lat2.value = '';
    lon2.value = '';
    formula.value = 'haversine';
    unit.value = 'km';
    snapshot.value = null;
  }

  watch([lat1, lon1, lat2, lon2, formula, unit], () => recompute());
  recompute();

  const { isEmbed, input: embedInput } = useToolEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.lat1 === 'string' || typeof p.lat1 === 'number') lat1.value = String(p.lat1);
      if (typeof p.lon1 === 'string' || typeof p.lon1 === 'number') lon1.value = String(p.lon1);
      if (typeof p.lat2 === 'string' || typeof p.lat2 === 'number') lat2.value = String(p.lat2);
      if (typeof p.lon2 === 'string' || typeof p.lon2 === 'number') lon2.value = String(p.lon2);
      if (typeof p.formula === 'string') {
        formula.value = p.formula === 'vincenty' ? 'vincenty' : 'haversine';
      }
      if (typeof p.unit === 'string' && p.unit in UNIT_FACTORS) {
        unit.value = p.unit as DistanceUnit;
      }
    },
    output: snapshot,
    toOutput: () => ({ ...(snapshot.value ?? {}) }),
  });

  return { lat1, lon1, lat2, lon2, formula, unit, snapshot, isEmbed, embedInput, reset };
}
