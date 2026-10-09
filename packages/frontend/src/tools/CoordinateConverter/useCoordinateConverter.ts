/**
 * useCoordinateConverter - composable + pure logic for coordinate conversion.
 *
 * Supports bidirectional conversion between:
 *   - Decimal degrees (e.g. 48.8584, 2.2945)
 *   - DMS (degrees/minutes/seconds, e.g. 48°51'30.24"N 2°17'40.20"E)
 *   - UTM (Universal Transverse Mercator, e.g. 31U 448252 5411944)
 *   - MGRS (Military Grid Reference System, e.g. 31U DQ 48252 11944)
 *
 * All conversions go through decimal degrees as the intermediate format.
 *
 * No external dependencies - pure arithmetic only.
 */
import { ref, watch, type Ref } from 'vue';
import { useToolEmbed } from '@/composables/useToolEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Types                                                                       */
/* -------------------------------------------------------------------------- */

export type CoordFormat = 'decimal' | 'dms' | 'utm' | 'mgrs';

export interface DMSComponent {
  degrees: number;
  minutes: number;
  seconds: number;
  hemisphere: 'N' | 'S' | 'E' | 'W';
}

export interface DMSResult {
  lat: DMSComponent;
  lon: DMSComponent;
}

export interface UTMResult {
  zoneNumber: number;
  zoneLetter: string;
  easting: number;
  northing: number;
  hemisphere: 'N' | 'S';
}

export interface MGRSResult {
  zoneNumber: number;
  zoneLetter: string;
  columnLetter: string;
  rowLetter: string;
  easting: number;
  northing: number;
  precision: number;
}

export interface ConvertResult {
  ok: boolean;
  message?: string;
  decimal: { lat: number; lon: number } | null;
  dms: DMSResult | null;
  utm: UTMResult | null;
  mgrs: MGRSResult | null;
}

/* -------------------------------------------------------------------------- */
/* Constants - WGS84 ellipsoid                                                 */
/* -------------------------------------------------------------------------- */

const WGS84_A = 6378137.0;
const WGS84_F = 1 / 298.257223563;
const WGS84_E2 = (2 * WGS84_F) - (WGS84_F * WGS84_F);
const WGS84_EP2 = WGS84_E2 / (1 - WGS84_E2);

const MGRS_COLUMN_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const MGRS_ROW_SET_ODD = 'ABCDEFGH';
const MGRS_ROW_SET_EVEN = 'JKLMNPQRSTUV';

const UTM_LAT_BANDS = 'CDEFGHJKLMNPQRSTUVWX';

/* -------------------------------------------------------------------------- */
/* Pure logic - Decimal ↔ DMS                                                  */
/* -------------------------------------------------------------------------- */

export function decimalToDMSLat(lat: number): DMSComponent {
  const hemi: 'N' | 'S' = lat >= 0 ? 'N' : 'S';
  const abs = Math.abs(lat);
  const deg = Math.floor(abs);
  const minFloat = (abs - deg) * 60;
  const min = Math.floor(minFloat);
  const sec = (minFloat - min) * 60;
  return { degrees: deg, minutes: min, seconds: sec, hemisphere: hemi };
}

export function decimalToDMSLon(lon: number): DMSComponent {
  const hemi: 'E' | 'W' = lon >= 0 ? 'E' : 'W';
  const abs = Math.abs(lon);
  const deg = Math.floor(abs);
  const minFloat = (abs - deg) * 60;
  const min = Math.floor(minFloat);
  const sec = (minFloat - min) * 60;
  return { degrees: deg, minutes: min, seconds: sec, hemisphere: hemi };
}

export function decimalToDMS(lat: number, lon: number): DMSResult {
  return { lat: decimalToDMSLat(lat), lon: decimalToDMSLon(lon) };
}

export function dmsToDecimal(
  deg: number,
  min: number,
  sec: number,
  hemi: 'N' | 'S' | 'E' | 'W',
): number {
  const abs = deg + min / 60 + sec / 3600;
  return hemi === 'S' || hemi === 'W' ? -abs : abs;
}

