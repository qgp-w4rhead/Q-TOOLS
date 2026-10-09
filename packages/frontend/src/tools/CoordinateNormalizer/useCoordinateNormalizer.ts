/**
 * useCoordinateNormalizer - composable + pure logic for coordinate normalization.
 *
 * Parses various coordinate input formats and normalizes them to standard
 * decimal degrees. Supports:
 *   - Decimal: "48.8584, 2.2945" or "48.8584 2.2945"
 *   - DMS: "48°51'30.24"N 2°17'40.20"E" or "48 51 30.24 N 2 17 40.20 E"
 *   - DMS with symbols: "48°51'30.24"N, 2°17'40.20"E"
 *   - Hemisphere-prefixed: "N 48.8584 E 2.2945"
 *   - Plus/minus: "+48.8584, +2.2945"
 *
 * No external dependencies - pure arithmetic only.
 */
import { ref, watch, type Ref } from 'vue';
import { useToolEmbed } from '@/composables/useToolEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Types                                                                       */
/* -------------------------------------------------------------------------- */

export interface NormalizedCoordinate {
  lat: number;
  lon: number;
}

export interface NormalizeResult {
  ok: boolean;
  message?: string;
  input: string | null;
  normalized: NormalizedCoordinate | null;
  formatted: string | null;
  dmsFormatted: string | null;
  detectedFormat: string | null;
}

/* -------------------------------------------------------------------------- */
/* Pure logic                                                                   */
/* -------------------------------------------------------------------------- */

export function normalizeCoordinates(input: string): NormalizeResult {
  const trimmed = input.trim();
  if (!trimmed) {
    return { ok: false, message: 'Enter coordinates to normalize.', input: null, normalized: null, formatted: null, dmsFormatted: null, detectedFormat: null };
  }

  // Try DMS format first (has degree/minute/second symbols or hemisphere letters)
  const dmsResult = tryParseDMS(trimmed);
  if (dmsResult) {
    return {
      ok: true,
      input: trimmed,
      normalized: dmsResult,
      formatted: formatDecimal(dmsResult.lat, dmsResult.lon),
      dmsFormatted: formatDMS(dmsResult.lat, dmsResult.lon),
      detectedFormat: 'DMS (degrees/minutes/seconds)',
    };
  }

  // Try hemisphere-prefixed decimal: "N 48.8584 E 2.2945"
  const hemiResult = tryParseHemispherePrefixed(trimmed);
  if (hemiResult) {
    return {
      ok: true,
      input: trimmed,
      normalized: hemiResult,
      formatted: formatDecimal(hemiResult.lat, hemiResult.lon),
      dmsFormatted: formatDMS(hemiResult.lat, hemiResult.lon),
      detectedFormat: 'Hemisphere-prefixed decimal',
    };
  }

  // Try plain decimal: "48.8584, 2.2945" or "48.8584 2.2945"
  const decResult = tryParseDecimal(trimmed);
  if (decResult) {
    return {
      ok: true,
      input: trimmed,
      normalized: decResult,
      formatted: formatDecimal(decResult.lat, decResult.lon),
      dmsFormatted: formatDMS(decResult.lat, decResult.lon),
      detectedFormat: 'Decimal degrees',
    };
  }

  return {
    ok: false,
    message: 'Unrecognized coordinate format. Try: "48.8584, 2.2945" or "48°51\'30"N 2°17\'40"E"',
    input: trimmed,
    normalized: null,
    formatted: null,
    dmsFormatted: null,
    detectedFormat: null,
  };
}

