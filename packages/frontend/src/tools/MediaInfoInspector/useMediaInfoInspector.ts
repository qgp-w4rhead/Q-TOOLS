/**
 * useMediaInfoInspector - composable + pure logic for the media info
 * inspector tool.
 *
 * Inspects a media file's container, codecs, duration, bitrate,
 * resolution, and streams entirely in the browser via ffprobe
 * (ffmpeg.wasm, lazy-loaded). `ffprobe -show_format -show_streams -of
 * json` gives structured data; the raw JSON is also shown for power users.
 *
 * Pure helpers (`summarizeProbe`, `formatBitrate`, `formatHz`) have no
 * Vue dependency. The composable wires up the embed PostMessage protocol:
 *  - input  → `{ url }`
 *  - output → `{ status, fileName, summary, error }`
 */
import { ref, watch, type Ref } from 'vue';
import { useEmbed } from '@/composables/useEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';
import {
  blobToBytes,
  deleteQuiet,
  getFFmpeg,
  probeJson,
} from '@/utils/ffmpeg';
import {
  detectMediaKind,
  formatBytes,
  formatDuration,
  safeFsName,
} from '@/utils/media';

/* -------------------------------------------------------------------------- */
/* Pure logic - no Vue dependency below this point                            */
/* -------------------------------------------------------------------------- */

/** Max input size - the file is copied into the ffmpeg FS for probing. */
export const MAX_FILE_SIZE = 512 * 1024 * 1024;

/** ffprobe JSON shapes (subset of the real schema). */
export interface FfprobeStream {
  index?: number;
  codec_name?: string;
  codec_long_name?: string;
  codec_type?: string;
  profile?: string;
  width?: number;
  height?: number;
  pix_fmt?: string;
  r_frame_rate?: string;
  avg_frame_rate?: string;
  sample_rate?: string;
  channels?: number;
  channel_layout?: string;
  bit_rate?: string;
  duration?: string;
  disposition?: { attached_pic?: number };
  tags?: Record<string, string>;
}

export interface FfprobeFormat {
  filename?: string;
  format_name?: string;
  format_long_name?: string;
  duration?: string;
  size?: string;
  bit_rate?: string;
  probe_score?: number;
  tags?: Record<string, string>;
}

export interface FfprobeResult {
  streams?: FfprobeStream[];
  format?: FfprobeFormat;
}

/** A flattened, display-ready stream row. */
export interface StreamSummary {
  index: number;
  type: string;
  codec: string;
  details: string[];
}

/** A flattened, display-ready summary of the whole file. */
export interface MediaSummary {
  container: string;
  durationSec: number | null;
  durationText: string;
  bitrateKbps: number | null;
  sizeBytes: number | null;
  probeScore: number | null;
  streams: StreamSummary[];
  tags: Record<string, string>;
}

/** Format a bit/s value as kb/s text. */
export function formatBitrate(bps: number | null): string {
  if (bps === null || !Number.isFinite(bps)) return '-';
  if (bps >= 1_000_000) return `${(bps / 1_000_000).toFixed(2)} Mb/s`;
  return `${Math.round(bps / 1000)} kb/s`;
}

/** Format a sample rate in Hz as kHz text. */
export function formatHz(hz: number | null): string {
  if (hz === null || !Number.isFinite(hz)) return '-';
  return `${(hz / 1000).toFixed(1)} kHz`;
}

/** Parse an ffprobe `r_frame_rate` fraction ("30000/1001") to a number. */
export function parseFrameRate(frac: string | undefined): number | null {
  if (!frac) return null;
  const [n, d] = frac.split('/').map(Number);
  if (!n || !Number.isFinite(n)) return null;
  const rate = d && Number.isFinite(d) ? n / d : n;
  return Number.isFinite(rate) && rate > 0 ? rate : null;
}

