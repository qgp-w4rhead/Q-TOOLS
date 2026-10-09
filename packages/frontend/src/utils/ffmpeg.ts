/**
 * ffmpeg.wasm lazy loader + exec helpers shared by the Audio & Video tools.
 *
 * The single-threaded `@ffmpeg/core` (~32 MB WASM) is dynamically imported
 * via `?url` asset imports so it lands in its own Vite chunk and is only
 * fetched when a tool actually needs transcoding - served same-origin and
 * offline-cacheable by the PWA service worker (no CDN needed).
 *
 * The `@ffmpeg/ffmpeg` / `@ffmpeg/util` wrapper packages are replaced by
 * our own `FfmpegClient` + `workers/ffmpeg.worker.ts` - a ~200-line
 * worker-RPC layer exposing the same API surface (`load`, `exec`,
 * `ffprobe`, `writeFile`, `readFile`, `deleteFile`, `on`/`off` events).
 *
 * A single `FfmpegClient` instance is shared across all tools on the page -
 * the core only needs to be loaded once per session.
 */

/** One captured ffmpeg log line (stderr/stdout merged by the worker). */
export interface FfmpegLogLine {
  type: string;
  message: string;
}

/** Progress event emitted by the core during a run. */
export interface FfmpegProgressEvent {
  /** 0-1 ratio (can exceed 1 slightly; clamped by `runFfmpeg`). */
  progress: number;
  /** Processed time in microseconds. */
  time: number;
}

/** Result of an `exec()` / `ffprobe()` call. */
export interface FfmpegRunResult {
  /** Process exit code - `0` means success. */
  exitCode: number;
  /** All log lines captured during the run. */
  logs: FfmpegLogLine[];
  /** Log messages joined with newlines (for display / regex parsing). */
  output: string;
}

/** A node returned by `listDir`. */
export interface FfmpegFSNode {
  name: string;
  isDir: boolean;
}

export type FfmpegEvent = 'log' | 'progress';
type LogCallback = (e: FfmpegLogLine) => void;
type ProgressCallback = (e: FfmpegProgressEvent) => void;

/* -------------------------------------------------------------------------- */
/* FfmpegClient - worker-RPC client replacing @ffmpeg/ffmpeg                   */
/* -------------------------------------------------------------------------- */

interface PendingCall {
  resolve: (value: unknown) => void;
  reject: (err: Error) => void;
}

/**
 * Thin RPC client over `workers/ffmpeg.worker.ts`. Mirrors the subset of
 * the `@ffmpeg/ffmpeg` `FFmpeg` class API that the tools use, so callers
 * are unaffected by the swap.
 */
export class FfmpegClient {
  private worker: Worker | null = null;
  private seq = 0;
  private readonly pending = new Map<number, PendingCall>();
  private readonly logListeners = new Set<LogCallback>();
  private readonly progressListeners = new Set<ProgressCallback>();

  private ensureWorker(): Worker {
    if (!this.worker) {
      this.worker = new Worker(
        new URL('../workers/ffmpeg.worker.ts', import.meta.url),
        { type: 'module' },
      );
      this.worker.onmessage = (e: MessageEvent) => this.onMessage(e);
    }
    return this.worker;
  }

