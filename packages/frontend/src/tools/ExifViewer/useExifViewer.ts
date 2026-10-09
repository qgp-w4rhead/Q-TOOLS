/**
 * useExifViewer - composable + pure logic for the EXIF viewer tool.
 *
 * Parses EXIF metadata embedded in JPEG (APP1 `Exif` segment) and PNG
 * (`eXIf` chunk) files via a hand-rolled TIFF/IFD reader - no external
 * dependencies. Extracts camera, lens, exposure, datetime, and GPS fields
 * and presents them as grouped key/value rows.
 *
 * Pure helpers (`findExifSegment`, `parseExif`, `formatGps`, …) have no Vue
 * dependency and can be imported standalone for unit testing.
 */
import { onBeforeUnmount, ref, watch, type Ref } from 'vue';
import { useEmbed } from '@/composables/useEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';
import { formatBytes } from '@/utils/media';

/* -------------------------------------------------------------------------- */
/* Types + constants                                                           */
/* -------------------------------------------------------------------------- */

/** A single decoded EXIF field. */
export interface ExifEntry {
  /** Group label, e.g. "Camera", "Exposure", "GPS". */
  group: string;
  /** Human-readable field name, e.g. "F-number". */
  label: string;
  /** Formatted value. */
  value: string;
}

export interface ExifResult {
  entries: ExifEntry[];
  /** Decimal-degrees GPS position when present. */
  gps: { lat: number; lon: number; alt: number | null } | null;
  /** Raw tag count parsed. */
  tagCount: number;
}

/* -------------------------------------------------------------------------- */
/* TIFF/EXIF parsing - pure logic                                              */
/* -------------------------------------------------------------------------- */

/** TIFF field types we decode. */
const TYPE_SIZES: Record<number, number> = {
  1: 1, // BYTE
  2: 1, // ASCII
  3: 2, // SHORT
  4: 4, // LONG
  5: 8, // RATIONAL
  7: 1, // UNDEFINED
  9: 4, // SLONG
  10: 8, // SRATIONAL
};

/** IFD0 tag table → [label, group]. */
const IFD0_TAGS: Record<number, [string, string]> = {
  0x010e: ['Description', 'Image'],
  0x010f: ['Make', 'Camera'],
  0x0110: ['Model', 'Camera'],
  0x0112: ['Orientation', 'Image'],
  0x011a: ['X resolution', 'Image'],
  0x011b: ['Y resolution', 'Image'],
  0x0128: ['Resolution unit', 'Image'],
  0x0131: ['Software', 'Image'],
  0x0132: ['Modified', 'Dates'],
  0x013b: ['Artist', 'Image'],
  0x0213: ['YCbCr positioning', 'Image'],
  0x8298: ['Copyright', 'Image'],
};

/** Exif sub-IFD tag table → [label, group]. */
const EXIF_TAGS: Record<number, [string, string]> = {
  0x829a: ['Exposure time', 'Exposure'],
  0x829d: ['F-number', 'Exposure'],
  0x8822: ['Exposure program', 'Exposure'],
  0x8827: ['ISO speed', 'Exposure'],
  0x8830: ['Sensitivity type', 'Exposure'],
  0x9000: ['EXIF version', 'Image'],
  0x9003: ['Taken', 'Dates'],
  0x9004: ['Digitized', 'Dates'],
  0x9101: ['Components', 'Image'],
  0x9201: ['Shutter speed', 'Exposure'],
  0x9202: ['Aperture', 'Exposure'],
  0x9204: ['Exposure bias', 'Exposure'],
  0x9205: ['Max aperture', 'Exposure'],
  0x9206: ['Subject distance', 'Exposure'],
  0x9207: ['Metering mode', 'Exposure'],
  0x9208: ['Light source', 'Exposure'],
  0x9209: ['Flash', 'Exposure'],
  0x920a: ['Focal length', 'Lens'],
  0x927c: ['Maker note', 'Image'],
  0x9286: ['User comment', 'Image'],
  0xa000: ['Flashpix version', 'Image'],
  0xa001: ['Color space', 'Image'],
  0xa002: ['Pixel width', 'Image'],
  0xa003: ['Pixel height', 'Image'],
  0xa20e: ['Focal plane X res', 'Image'],
  0xa20f: ['Focal plane Y res', 'Image'],
  0xa210: ['Focal plane unit', 'Image'],
  0xa217: ['Sensing method', 'Image'],
  0xa300: ['File source', 'Image'],
  0xa301: ['Scene type', 'Image'],
  0xa401: ['Custom rendered', 'Exposure'],
  0xa402: ['Exposure mode', 'Exposure'],
  0xa403: ['White balance', 'Exposure'],
  0xa404: ['Digital zoom', 'Exposure'],
  0xa405: ['Focal length (35mm eq)', 'Lens'],
  0xa406: ['Scene capture', 'Exposure'],
  0xa407: ['Gain control', 'Exposure'],
  0xa408: ['Contrast', 'Exposure'],
  0xa409: ['Saturation', 'Exposure'],
  0xa40a: ['Sharpness', 'Exposure'],
  0xa431: ['Body serial', 'Camera'],
  0xa432: ['Lens spec', 'Lens'],
  0xa433: ['Lens make', 'Lens'],
  0xa434: ['Lens model', 'Lens'],
  0xa435: ['Lens serial', 'Lens'],
};