export function formatDMS(dms: DMSResult): string {
  const fmt = (c: DMSComponent): string =>
    `${c.degrees}°${c.minutes}'${c.seconds.toFixed(2)}"${c.hemisphere}`;
  return `${fmt(dms.lat)} ${fmt(dms.lon)}`;
}

/* -------------------------------------------------------------------------- */
/* Pure logic - Decimal ↔ UTM                                                  */
/* -------------------------------------------------------------------------- */

export function latBandLetter(lat: number): string {
  if (lat < -80 || lat > 84) return '';
  const idx = Math.floor((lat + 80) / 8);
  return UTM_LAT_BANDS[idx] ?? '';
}

export function decimalToUTM(lat: number, lon: number): UTMResult {
  const zoneNumber = Math.floor((lon + 180) / 6) + 1;
  const zoneLetter = latBandLetter(lat);

  const lonRad = (lon * Math.PI) / 180;
  const latRad = (lat * Math.PI) / 180;

  const lonOrigin = (zoneNumber - 1) * 6 - 180 + 3;
  const lonOriginRad = (lonOrigin * Math.PI) / 180;

  const N = WGS84_A / Math.sqrt(1 - WGS84_E2 * Math.sin(latRad) ** 2);
  const T = Math.tan(latRad) ** 2;
  const C = WGS84_EP2 * Math.cos(latRad) ** 2;
  const A = Math.cos(latRad) * (lonRad - lonOriginRad);

  const M =
    WGS84_A *
    ((1 - WGS84_E2 / 4 - (3 * WGS84_E2 ** 2) / 64 - (5 * WGS84_E2 ** 3) / 256) * latRad -
      ((3 * WGS84_E2) / 8 + (3 * WGS84_E2 ** 2) / 32 + (45 * WGS84_E2 ** 3) / 1024) * Math.sin(2 * latRad) +
      ((15 * WGS84_E2 ** 2) / 256 + (45 * WGS84_E2 ** 3) / 1024) * Math.sin(4 * latRad) -
      ((35 * WGS84_E2 ** 3) / 3072) * Math.sin(6 * latRad));

  const k0 = 0.9996;
  const easting =
    k0 * N * (A + ((1 - T + C) * A ** 3) / 6 + ((5 - 18 * T + T ** 2 + 72 * C - 58 * WGS84_EP2) * A ** 5) / 120) +
    500000;

  let northing =
    k0 *
    (M +
      N * Math.tan(latRad) * ((A ** 2) / 2 + ((5 - T + 9 * C + 4 * C ** 2) * A ** 4) / 24 + ((61 - 58 * T + T ** 2 + 600 * C - 330 * WGS84_EP2) * A ** 6) / 720));

  if (lat < 0) northing += 10000000;

  return {
    zoneNumber,
    zoneLetter,
    easting: Math.round(easting * 100) / 100,
    northing: Math.round(northing * 100) / 100,
    hemisphere: lat >= 0 ? 'N' : 'S',
  };
}