  private send<T>(cmd: string, data?: unknown): Promise<T> {
    const worker = this.ensureWorker();
    const id = ++this.seq;
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject,
      });
      worker.postMessage({ id, cmd, data });
    });
  }

  private onMessage(e: MessageEvent): void {
    const msg = e.data as
      | { event: FfmpegEvent; data: FfmpegLogLine & FfmpegProgressEvent }
      | { id: number; ok: boolean; data?: unknown; error?: string };
    if ('event' in msg) {
      if (msg.event === 'log') {
        for (const cb of this.logListeners) cb(msg.data);
      } else if (msg.event === 'progress') {
        for (const cb of this.progressListeners) cb(msg.data);
      }
      return;
    }
    const p = this.pending.get(msg.id);
    if (!p) return;
    this.pending.delete(msg.id);
    if (msg.ok) p.resolve(msg.data);
    else p.reject(new Error(msg.error ?? 'ffmpeg worker error'));
  }

  /* ------------------------------ commands ------------------------------ */

  /** Load the WASM core. `true` on first load, `false` if already loaded. */
  load(config: { coreURL: string; wasmURL?: string }): Promise<boolean> {
    return this.send<boolean>('load', config);
  }

  /** Run ffmpeg with the given argv; resolves to the exit code. */
  exec(args: string[], timeout = -1): Promise<number> {
    return this.send<number>('exec', { args, timeout });
  }

  /** Run ffprobe with the given argv; resolves to the exit code. */
  ffprobe(args: string[], timeout = -1): Promise<number> {
    return this.send<number>('ffprobe', { args, timeout });
  }

  /** Write a file into the ffmpeg virtual FS. */
  writeFile(path: string, data: Uint8Array | string): Promise<boolean> {
    return this.send<boolean>('writeFile', { path, data });
  }

  /** Read a file from the ffmpeg virtual FS. */
  readFile(path: string, encoding?: string): Promise<Uint8Array | string> {
    return this.send<Uint8Array | string>('readFile', { path, encoding });
  }

  /** Delete a file from the ffmpeg virtual FS. */
  deleteFile(path: string): Promise<boolean> {
    return this.send<boolean>('deleteFile', { path });
  }

  /** Rename a file in the ffmpeg virtual FS. */
  rename(oldPath: string, newPath: string): Promise<boolean> {
    return this.send<boolean>('rename', { oldPath, newPath });
  }

  /** Create a directory in the ffmpeg virtual FS. */
  createDir(path: string): Promise<boolean> {
    return this.send<boolean>('createDir', { path });
  }

  /** List a directory in the ffmpeg virtual FS. */
  listDir(path: string): Promise<FfmpegFSNode[]> {
    return this.send<FfmpegFSNode[]>('listDir', { path });
  }

  /** Remove a directory from the ffmpeg virtual FS. */
  deleteDir(path: string): Promise<boolean> {
    return this.send<boolean>('deleteDir', { path });
  }

  /* ------------------------------ events -------------------------------- */

  on(event: 'log', cb: LogCallback): void;
  on(event: 'progress', cb: ProgressCallback): void;
  on(event: FfmpegEvent, cb: LogCallback | ProgressCallback): void {
    if (event === 'log') this.logListeners.add(cb as LogCallback);
    else this.progressListeners.add(cb as ProgressCallback);
  }

  off(event: 'log', cb: LogCallback): void;
  off(event: 'progress', cb: ProgressCallback): void;
  off(event: FfmpegEvent, cb: LogCallback | ProgressCallback): void {
    if (event === 'log') this.logListeners.delete(cb as LogCallback);
    else this.progressListeners.delete(cb as ProgressCallback);
  }

  /** Kill the worker and reject all pending calls. */
  terminate(): void {
    this.worker?.terminate();
    this.worker = null;
    for (const p of this.pending.values()) {
      p.reject(new Error('ffmpeg worker terminated'));
    }
    this.pending.clear();
  }
}

let ffmpegInstance: FfmpegClient | null = null;
let loadPromise: Promise<FfmpegClient> | null = null;

/** `true` once the WASM core has been loaded this session. */
export function isFfmpegLoaded(): boolean {
  return ffmpegInstance !== null;
}

/**
 * Lazily load the `@ffmpeg/core` WASM and return the shared `FfmpegClient`.
 * Concurrent callers share the same load promise; a failed load resets the
 * promise so the next call retries.
 */
