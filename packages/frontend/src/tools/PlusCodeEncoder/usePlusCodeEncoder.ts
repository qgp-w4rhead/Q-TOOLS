/**
 * usePlusCodeEncoder - composable + pure logic for Open Location Code (Plus Code).
 *
 * Open Location Code (OLC), also known as Plus Code, is a geocoding system
 * developed by Google that encodes lat/lon into a short, human-readable code.
 *
 * Format: XXXX+XX or XXXX+XX,XXXX (with optional locality prefix)
 *
 * No external dependencies - pure arithmetic only.
 */
import { ref, watch, type Ref } from 'vue';
import { useToolEmbed } from '@/composables/useToolEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Types                                                                       */
/* -------------------------------------------------------------------------- */

export interface PlusCodeResult {
  ok: boolean;
  message?: string;
  code: string | null;
  lat: number | null;
  lon: number | null;
  codeLength: number | null;
  bbox: { minLat: number; maxLat: number; minLon: number; maxLon: number } | null;
}

/* -------------------------------------------------------------------------- */
/* Constants                                                                   */
/* -------------------------------------------------------------------------- */

const CODE_ALPHABET = '23456789CFGHJMPQRVWX';
const PAIR_CODE_LENGTH = 10;
const GRID_ROWS = 4;
const GRID_COLS = 5;
const PAIR_RESOLUTIONS = [20.0, 1.0, 0.05, 0.0025, 0.000125];
const GRID_RESOLUTION = 0.000125 / (GRID_ROWS * GRID_COLS);
const MIN_LAT = -90;
const MIN_LON = -180;

/* -------------------------------------------------------------------------- */
/* Pure logic - Encode                                                          */
/* -------------------------------------------------------------------------- */

export function encodePlusCode(lat: number, lon: number, codeLength = 10): string {
  const validLength = Math.max(2, Math.min(15, codeLength));
  let adjustedLat = lat;
  let adjustedLon = lon;

  let code = '';

  // Build pairs
  for (let i = 0; i < Math.min(validLength, PAIR_CODE_LENGTH); i += 2) {
    const resIdx = Math.min(i / 2, PAIR_RESOLUTIONS.length - 1);
    const latRes = PAIR_RESOLUTIONS[resIdx]!;
    const lonRes = PAIR_RESOLUTIONS[resIdx]!;

    const latDigit = Math.floor((adjustedLat - MIN_LAT) / latRes);
    const lonDigit = Math.floor((adjustedLon - MIN_LON) / lonRes);

    code += CODE_ALPHABET[latDigit]! + CODE_ALPHABET[lonDigit]!;

    adjustedLat = MIN_LAT + latDigit * latRes;
    adjustedLon = MIN_LON + lonDigit * lonRes;
  }

  // Add separator
  if (validLength >= PAIR_CODE_LENGTH) {
    code = code.slice(0, 4) + '+' + code.slice(4);
  } else {
    code = code.slice(0, 4) + '+';
  }

  // Add grid refinement if needed
  if (validLength > PAIR_CODE_LENGTH) {
    let gridLat = adjustedLat;
    let gridLon = adjustedLon;
    for (let i = PAIR_CODE_LENGTH; i < validLength; i++) {
      const row = Math.floor((gridLat - adjustedLat) / GRID_RESOLUTION);
      const col = Math.floor((gridLon - adjustedLon) / GRID_RESOLUTION);
      const idx = row * GRID_COLS + col;
      code += CODE_ALPHABET[idx];
      gridLat = adjustedLat + row * GRID_RESOLUTION;
      gridLon = adjustedLon + col * GRID_RESOLUTION;
    }
  }

  return code;
}

/* -------------------------------------------------------------------------- */
/* Pure logic - Decode                                                          */
/* -------------------------------------------------------------------------- */