/** Flatten ffprobe JSON into a display-ready summary. Pure. */
export function summarizeProbe(probe: FfprobeResult | null): MediaSummary | null {
  if (!probe?.format) return null;
  const f = probe.format;
  const durationSec = f.duration ? Number(f.duration) : null;
  const bitrate = f.bit_rate ? Number(f.bit_rate) : null;
  const size = f.size ? Number(f.size) : null;

  const streams: StreamSummary[] = (probe.streams ?? []).map((s) => {
    const details: string[] = [];
    if (s.codec_type === 'video') {
      if (s.disposition?.attached_pic === 1) details.push('attached picture');
      if (s.width && s.height) details.push(`${s.width}×${s.height}`);
      if (s.pix_fmt) details.push(s.pix_fmt);
      const fps = parseFrameRate(s.avg_frame_rate ?? s.r_frame_rate);
      if (fps) details.push(`${fps.toFixed(2)} fps`);
    } else if (s.codec_type === 'audio') {
      if (s.sample_rate) details.push(formatHz(Number(s.sample_rate)));
      if (s.channel_layout) details.push(s.channel_layout);
      else if (s.channels) details.push(`${s.channels} ch`);
    }
    if (s.profile) details.push(s.profile);
    if (s.bit_rate) details.push(formatBitrate(Number(s.bit_rate)));
    return {
      index: s.index ?? 0,
      type: s.codec_type ?? 'unknown',
      codec: s.codec_long_name ?? s.codec_name ?? 'unknown',
      details,
    };
  });

  const tags: Record<string, string> = {};
  for (const [k, v] of Object.entries(f.tags ?? {})) {
    tags[k.toLowerCase()] = String(v);
  }

  return {
    container: f.format_long_name ?? f.format_name ?? 'unknown',
    durationSec: durationSec !== null && Number.isFinite(durationSec) ? durationSec : null,
    durationText:
      durationSec !== null && Number.isFinite(durationSec)
        ? formatDuration(durationSec, true)
        : '-',
    bitrateKbps: bitrate !== null && Number.isFinite(bitrate) ? bitrate / 1000 : null,
    sizeBytes: size !== null && Number.isFinite(size) ? size : null,
    probeScore: f.probe_score ?? null,
    streams,
    tags,
  };
}

/* -------------------------------------------------------------------------- */
/* Composable                                                                  */
/* -------------------------------------------------------------------------- */

export type InspectStatus =
  | 'idle'
  | 'loading-engine'
  | 'probing'
  | 'done'
  | 'error';

export interface PickedFile {
  name: string;
  size: number;
  mimeType: string;
  kind: string;
}

export interface UseMediaInfoInspectorReturn {
  file: Ref<PickedFile | null>;
  summary: Ref<MediaSummary | null>;
  rawJson: Ref<string>;
  status: Ref<InspectStatus>;
  error: Ref<string>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  onFile: (file: File) => Promise<void>;
  clear: () => void;
}

export function useMediaInfoInspector(): UseMediaInfoInspectorReturn {
  const file = ref<PickedFile | null>(null);
  const summary = ref<MediaSummary | null>(null);
  const rawJson = ref<string>('');
  const status = ref<InspectStatus>('idle');
  const error = ref<string>('');

  async function onFile(f: File): Promise<void> {
    error.value = '';
    summary.value = null;
    rawJson.value = '';
    if (f.size > MAX_FILE_SIZE) {
      error.value = `File is too large (max ${formatBytes(MAX_FILE_SIZE)}).`;
      return;
    }
    const kind = detectMediaKind(f.name, f.type);
    file.value = {
      name: f.name || 'media',
      size: f.size,
      mimeType: f.type || '',
      kind,
    };
    try {
      status.value = 'loading-engine';
      const ffmpeg = await getFFmpeg();
      status.value = 'probing';
      const inName = safeFsName(file.value.name, 'input.media');
      await ffmpeg.writeFile(inName, await blobToBytes(f));
      try {
        const probe = await probeJson<FfprobeResult>(ffmpeg, inName, [
          '-show_format',
          '-show_streams',
        ]);
        rawJson.value = probe ? JSON.stringify(probe, null, 2) : '';
        const s = summarizeProbe(probe);
        if (!s) {
          throw new Error(
            'ffprobe could not read this file - unsupported or corrupt media.',
          );
        }
        summary.value = s;
        status.value = 'done';
      } finally {
        await deleteQuiet(ffmpeg, inName);
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Probe failed.';
      status.value = 'error';
    }
  }

  function clear(): void {
    file.value = null;
    summary.value = null;
    rawJson.value = '';
    status.value = 'idle';
    error.value = '';
  }

  /* ----------------------------- embed I/O ------------------------------ */

  const { isEmbed, input: embedInput, sendOutput } = useEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.url === 'string' && p.url.length > 0) {
        void (async () => {
          try {
            const res = await fetch(p.url as string);
            if (!res.ok) {
              error.value = `Failed to fetch URL (${res.status}).`;
              return;
            }
            const blob = await res.blob();
            const name =
              typeof p.fileName === 'string' && p.fileName
                ? p.fileName
                : (p.url as string).split('/').pop() || 'media';
            await onFile(new File([blob], name, { type: blob.type }));
          } catch (e) {
            error.value = e instanceof Error ? e.message : 'Failed to fetch URL.';
          }
        })();
      }
      if (p.action === 'clear') clear();
    },
  });

  watch(
    [status, file, summary, error],
    () => {
      if (!isEmbed.value) return;
      sendOutput({
        status: status.value,
        fileName: file.value?.name ?? '',
        summary: summary.value ?? undefined,
        error: error.value || undefined,
      });
    },
    { deep: true },
  );

  return {
    file,
    summary,
    rawJson,
    status,
    error,
    isEmbed,
    embedInput,
    onFile,
    clear,
  };
}