export function utmToDecimal(
  zoneNumber: number,
  easting: number,
  northing: number,
  isNorth: boolean,
): { lat: number; lon: number } {
  const k0 = 0.9996;
  const x = easting - 500000;
  const y = isNorth ? northing : northing - 10000000;

  const M = y / k0;
  const mu = M / (WGS84_A * (1 - WGS84_E2 / 4 - (3 * WGS84_E2 ** 2) / 64 - (5 * WGS84_E2 ** 3) / 256));

  const e1 = (1 - Math.sqrt(1 - WGS84_E2)) / (1 + Math.sqrt(1 - WGS84_E2));

  const phi1Rad =
    mu +
    ((3 * e1) / 2 - (27 * e1 ** 3) / 32) * Math.sin(2 * mu) +
    ((21 * e1 ** 2) / 16 - (55 * e1 ** 4) / 32) * Math.sin(4 * mu) +
    ((151 * e1 ** 3) / 96) * Math.sin(6 * mu) +
    ((1097 * e1 ** 4) / 512) * Math.sin(8 * mu);

  const N1 = WGS84_A / Math.sqrt(1 - WGS84_E2 * Math.sin(phi1Rad) ** 2);
  const T1 = Math.tan(phi1Rad) ** 2;
  const C1 = WGS84_EP2 * Math.cos(phi1Rad) ** 2;
  const R1 =
    (WGS84_A * (1 - WGS84_E2)) /
    Math.pow(1 - WGS84_E2 * Math.sin(phi1Rad) ** 2, 1.5);
  const D = x / (N1 * k0);

  const lat =
    phi1Rad -
    ((N1 * Math.tan(phi1Rad)) / R1) *
      ((D ** 2) / 2 -
        ((5 + 3 * T1 + 10 * C1 - 4 * C1 ** 2 - 9 * WGS84_EP2) * D ** 4) / 24 +
        ((61 + 90 * T1 + 298 * C1 + 45 * T1 ** 2 - 252 * WGS84_EP2 - 3 * C1 ** 2) * D ** 6) / 720);

  const lon =
    (D - ((1 + 2 * T1 + C1) * D ** 3) / 6 + ((5 - 2 * C1 + 28 * T1 - 3 * C1 ** 2 + 8 * WGS84_EP2 + 24 * T1 ** 2) * D ** 5) / 120) /
      Math.cos(phi1Rad);

  const latDeg = (lat * 180) / Math.PI;
  const lonDeg = ((lon * 180) / Math.PI) + (zoneNumber - 1) * 6 - 180 + 3;

  return { lat: latDeg, lon: lonDeg };
}

/* -------------------------------------------------------------------------- */
/* Pure logic - UTM ↔ MGRS                                                     */
/* -------------------------------------------------------------------------- */

function mgrsColumnLetter(easting: number): string {
  const col = Math.floor(easting / 100000);
  return MGRS_COLUMN_LETTERS[col - 1] ?? '';
}

function mgrsRowLetter(zoneNumber: number, northing: number): string {
  const row = Math.floor(northing / 100000) % 20;
  const set = zoneNumber % 6 === 0 ? MGRS_ROW_SET_EVEN : MGRS_ROW_SET_ODD;
  return set[row] ?? '';
}

export function utmToMGRS(utm: UTMResult, precision = 5): MGRSResult {
  const col = mgrsColumnLetter(utm.easting);
  const row = mgrsRowLetter(utm.zoneNumber, utm.northing);

  const factor = Math.pow(10, 5 - precision);
  const e = Math.floor((utm.easting % 100000) / factor) * factor;
  const n = Math.floor((utm.northing % 100000) / factor) * factor;

  return {
    zoneNumber: utm.zoneNumber,
    zoneLetter: utm.zoneLetter,
    columnLetter: col,
    rowLetter: row,
    easting: e,
    northing: n,
    precision,
  };
}

export function mgrsToUTM(mgrs: MGRSResult): UTMResult {
  const colIdx = MGRS_COLUMN_LETTERS.indexOf(mgrs.columnLetter);
  const set = mgrs.zoneNumber % 6 === 0 ? MGRS_ROW_SET_EVEN : MGRS_ROW_SET_ODD;
  const rowIdx = set.indexOf(mgrs.rowLetter);

  const baseEasting = (colIdx + 1) * 100000;
  const baseNorthing = rowIdx * 100000;

  const minNorthing = getMinNorthing(mgrs.zoneNumber);
  let northing = baseNorthing + mgrs.northing;
  while (northing < minNorthing) northing += 2000000;

  return {
    zoneNumber: mgrs.zoneNumber,
    zoneLetter: mgrs.zoneLetter,
    easting: baseEasting + mgrs.easting,
    northing,
    hemisphere: mgrs.zoneLetter >= 'N' ? 'N' : 'S',
  };
}

function getMinNorthing(zoneNumber: number): number {
  const set = zoneNumber % 6 === 0 ? MGRS_ROW_SET_EVEN : MGRS_ROW_SET_ODD;
  // The 100km northing pattern repeats every 2,000,000m
  // For odd zones, row A starts at 0 for band C
  // For even zones, row J starts at 0 for band C
  if (set === MGRS_ROW_SET_ODD) return 0;
  return -800000;
}