export function decodePlusCode(code: string): {
  lat: number;
  lon: number;
  codeLength: number;
  bbox: { minLat: number; maxLat: number; minLon: number; maxLon: number };
} {
  const cleaned = code.trim().toUpperCase().replace(/\s+/g, '');
  // Remove locality prefix (everything before +)
  const plusIdx = cleaned.indexOf('+');
  if (plusIdx === -1) throw new Error('Missing + separator');

  const olcPart = cleaned.slice(plusIdx - 4 < 0 ? 0 : plusIdx).replace('+', '');

  let lat = MIN_LAT;
  let lon = MIN_LON;
  let codeLength = 0;

  // Decode pairs
  const pairCount = Math.min(Math.floor(olcPart.length / 2) * 2, PAIR_CODE_LENGTH);
  for (let i = 0; i < pairCount; i += 2) {
    const latIdx = CODE_ALPHABET.indexOf(olcPart[i]!);
    const lonIdx = CODE_ALPHABET.indexOf(olcPart[i + 1]!);
    if (latIdx === -1 || lonIdx === -1) throw new Error(`Invalid character in code`);

    const res = PAIR_RESOLUTIONS[Math.min(i / 2, PAIR_RESOLUTIONS.length - 1)]!;
    lat += latIdx * res;
    lon += lonIdx * res;
    codeLength = i + 2;
  }

  // Decode grid refinement
  const gridPart = olcPart.slice(pairCount);
  for (let i = 0; i < gridPart.length; i++) {
    const idx = CODE_ALPHABET.indexOf(gridPart[i]!);
    if (idx === -1) throw new Error('Invalid grid character');
    const row = Math.floor(idx / GRID_COLS);
    const col = idx % GRID_COLS;
    lat += row * GRID_RESOLUTION;
    lon += col * GRID_RESOLUTION;
    codeLength++;
  }

  // Compute bounding box
  let resLat = PAIR_RESOLUTIONS[Math.min(Math.floor(pairCount / 2) - 1, PAIR_RESOLUTIONS.length - 1)] ?? GRID_RESOLUTION;
  let resLon = resLat;
  if (codeLength > PAIR_CODE_LENGTH) {
    resLat = GRID_RESOLUTION;
    resLon = GRID_RESOLUTION;
  }

  return {
    lat: lat + resLat / 2,
    lon: lon + resLon / 2,
    codeLength,
    bbox: {
      minLat: lat,
      maxLat: lat + resLat,
      minLon: lon,
      maxLon: lon + resLon,
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Validation                                                                   */
/* -------------------------------------------------------------------------- */

export function isValidPlusCode(code: string): boolean {
  if (!code) return false;
  const cleaned = code.trim().toUpperCase().replace(/\s+/g, '');
  const plusIdx = cleaned.indexOf('+');
  if (plusIdx === -1) return false;
  if (plusIdx !== 4 && plusIdx !== 8) return false;

  const olcPart = cleaned.replace('+', '');
  for (const c of olcPart) {
    if (CODE_ALPHABET.indexOf(c) === -1) return false;
  }
  return true;
}

/* -------------------------------------------------------------------------- */
/* Main computation                                                             */
/* -------------------------------------------------------------------------- */

export function computePlusCode(
  mode: 'encode' | 'decode',
  latInput: string,
  lonInput: string,
  codeInput: string,
  codeLength: number,
): PlusCodeResult {
  if (mode === 'encode') {
    const lat = parseFloat(latInput);
    const lon = parseFloat(lonInput);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return { ok: false, message: 'Enter valid latitude and longitude.', code: null, lat: null, lon: null, codeLength: null, bbox: null };
    }
    if (Math.abs(lat) > 90 || Math.abs(lon) > 180) {
      return { ok: false, message: 'Coordinates out of range.', code: null, lat: null, lon: null, codeLength: null, bbox: null };
    }
    const code = encodePlusCode(lat, lon, codeLength);
    const decoded = decodePlusCode(code);
    return {
      ok: true,
      code,
      lat,
      lon,
      codeLength,
      bbox: decoded.bbox,
    };
  } else {
    const code = codeInput.trim();
    if (!code) {
      return { ok: false, message: 'Enter a Plus Code to decode.', code: null, lat: null, lon: null, codeLength: null, bbox: null };
    }
    if (!isValidPlusCode(code)) {
      return { ok: false, message: 'Invalid Plus Code format. Example: 8FVC9G+5F', code: null, lat: null, lon: null, codeLength: null, bbox: null };
    }
    try {
      const decoded = decodePlusCode(code);
      return {
        ok: true,
        code: code.toUpperCase().replace(/\s+/g, ''),
        lat: decoded.lat,
        lon: decoded.lon,
        codeLength: decoded.codeLength,
        bbox: decoded.bbox,
      };
    } catch {
      return { ok: false, message: 'Failed to decode Plus Code.', code: null, lat: null, lon: null, codeLength: null, bbox: null };
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Composable                                                                   */
/* -------------------------------------------------------------------------- */

export interface UsePlusCodeEncoderReturn {
  mode: Ref<'encode' | 'decode'>;
  latInput: Ref<string>;
  lonInput: Ref<string>;
  codeInput: Ref<string>;
  codeLength: Ref<number>;
  snapshot: Ref<PlusCodeResult | null>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  reset: () => void;
}

export function usePlusCodeEncoder(): UsePlusCodeEncoderReturn {
  const mode = ref<'encode' | 'decode'>('encode');
  const latInput = ref<string>('');
  const lonInput = ref<string>('');
  const codeInput = ref<string>('');
  const codeLength = ref<number>(10);
  const snapshot = ref<PlusCodeResult | null>(null);

  function recompute(): void {
    snapshot.value = computePlusCode(
      mode.value,
      latInput.value,
      lonInput.value,
      codeInput.value,
      codeLength.value,
    );
  }

  function reset(): void {
    mode.value = 'encode';
    latInput.value = '';
    lonInput.value = '';
    codeInput.value = '';
    codeLength.value = 10;
    snapshot.value = null;
  }

  watch([mode, latInput, lonInput, codeInput, codeLength], () => recompute());
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
      if (typeof p.code === 'string') {
        codeInput.value = p.code;
      }
      if (typeof p.codeLength === 'number') {
        codeLength.value = p.codeLength;
      }
    },
    output: snapshot,
    toOutput: () => ({ ...(snapshot.value ?? {}) }),
  });

  return { mode, latInput, lonInput, codeInput, codeLength, snapshot, isEmbed, embedInput, reset };
}