export function getFFmpeg(): Promise<FfmpegClient> {
  if (ffmpegInstance) return Promise.resolve(ffmpegInstance);
  if (!loadPromise) {
    loadPromise = (async () => {
      const [coreMod, wasmMod] = await Promise.all([
        import('@ffmpeg/core?url'),
        import('@ffmpeg/core/wasm?url'),
      ]);
      const ffmpeg = new FfmpegClient();
      await ffmpeg.load({
        coreURL: coreMod.default as string,
        wasmURL: wasmMod.default as string,
      });
      ffmpegInstance = ffmpeg;
      return ffmpeg;
    })();
    // Allow retry after a failed load.
    loadPromise.catch(() => {
      loadPromise = null;
    });
  }
  return loadPromise;
}

/**
 * Run `ffmpeg.exec(args)` while capturing log lines and forwarding progress
 * events as a clamped 0-1 ratio. Listeners are detached afterwards so
 * repeated runs don't accumulate handlers.
 */
export async function runFfmpeg(
  ffmpeg: FfmpegClient,
  args: string[],
  opts: { onProgress?: (ratio: number) => void } = {},
): Promise<FfmpegRunResult> {
  const logs: FfmpegLogLine[] = [];
  const onLog = ({ type, message }: FfmpegLogLine): void => {
    logs.push({ type, message });
  };
  const onProgress = ({ progress }: FfmpegProgressEvent): void => {
    if (opts.onProgress && Number.isFinite(progress)) {
      opts.onProgress(Math.min(1, Math.max(0, progress)));
    }
  };
  ffmpeg.on('log', onLog);
  ffmpeg.on('progress', onProgress);
  try {
    const exitCode = await ffmpeg.exec(args);
    return { exitCode, logs, output: logs.map((l) => l.message).join('\n') };
  } finally {
    ffmpeg.off('log', onLog);
    ffmpeg.off('progress', onProgress);
  }
}

/**
 * Run `ffprobe` and return the parsed JSON output. ffprobe in ffmpeg.wasm
 * writes its result to a file via `-o`; this helper handles the plumbing.
 * Returns `null` when probing fails (corrupt/unsupported file).
 */
export async function probeJson<T = unknown>(
  ffmpeg: FfmpegClient,
  inputName: string,
  extraArgs: string[] = [],
): Promise<T | null> {
  const outName = 'probe-output.json';
  const logs: FfmpegLogLine[] = [];
  const onLog = ({ type, message }: FfmpegLogLine): void => {
    logs.push({ type, message });
  };
  ffmpeg.on('log', onLog);
  try {
    const code = await ffmpeg.ffprobe([
      '-v', 'error',
      '-of', 'json',
      ...extraArgs,
      inputName,
      '-o', outName,
    ]);
    if (code !== 0) return null;
    const data = await ffmpeg.readFile(outName, 'utf8');
    const text = typeof data === 'string' ? data : new TextDecoder().decode(data);
    return JSON.parse(text) as T;
  } catch {
    return null;
  } finally {
    ffmpeg.off('log', onLog);
    try {
      await ffmpeg.deleteFile(outName);
    } catch {
      /* ignore */
    }
  }
}

/** Read a Blob/File into a Uint8Array suitable for `ffmpeg.writeFile`. */
export async function blobToBytes(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.arrayBuffer());
}

/**
 * Read an output file from the ffmpeg FS and delete it. Returns `null` when
 * the file does not exist (failed run). Always returns a fresh Uint8Array
 * backed by a regular ArrayBuffer so it can be used as a BlobPart.
 */
export async function readOutput(
  ffmpeg: FfmpegClient,
  name: string,
): Promise<Uint8Array<ArrayBuffer> | null> {
  try {
    const data = await ffmpeg.readFile(name);
    const bytes =
      typeof data === 'string' ? new TextEncoder().encode(data) : data;
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    return copy;
  } catch {
    return null;
  } finally {
    try {
      await ffmpeg.deleteFile(name);
    } catch {
      /* ignore */
    }
  }
}

/** Best-effort removal of a file from the ffmpeg FS. */
export async function deleteQuiet(
  ffmpeg: FfmpegClient,
  name: string,
): Promise<void> {
  try {
    await ffmpeg.deleteFile(name);
  } catch {
    /* ignore */
  }
}