/** GPS IFD tag table → label. */
const GPS_TAGS: Record<number, string> = {
  0x0000: 'GPS version',
  0x0001: 'Latitude ref',
  0x0002: 'Latitude',
  0x0003: 'Longitude ref',
  0x0004: 'Longitude',
  0x0005: 'Altitude ref',
  0x0006: 'Altitude',
  0x0007: 'Timestamp',
  0x0008: 'Satellites',
  0x0009: 'Status',
  0x000a: 'Measure mode',
  0x000b: 'DOP',
  0x000c: 'Speed ref',
  0x000d: 'Speed',
  0x0010: 'Img direction ref',
  0x0011: 'Img direction',
  0x001d: 'Datestamp',
};

const ORIENTATION_LABELS: Record<number, string> = {
  1: 'Normal',
  2: 'Mirrored horizontal',
  3: 'Rotated 180°',
  4: 'Mirrored vertical',
  5: 'Mirrored + rotated 90° CCW',
  6: 'Rotated 90° CW',
  7: 'Mirrored + rotated 90° CW',
  8: 'Rotated 90° CCW',
};

const EXPOSURE_PROGRAM_LABELS: Record<number, string> = {
  0: 'Not defined',
  1: 'Manual',
  2: 'Program AE',
  3: 'Aperture priority',
  4: 'Shutter priority',
  5: 'Creative',
  6: 'Action',
  7: 'Portrait',
  8: 'Landscape',
};

const METERING_LABELS: Record<number, string> = {
  0: 'Unknown',
  1: 'Average',
  2: 'Center-weighted',
  3: 'Spot',
  4: 'Multi-spot',
  5: 'Multi-segment',
  6: 'Partial',
  255: 'Other',
};

const FLASH_LABELS: Record<number, string> = {
  0x0000: 'No flash',
  0x0001: 'Flash fired',
  0x0005: 'Flash fired, no return',
  0x0007: 'Flash fired, return detected',
  0x0009: 'Flash fired, compulsory',
  0x0010: 'No flash, compulsory off',
  0x0018: 'No flash, auto',
  0x0019: 'Flash fired, auto',
  0x0020: 'No flash function',
};

const WHITEBALANCE_LABELS: Record<number, string> = { 0: 'Auto', 1: 'Manual' };
const SCENE_CAPTURE_LABELS: Record<number, string> = {
  0: 'Standard',
  1: 'Landscape',
  2: 'Portrait',
  3: 'Night',
};
const COLORSPACE_LABELS: Record<number, string> = {
  1: 'sRGB',
  2: 'Adobe RGB',
  0xffff: 'Uncalibrated',
};

interface TiffReader {
  view: DataView;
  little: boolean;
  base: number; // absolute offset of TIFF header start within the buffer
}