export function formatMGRS(m: MGRSResult): string {
  const digits = (n: number, p: number): string => {
    const s = String(Math.round(n / Math.pow(10, 5 - p)));
    return s.padStart(p, '0');
  };
  return `${m.zoneNumber}${m.zoneLetter}${m.columnLetter}${m.rowLetter} ${digits(m.easting, m.precision)}${digits(m.northing, m.precision)}`;
}

export function formatUTM(u: UTMResult): string {
  return `${u.zoneNumber}${u.zoneLetter} ${u.easting.toFixed(0)} ${u.northing.toFixed(0)}`;
}

/* -------------------------------------------------------------------------- */
/* Parsing                                                                      */
/* -------------------------------------------------------------------------- */

export function parseDMS(input: string): { lat: number; lon: number } | null {
  const cleaned = input.trim().toUpperCase();
  const parts = cleaned.split(/[\s,]+/).filter(Boolean);
  if (parts.length < 2) return null;

  function parsePart(part: string): { value: number; hemi: string } | null {
    const match = part.match(/^(\d+)°(\d+)'?(\d+(?:\.\d+)?)?"?([NSEW])?$/);
    if (match) {
      const d = match[1]!;
      const m = match[2]!;
      const s = match[3] ?? '0';
      const h = match[4] ?? '';
      const val = parseFloat(d) + parseFloat(m) / 60 + parseFloat(s) / 3600;
      return { value: val, hemi: h };
    }
    const match2 = part.match(/^(\d+)°(\d+)'?([NSEW])?$/);
    if (match2) {
      const d = match2[1]!;
      const m = match2[2]!;
      const h = match2[3] ?? '';
      const val = parseFloat(d) + parseFloat(m) / 60;
      return { value: val, hemi: h };
    }
    const match3 = part.match(/^(\d+(?:\.\d+)?)°?([NSEW])?$/);
    if (match3) {
      const d = match3[1]!;
      const h = match3[2] ?? '';
      return { value: parseFloat(d), hemi: h };
    }
    return null;
  }

  const p1 = parsePart(parts[0]!);
  const p2 = parsePart(parts[1]!);
  if (!p1 || !p2) return null;

  let lat: number;
  let lon: number;

  if (p1.hemi === 'N' || p1.hemi === 'S') {
    lat = p1.hemi === 'S' ? -p1.value : p1.value;
    lon = p2.hemi === 'W' ? -p2.value : p2.value;
  } else if (p1.hemi === 'E' || p1.hemi === 'W') {
    lon = p1.hemi === 'W' ? -p1.value : p1.value;
    lat = p2.hemi === 'S' ? -p2.value : p2.value;
  } else {
    // Assume first is lat, second is lon
    lat = p1.value;
    lon = p2.value;
  }

  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return { lat, lon };
}

export function parseUTM(input: string): UTMResult | null {
  const cleaned = input.trim().toUpperCase();
  const match = cleaned.match(/^(\d{1,2})([C-HJ-NP-X])\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)$/);
  if (!match) return null;
  const zn = match[1]!;
  const zl = match[2]!;
  const e = match[3]!;
  const n = match[4]!;
  return {
    zoneNumber: parseInt(zn, 10),
    zoneLetter: zl,
    easting: parseFloat(e),
    northing: parseFloat(n),
    hemisphere: zl >= 'N' ? 'N' : 'S',
  };
}

export function parseMGRS(input: string): MGRSResult | null {
  const cleaned = input.trim().toUpperCase().replace(/\s+/g, ' ');
  const match = cleaned.match(/^(\d{1,2})([C-HJ-NP-X])([A-Z])([A-Z])\s*(\d+)?\s*(\d+)?$/);
  if (!match) return null;
  const zn = match[1]!;
  const zl = match[2]!;
  const cl = match[3]!;
  const rl = match[4]!;
  const eStr = match[5];
  const nStr = match[6];
  const e = eStr ? parseInt(eStr, 10) : 0;
  const n = nStr ? parseInt(nStr, 10) : 0;
  const eLen = eStr?.length ?? 0;
  const nLen = nStr?.length ?? 0;
  const precision = Math.max(eLen, nLen);
  if (precision === 0) return null;

  const factor = Math.pow(10, 5 - precision);
  return {
    zoneNumber: parseInt(zn, 10),
    zoneLetter: zl,
    columnLetter: cl,
    rowLetter: rl,
    easting: e * factor,
    northing: n * factor,
    precision,
  };
}

/* -------------------------------------------------------------------------- */
/* Main conversion                                                              */
/* -------------------------------------------------------------------------- */

export function convertCoordinates(
  input: string,
  format: CoordFormat,
): ConvertResult {
  if (!input.trim()) {
    return { ok: false, message: 'Enter coordinates to convert.', decimal: null, dms: null, utm: null, mgrs: null };
  }

  let lat: number;
  let lon: number;

  if (format === 'decimal') {
    const parts = input.trim().split(/[\s,]+/).filter(Boolean);
    if (parts.length < 2) return { ok: false, message: 'Enter lat and lon separated by space or comma.', decimal: null, dms: null, utm: null, mgrs: null };
    lat = parseFloat(parts[0]!);
    lon = parseFloat(parts[1]!);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return { ok: false, message: 'Invalid decimal coordinates.', decimal: null, dms: null, utm: null, mgrs: null };
    }
  } else if (format === 'dms') {
    const parsed = parseDMS(input);
    if (!parsed) return { ok: false, message: 'Invalid DMS format. Example: 48°51\'30"N 2°17\'40"E', decimal: null, dms: null, utm: null, mgrs: null };
    lat = parsed.lat;
    lon = parsed.lon;
  } else if (format === 'utm') {
    const utm = parseUTM(input);
    if (!utm) return { ok: false, message: 'Invalid UTM format. Example: 31U 448252 5411944', decimal: null, dms: null, utm: null, mgrs: null };
    const dec = utmToDecimal(utm.zoneNumber, utm.easting, utm.northing, utm.hemisphere === 'N');
    lat = dec.lat;
    lon = dec.lon;
  } else {
    const mgrs = parseMGRS(input);
    if (!mgrs) return { ok: false, message: 'Invalid MGRS format. Example: 31U DQ 48252 11944', decimal: null, dms: null, utm: null, mgrs: null };
    const utm = mgrsToUTM(mgrs);
    const dec = utmToDecimal(utm.zoneNumber, utm.easting, utm.northing, utm.hemisphere === 'N');
    lat = dec.lat;
    lon = dec.lon;
  }

  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return { ok: false, message: 'Coordinates out of range.', decimal: null, dms: null, utm: null, mgrs: null };
  }

  const dms = decimalToDMS(lat, lon);
  const utm = decimalToUTM(lat, lon);
  const mgrs = utmToMGRS(utm);

  return {
    ok: true,
    decimal: { lat: Math.round(lat * 1e8) / 1e8, lon: Math.round(lon * 1e8) / 1e8 },
    dms,
    utm,
    mgrs,
  };
}