function tryParseDMS(input: string): NormalizedCoordinate | null {
  const cleaned = input.trim().toUpperCase();

  // Match patterns like: 48°51'30.24"N 2°17'40.20"E
  // Also: 48 51 30.24 N 2 17 40.20 E
  // Also: 48°51'30.24"N, 2°17'40.20"E

  const dmsPattern =
    /(\d+(?:\.\d+)?)\s*[°º]?\s*(?:(\d+(?:\.\d+)?)\s*['′]?\s*)?(?:(\d+(?:\.\d+)?)\s*["″]?\s*)?([NSEW])?\s*[, ]+\s*(\d+(?:\.\d+)?)\s*[°º]?\s*(?:(\d+(?:\.\d+)?)\s*['′]?\s*)?(?:(\d+(?:\.\d+)?)\s*["″]?\s*)?([NSEW])?/i;

  const match = cleaned.match(dmsPattern);
  if (!match) return null;

  // Only treat as DMS if there are degree symbols or hemisphere letters
  const hasDegree = match[0].includes('°') || match[0].includes('º');
  const hasHemi = match[4] || match[8];
  const hasMin = match[2] || match[6];
  if (!hasDegree && !hasHemi && !hasMin) return null;

  const latDeg = parseFloat(match[1]!);
  const latMin = match[2] ? parseFloat(match[2]) : 0;
  const latSec = match[3] ? parseFloat(match[3]) : 0;
  const latHemi = match[4] ?? '';

  const lonDeg = parseFloat(match[5]!);
  const lonMin = match[6] ? parseFloat(match[6]) : 0;
  const lonSec = match[7] ? parseFloat(match[7]) : 0;
  const lonHemi = match[8] ?? '';

  let lat = latDeg + latMin / 60 + latSec / 3600;
  let lon = lonDeg + lonMin / 60 + lonSec / 3600;

  // Apply hemisphere signs
  if (latHemi === 'S') lat = -lat;
  if (lonHemi === 'W') lon = -lon;

  // If no hemisphere letters, check for negative signs
  if (!latHemi && match[1]!.startsWith('-')) lat = -Math.abs(lat);
  if (!lonHemi && match[5]!.startsWith('-')) lon = -Math.abs(lon);

  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;

  return { lat, lon };
}

function tryParseHemispherePrefixed(input: string): NormalizedCoordinate | null {
  const cleaned = input.trim().toUpperCase();
  // Pattern: N 48.8584 E 2.2945 or S 48.8584 W 2.2945
  const pattern = /^([NS])\s*(-?\d+(?:\.\d+)?)\s+([EW])\s*(-?\d+(?:\.\d+)?)$/i;
  const match = cleaned.match(pattern);
  if (!match) return null;

  let lat = parseFloat(match[2]!);
  let lon = parseFloat(match[4]!);

  if (match[1]!.toUpperCase() === 'S') lat = -Math.abs(lat);
  if (match[3]!.toUpperCase() === 'W') lon = -Math.abs(lon);

  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;

  return { lat, lon };
}

function tryParseDecimal(input: string): NormalizedCoordinate | null {
  const parts = input.trim().split(/[\s,]+/).filter(Boolean);
  if (parts.length < 2) return null;

  const lat = parseFloat(parts[0]!);
  const lon = parseFloat(parts[1]!);

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;

  return { lat, lon };
}

/* -------------------------------------------------------------------------- */
/* Formatting helpers                                                           */
/* -------------------------------------------------------------------------- */

export function formatDecimal(lat: number, lon: number): string {
  return `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
}

export function formatDMS(lat: number, lon: number): string {
  const fmt = (val: number, pos: string, neg: string): string => {
    const hemi = val >= 0 ? pos : neg;
    const abs = Math.abs(val);
    const d = Math.floor(abs);
    const mFloat = (abs - d) * 60;
    const m = Math.floor(mFloat);
    const s = (mFloat - m) * 60;
    return `${d}°${m}'${s.toFixed(2)}"${hemi}`;
  };
  return `${fmt(lat, 'N', 'S')} ${fmt(lon, 'E', 'W')}`;
}

/* -------------------------------------------------------------------------- */
/* Composable                                                                   */
/* -------------------------------------------------------------------------- */

export interface UseCoordinateNormalizerReturn {
  input: Ref<string>;
  snapshot: Ref<NormalizeResult | null>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  reset: () => void;
}

export function useCoordinateNormalizer(): UseCoordinateNormalizerReturn {
  const input = ref<string>('');
  const snapshot = ref<NormalizeResult | null>(null);

  function recompute(): void {
    if (!input.value.trim()) {
      snapshot.value = null;
      return;
    }
    snapshot.value = normalizeCoordinates(input.value);
  }

  function reset(): void {
    input.value = '';
    snapshot.value = null;
  }

  watch(input, () => recompute());
  recompute();

  const { isEmbed, input: embedInput } = useToolEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.input === 'string') input.value = p.input;
    },
    output: snapshot,
    toOutput: () => ({ ...(snapshot.value ?? {}) }),
  });

  return { input, snapshot, isEmbed, embedInput, reset };
}