function u16(r: TiffReader, off: number): number {
  return r.view.getUint16(r.base + off, r.little);
}
function u32(r: TiffReader, off: number): number {
  return r.view.getUint32(r.base + off, r.little);
}
function i32(r: TiffReader, off: number): number {
  return r.view.getInt32(r.base + off, r.little);
}

function readAscii(r: TiffReader, off: number, count: number): string {
  let s = '';
  const start = r.base + off;
  const end = Math.min(start + count, r.view.byteLength);
  for (let i = start; i < end; i++) {
    const c = r.view.getUint8(i);
    if (c === 0) break;
    s += String.fromCharCode(c);
  }
  return s.trim();
}

function readRational(r: TiffReader, off: number): number {
  const num = u32(r, off);
  const den = u32(r, off + 4);
  return den === 0 ? 0 : num / den;
}

function readSRational(r: TiffReader, off: number): number {
  const num = i32(r, off);
  const den = i32(r, off + 4);
  return den === 0 ? 0 : num / den;
}

/** Read the raw value(s) of an IFD entry. */
function readValue(
  r: TiffReader,
  type: number,
  count: number,
  valueOrOffset: number,
): number[] | string | null {
  const size = (TYPE_SIZES[type] ?? 0) * count;
  if (size === 0) return null;
  // Values ≤ 4 bytes are stored inline in the entry's 4-byte value field -
  // callers pass the field's absolute offset, so convert to TIFF-relative.
  // Larger values are stored out-of-line and callers pass the TIFF-relative
  // offset read from the entry.
  const dataOff = size <= 4 ? valueOrOffset - r.base : valueOrOffset;
  try {
    if (type === 2) return readAscii(r, dataOff, count);
    const out: number[] = [];
    for (let i = 0; i < count; i++) {
      const o = dataOff + i * (TYPE_SIZES[type] ?? 1);
      if (r.base + o + (TYPE_SIZES[type] ?? 1) > r.view.byteLength) break;
      switch (type) {
        case 1:
        case 7:
          out.push(r.view.getUint8(r.base + o));
          break;
        case 3:
          out.push(u16(r, o));
          break;
        case 4:
          out.push(u32(r, o));
          break;
        case 5:
          out.push(readRational(r, o));
          break;
        case 9:
          out.push(i32(r, o));
          break;
        case 10:
          out.push(readSRational(r, o));
          break;
        default:
          return null;
      }
    }
    return out;
  } catch {
    return null;
  }
}