/* -------------------------------------------------------------------------- */
/* Composable                                                                   */
/* -------------------------------------------------------------------------- */

export interface UseCoordinateConverterReturn {
  input: Ref<string>;
  format: Ref<CoordFormat>;
  snapshot: Ref<ConvertResult | null>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  reset: () => void;
}

export function useCoordinateConverter(): UseCoordinateConverterReturn {
  const input = ref<string>('');
  const format = ref<CoordFormat>('decimal');
  const snapshot = ref<ConvertResult | null>(null);

  function recompute(): void {
    if (!input.value.trim()) {
      snapshot.value = null;
      return;
    }
    snapshot.value = convertCoordinates(input.value, format.value);
  }

  function reset(): void {
    input.value = '';
    format.value = 'decimal';
    snapshot.value = null;
  }

  watch([input, format], () => recompute());
  recompute();

  const { isEmbed, input: embedInput } = useToolEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.input === 'string') input.value = p.input;
      if (typeof p.format === 'string') {
        const f = p.format as CoordFormat;
        if (f === 'decimal' || f === 'dms' || f === 'utm' || f === 'mgrs') {
          format.value = f;
        }
      }
    },
    output: snapshot,
    toOutput: () => ({ ...(snapshot.value ?? {}) }),
  });

  return { input, format, snapshot, isEmbed, embedInput, reset };
}
