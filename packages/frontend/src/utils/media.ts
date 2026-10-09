/**
 * Pure media helpers shared by the Audio & Video tools.
 *
 * No Vue dependency - every function here can be imported standalone for
 * unit testing or reuse. Covers byte/duration formatting, timestamp
 * parsing, media-kind detection, and extension↔MIME mapping.
 */

/** Format a byte count as a human-readable string (B / KiB / MiB / GiB). */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MiB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GiB`;
}

/**
 * Format a duration in seconds as `MM:SS` or `H:MM:SS`, optionally with
 * millisecond precision (`MM:SS.mmm`).
 */
export function formatDuration(totalSeconds: number, withMs = false): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return '-';
  const s = Math.floor(totalSeconds);
  const ms = Math.round((totalSeconds - s) * 1000);
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  const pad = (n: number): string => n.toString().padStart(2, '0');
  const base =
    hours > 0
      ? `${hours}:${pad(minutes)}:${pad(seconds)}`
      : `${pad(minutes)}:${pad(seconds)}`;
  return withMs ? `${base}.${ms.toString().padStart(3, '0')}` : base;
}

/**
 * Format seconds as an ffmpeg-compatible timestamp `HH:MM:SS.mmm`.
 */
export function formatTimestamp(totalSeconds: number): string {
  const s = Math.max(0, totalSeconds);
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  const pad = (n: number): string => n.toString().padStart(2, '0');
  const sec = seconds.toFixed(3).padStart(6, '0');
  return `${pad(hours)}:${pad(minutes)}:${sec}`;
}

/**
 * Parse a user-supplied timestamp into seconds.
 *
 * Accepts `SS`, `SS.mmm`, `MM:SS`, `MM:SS.mmm`, `HH:MM:SS`, `HH:MM:SS.mmm`,
 * and shorthand like `1m30s` / `90s` / `2m`. Returns `null` on failure.
 */
export function parseTimestamp(input: string): number | null {
  const raw = (input ?? '').trim().toLowerCase();
  if (!raw) return null;
  // Plain seconds (float allowed).
  if (/^\d+(\.\d+)?$/.test(raw)) {
    const v = Number(raw);
    return Number.isFinite(v) ? v : null;
  }
  // Colon-separated h:mm:ss / m:ss (fractional seconds allowed).
  const colon = /^(\d{1,3}):([0-5]?\d)(?::([0-5]?\d(?:\.\d+)?))?$/.exec(raw);
  if (colon) {
    const a = Number(colon[1]);
    const b = Number(colon[2]);
    const c = colon[3] !== undefined ? Number(colon[3]) : undefined;
    if (c === undefined) return a * 60 + b; // m:ss
    return a * 3600 + b * 60 + c; // h:mm:ss
  }
  // Shorthand: 1h2m3.5s in any order.
  const short = /^(?:(\d+(?:\.\d+)?)h)?(?:(\d+(?:\.\d+)?)m)?(?:(\d+(?:\.\d+)?)s)?$/.exec(raw);
  if (short && (short[1] !== undefined || short[2] !== undefined || short[3] !== undefined)) {
    const h = Number(short[1] ?? 0);
    const m = Number(short[2] ?? 0);
    const s = Number(short[3] ?? 0);
    return h * 3600 + m * 60 + s;
  }
  return null;
}

/** Media kind detected from a file's extension / MIME type. */
export type MediaKind = 'audio' | 'video' | 'image' | 'unknown';

const AUDIO_EXTS = new Set([
  'mp3', 'wav', 'ogg', 'oga', 'flac', 'aac', 'm4a', 'opus', 'wma', 'aiff',
  'aif', 'amr', 'mid', 'midi', 'mka', 'mp2', 'ra', 'wv',
]);
const VIDEO_EXTS = new Set([
  'mp4', 'webm', 'mov', 'avi', 'mkv', 'm4v', 'wmv', 'flv', 'ts', 'mts',
  'm2ts', '3gp', '3g2', 'mpg', 'mpeg', 'vob', 'ogv', 'rm', 'asf', 'f4v',
]);
const IMAGE_EXTS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'bmp', 'svg', 'ico', 'tiff', 'tif',
]);

/** Lowercase extension of a filename (no dot), or `''`. */
export function fileExtension(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? '';
  const idx = base.lastIndexOf('.');
  if (idx <= 0 || idx === base.length - 1) return '';
  return base.slice(idx + 1).toLowerCase();
}

/** Filename without its final extension. */
export function stripExtension(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? name;
  const idx = base.lastIndexOf('.');
  return idx > 0 ? base.slice(0, idx) : base;
}

/** Detect whether a file is audio/video/image from MIME then extension. */
export function detectMediaKind(fileName: string, mimeType = ''): MediaKind {
  const mime = mimeType.toLowerCase();
  if (mime.startsWith('audio/')) return 'audio';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('image/')) return 'image';
  const ext = fileExtension(fileName);
  if (AUDIO_EXTS.has(ext)) return 'audio';
  if (VIDEO_EXTS.has(ext)) return 'video';
  if (IMAGE_EXTS.has(ext)) return 'image';
  // Container formats that can hold either - treat as video-capable.
  if (ext === 'mkv' || ext === 'webm') return 'video';
  return 'unknown';
}

/** MIME type for a media file extension (used for output blobs). */
export function mimeForExtension(ext: string): string {
  const map: Record<string, string> = {
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    ogg: 'audio/ogg',
    oga: 'audio/ogg',
    opus: 'audio/ogg',
    flac: 'audio/flac',
    aac: 'audio/aac',
    m4a: 'audio/mp4',
    mp4: 'video/mp4',
    m4v: 'video/mp4',
    mov: 'video/quicktime',
    webm: 'video/webm',
    mkv: 'video/x-matroska',
    avi: 'video/x-msvideo',
    gif: 'image/gif',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
  };
  return map[ext.toLowerCase()] ?? 'application/octet-stream';
}

/** Build an output filename: `<base><suffix>.<ext>`. */
export function outputName(inputName: string, ext: string, suffix = ''): string {
  return `${stripExtension(inputName) || 'output'}${suffix}.${ext}`;
}

/** Sanitize a filename for use inside the ffmpeg virtual FS. */
export function safeFsName(name: string, fallback = 'input'): string {
  const base = name.split(/[\\/]/).pop() ?? '';
  const cleaned = base.replace(/[^\w.\-]+/g, '_');
  return cleaned || fallback;
}

/** Escape a value for use inside an ffmpeg filter argument. */
export function escapeFilterValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/:/g, '\\:');
}

/** Escape a path for the ffmpeg concat demuxer `file '...'` lines. */
export function escapeConcatPath(path: string): string {
  return path.replace(/'/g, "'\\''");
}

/** Trigger a browser download for the given bytes. */
export function downloadBytes(
  bytes: Uint8Array,
  fileName: string,
  mimeType: string,
): void {
  if (typeof document === 'undefined') return;
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const blob = new Blob([copy], { type: mimeType || 'application/octet-stream' });
  downloadBlob(blob, fileName);
}

/** Trigger a browser download for a Blob. */
export function downloadBlob(blob: Blob, fileName: string): void {
  if (typeof document === 'undefined') return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName || 'download.bin';
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** Create an object URL for bytes (for `<audio>`/`<video>`/`<img>` preview). */
export function bytesToObjectUrl(bytes: Uint8Array, mimeType: string): string {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return URL.createObjectURL(new Blob([copy], { type: mimeType }));
}