/** Format a decoded value for display, with tag-specific overrides. */
function formatValue(tag: number, value: number[] | string | null): string | null {
  if (value === null) return null;
  if (typeof value === 'string') return value || null;
  if (value.length === 0) return null;

  const first = value[0] ?? 0;
  switch (tag) {
    case 0x0112:
      return ORIENTATION_LABELS[first] ?? `Unknown (${first})`;
    case 0x829a: // ExposureTime → "1/125 s" or "0.5 s"
      return first > 0 && first < 1
        ? `1/${Math.round(1 / first)} s`
        : `${round2(first)} s`;
    case 0x829d: // FNumber → "f/2.8"
      return `f/${round2(first)}`;
    case 0x9201: // ShutterSpeedValue (APEX) → "1/125 s"
      if (first === 0) return '0';
      return first > 0
        ? `1/${round2(2 ** first)} s`
        : `${round2(2 ** first)} s`;
    case 0x9202: // ApertureValue (APEX) → f/N
      return `f/${round2(2 ** (first / 2))}`;
    case 0x9205:
      return `f/${round2(2 ** (first / 2))}`;
    case 0x9204:
      return `${round2(first)} EV`;
    case 0x8822:
      return EXPOSURE_PROGRAM_LABELS[first] ?? `Unknown (${first})`;
    case 0x9207:
      return METERING_LABELS[first] ?? `Unknown (${first})`;
    case 0x9209:
      return FLASH_LABELS[first] ?? `0x${first.toString(16)}`;
    case 0xa403:
      return WHITEBALANCE_LABELS[first] ?? `Unknown (${first})`;
    case 0xa406:
      return SCENE_CAPTURE_LABELS[first] ?? `Unknown (${first})`;
    case 0xa001:
      return COLORSPACE_LABELS[first] ?? `Unknown (${first})`;
    case 0x920a:
      return `${round2(first)} mm`;
    case 0xa405:
      return `${Math.round(first)} mm`;
    case 0x9206:
      return `${round2(first)} m`;
    case 0xa404:
      return `${round2(first)}×`;
    case 0x011a:
    case 0x011b:
      return `${Math.round(first)} dpi`;
    case 0x0128:
      return first === 3 ? 'cm' : 'inch';
    case 0x9000:
    case 0xa000:
      // Version fields are 4-byte ASCII stored as UNDEFINED.
      return value.map((c) => String.fromCharCode(c)).join('') || null;
    default:
      break;
  }
  if (value.length === 1) return String(round2(first));
  return value.map((v) => round2(v)).join(', ');
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Walk one IFD, appending decoded entries. Returns the next-IFD offset. */
function walkIfd(
  r: TiffReader,
  ifdOffset: number,
  table: Record<number, [string, string]>,
  entries: ExifEntry[],
  depth = 0,
): number {
  if (depth > 4 || ifdOffset <= 0) return 0;
  const countPos = r.base + ifdOffset;
  if (countPos + 2 > r.view.byteLength) return 0;
  const count = u16(r, ifdOffset);
  for (let i = 0; i < count; i++) {
    const entryOff = ifdOffset + 2 + i * 12;
    if (r.base + entryOff + 12 > r.view.byteLength) break;
    const tag = u16(r, entryOff);
    const type = u16(r, entryOff + 2);
    const num = u32(r, entryOff + 4);
    const valueFieldAbs = r.base + entryOff + 8; // absolute offset of the 4-byte value field
    const raw = u32(r, entryOff + 8);

    // For inline values (≤4 bytes) pass the field's absolute offset so
    // readValue reads the bytes in place; for larger values pass the offset.
    const size = (TYPE_SIZES[type] ?? 0) * num;
    const value = readValue(r, type, num, size <= 4 ? valueFieldAbs : raw);

    const meta = table[tag];
    if (meta) {
      const formatted = formatValue(tag, value);
      if (formatted !== null) {
        entries.push({ group: meta[1], label: meta[0], value: formatted });
      }
    }
  }
  const nextPos = r.base + ifdOffset + 2 + count * 12;
  return nextPos + 4 <= r.view.byteLength ? u32(r, ifdOffset + 2 + count * 12) : 0;
}

/** Find the offset of a sub-IFD pointer tag inside an IFD. */
function findSubIfdOffset(r: TiffReader, ifdOffset: number, pointerTag: number): number {
  if (ifdOffset <= 0) return 0;
  const countPos = r.base + ifdOffset;
  if (countPos + 2 > r.view.byteLength) return 0;
  const count = u16(r, ifdOffset);
  for (let i = 0; i < count; i++) {
    const entryOff = ifdOffset + 2 + i * 12;
    if (r.base + entryOff + 12 > r.view.byteLength) break;
    if (u16(r, entryOff) === pointerTag) return u32(r, entryOff + 8);
  }
  return 0;
}

/** Convert a GPS DMS triplet + hemisphere ref to decimal degrees. */
function dmsToDecimal(dms: number[] | string | null, ref: string | null): number | null {
  if (!Array.isArray(dms) || dms.length < 3) return null;
  const dec = (dms[0] ?? 0) + (dms[1] ?? 0) / 60 + (dms[2] ?? 0) / 3600;
  const sign = ref === 'S' || ref === 'W' ? -1 : 1;
  return sign * dec;
}

/** Format a decimal-degree coordinate as `DD.DDDDDD° N/S`. */
export function formatGpsCoord(dec: number, isLat: boolean): string {
  const hemi = isLat ? (dec >= 0 ? 'N' : 'S') : dec >= 0 ? 'E' : 'W';
  return `${Math.abs(dec).toFixed(6)}° ${hemi}`;
}

/**
 * Locate the TIFF header inside a file buffer.
 * - JPEG: scans markers for the APP1 `Exif\0\0` segment.
 * - PNG: scans chunks for `eXIf`.
 * Returns the absolute offset of the TIFF header, or -1.
 */
export function findExifSegment(buf: ArrayBuffer): number {
  const view = new DataView(buf);
  const len = buf.byteLength;
  if (len < 12) return -1;

  // JPEG: starts with FFD8; walk marker segments.
  if (view.getUint16(0) === 0xffd8) {
    let pos = 2;
    while (pos + 4 <= len) {
      if (view.getUint8(pos) !== 0xff) break;
      const marker = view.getUint8(pos + 1);
      const segLen = view.getUint16(pos + 2);
      if (marker === 0xe1 && pos + 10 <= len) {
        // "Exif\0\0" header check.
        if (
          view.getUint32(pos + 4) === 0x45786966 && // "Exif"
          view.getUint16(pos + 8) === 0
        ) {
          return pos + 10; // TIFF header starts after "Exif\0\0"
        }
      }
      if (marker === 0xda) break; // start of scan - no more metadata
      pos += 2 + segLen;
    }
    return -1;
  }

  // PNG: 8-byte signature then length/type/data chunks.
  if (view.getUint32(0) === 0x89504e47 && view.getUint32(4) === 0x0d0a1a0a) {
    let pos = 8;
    while (pos + 12 <= len) {
      const chunkLen = view.getUint32(pos);
      const type = view.getUint32(pos + 4);
      if (type === 0x65584966) return pos + 8; // "eXIf"
      pos += 12 + chunkLen;
    }
    return -1;
  }

  return -1;
}

/**
 * Parse EXIF metadata from a file buffer. Returns `null` when no EXIF
 * segment is found or the TIFF header is malformed.
 */
export function parseExif(buf: ArrayBuffer): ExifResult | null {
  const tiffStart = findExifSegment(buf);
  if (tiffStart < 0) return null;
  const view = new DataView(buf);
  if (tiffStart + 8 > buf.byteLength) return null;

  const byteOrder = view.getUint16(tiffStart);
  const little = byteOrder === 0x4949; // "II"
  if (!little && byteOrder !== 0x4d4d) return null; // "MM"
  const r: TiffReader = { view, little, base: tiffStart };
  if (u16(r, 2) !== 42) return null;

  const entries: ExifEntry[] = [];
  const ifd0 = u32(r, 4);
  walkIfd(r, ifd0, IFD0_TAGS, entries);

  // Exif sub-IFD (pointer tag 0x8769 in IFD0).
  const exifIfd = findSubIfdOffset(r, ifd0, 0x8769);
  if (exifIfd > 0) walkIfd(r, exifIfd, EXIF_TAGS, entries);

  // GPS sub-IFD (pointer tag 0x8825 in IFD0).
  let gps: ExifResult['gps'] = null;
  const gpsIfd = findSubIfdOffset(r, ifd0, 0x8825);
  if (gpsIfd > 0) {
    const gpsEntries: ExifEntry[] = [];
    // Collect raw GPS values for coordinate conversion.
    const raw: Record<number, number[] | string | null> = {};
    const countPos = r.base + gpsIfd;
    if (countPos + 2 <= r.view.byteLength) {
      const count = u16(r, gpsIfd);
      for (let i = 0; i < count; i++) {
        const entryOff = gpsIfd + 2 + i * 12;
        if (r.base + entryOff + 12 > r.view.byteLength) break;
        const tag = u16(r, entryOff);
        const type = u16(r, entryOff + 2);
        const num = u32(r, entryOff + 4);
        const valueFieldAbs = r.base + entryOff + 8;
        const rawOff = u32(r, entryOff + 8);
        const size = (TYPE_SIZES[type] ?? 0) * num;
        raw[tag] = readValue(r, type, num, size <= 4 ? valueFieldAbs : rawOff);
      }
    }
    const lat = dmsToDecimal(raw[0x0002] ?? null, (raw[0x0001] as string) ?? null);
    const lon = dmsToDecimal(raw[0x0004] ?? null, (raw[0x0003] as string) ?? null);
    const altArr = raw[0x0006];
    const altRef = Array.isArray(raw[0x0005]) ? (raw[0x0005] as number[])[0] : 0;
    const alt =
      Array.isArray(altArr) && altArr.length > 0
        ? (altRef === 1 ? -1 : 1) * (altArr[0] ?? 0)
        : null;
    if (lat !== null && lon !== null) {
      gps = { lat, lon, alt };
      gpsEntries.push({
        group: 'GPS',
        label: 'Coordinates',
        value: `${formatGpsCoord(lat, true)}, ${formatGpsCoord(lon, false)}`,
      });
      if (alt !== null) {
        gpsEntries.push({ group: 'GPS', label: 'Altitude', value: `${round2(alt)} m` });
      }
    }
    // Other GPS fields (timestamp, direction, etc.).
    for (const [tagStr, label] of Object.entries(GPS_TAGS)) {
      const tag = Number(tagStr);
      if (tag === 0x0001 || tag === 0x0002 || tag === 0x0003 || tag === 0x0004 || tag === 0x0005 || tag === 0x0006) {
        continue; // already rendered as coordinates/altitude
      }
      const v = raw[tag];
      if (v === null || v === undefined) continue;
      const formatted = typeof v === 'string' ? v : v.map((n) => round2(n)).join(', ');
      if (formatted) gpsEntries.push({ group: 'GPS', label, value: formatted });
    }
    entries.push(...gpsEntries);
  }

  if (entries.length === 0) return null;
  return { entries, gps, tagCount: entries.length };
}

/* -------------------------------------------------------------------------- */
/* Composable                                                                  */
/* -------------------------------------------------------------------------- */

export interface UseExifViewerReturn {
  fileName: Ref<string>;
  fileSizeBytes: Ref<number>;
  previewUrl: Ref<string | null>;
  hasFile: Ref<boolean>;
  result: Ref<ExifResult | null>;
  error: Ref<string | null>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  setFile: (file: File) => Promise<void>;
  reset: () => void;
}

export function useExifViewer(): UseExifViewerReturn {
  const fileName = ref<string>('');
  const fileSizeBytes = ref<number>(0);
  const previewUrl = ref<string | null>(null);
  const hasFile = ref<boolean>(false);
  const result = ref<ExifResult | null>(null);
  const error = ref<string | null>(null);

  function clear(): void {
    if (previewUrl.value) URL.revokeObjectURL(previewUrl.value);
    previewUrl.value = null;
    hasFile.value = false;
    result.value = null;
  }

  async function setFile(file: File): Promise<void> {
    error.value = null;
    clear();
    try {
      const buf = await file.arrayBuffer();
      fileName.value = file.name || 'image';
      fileSizeBytes.value = file.size;
      previewUrl.value = URL.createObjectURL(file);
      hasFile.value = true;
      const parsed = parseExif(buf);
      if (!parsed) {
        error.value = 'No EXIF metadata found in this file (JPEG APP1 or PNG eXIf only).';
      } else {
        result.value = parsed;
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to read the file.';
    }
  }

  function reset(): void {
    clear();
    error.value = null;
  }

  /* ----------------------------- embed I/O ------------------------------ */

  const { isEmbed, input: embedInput, sendOutput } = useEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (p.action === 'reset') reset();
    },
  });

  watch([hasFile, result, error], () => {
    if (!isEmbed.value) return;
    sendOutput({
      hasFile: hasFile.value,
      fileName: fileName.value,
      fileSizeBytes: fileSizeBytes.value,
      tagCount: result.value?.tagCount ?? 0,
      gps: result.value?.gps ?? undefined,
      entries: result.value?.entries,
      error: error.value ?? undefined,
    });
  });

  onBeforeUnmount(reset);

  return {
    fileName,
    fileSizeBytes,
    previewUrl,
    hasFile,
    result,
    error,
    isEmbed,
    embedInput,
    setFile,
    reset,
  };
}

export { formatBytes };
