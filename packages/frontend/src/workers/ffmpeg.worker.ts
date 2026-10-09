/**
 * ffmpeg.wasm worker - runs `@ffmpeg/core` off the main thread.
 *
 * This is our own minimal replacement for the `@ffmpeg/ffmpeg` package's
 * worker + client wrapper: it loads the single-threaded ffmpeg core
 * (Emscripten module) and executes commands, streaming log/progress
 * events back to the main thread. Keeping it in-repo removes two runtime
 * dependencies (`@ffmpeg/ffmpeg`, `@ffmpeg/util`) while using the same
 * core API surface (`exec`, `ffprobe`, `FS`, `setLogger`, `setProgress`).
 *
 * Protocol (client → worker): `{ id, cmd, data }`
 *   - `load`       { coreURL, wasmURL }        → boolean (first load)
 *   - `exec`       { args, timeout? }          → exit code
 *   - `ffprobe`    { args, timeout? }          → exit code
 *   - `writeFile`  { path, data }              → true
 *   - `readFile`   { path, encoding? }         → Uint8Array | string
 *   - `deleteFile` { path }                    → true
 *   - `rename`     { oldPath, newPath }        → true
 *   - `createDir`  { path }                    → true
 *   - `listDir`    { path }                    → { name, isDir }[]
 *   - `deleteDir`  { path }                    → true
 *
 * Protocol (worker → client):
 *   - response: `{ id, ok: true, data }` or `{ id, ok: false, error }`
 *   - events:   `{ event: 'log', data }` / `{ event: 'progress', data }`
 */

/* -------------------------------------------------------------------------- */
/* Core module typings (subset of the Emscripten surface we use)              */
/* -------------------------------------------------------------------------- */

interface CoreLogData {
  type: string;
  message: string;
}

interface CoreProgressData {
  progress: number;
  time: number;
}

interface CoreFS {
  writeFile(path: string, data: Uint8Array | string): void;
  readFile(path: string, opts?: { encoding?: string }): Uint8Array | string;
  unlink(path: string): void;
  rename(oldPath: string, newPath: string): void;
  mkdir(path: string): void;
  readdir(path: string): string[];
  stat(path: string): { mode: number };
  isDir(mode: number): boolean;
  rmdir(path: string): void;
}

interface CoreModule {
  /** Exit code of the last exec/ffprobe run. */
  ret: number;
  FS: CoreFS;
  exec(...args: string[]): void;
  ffprobe(...args: string[]): void;
  /** Reset internal state after a run. */
  reset(): void;
  /** Per-run timeout in ms; `-1` disables. */
  setTimeout(timeout: number): void;
  setLogger(cb: (data: CoreLogData) => void): void;
  setProgress(cb: (data: CoreProgressData) => void): void;
}

type CoreFactory = (config: {
  mainScriptUrlOrBlob: string;
}) => Promise<CoreModule> | CoreModule;

/* -------------------------------------------------------------------------- */
/* Message shapes                                                              */
/* -------------------------------------------------------------------------- */

interface WorkerRequest {
  id: number;
  cmd: string;
  data?: unknown;
}

/** The worker global scope. Declared locally so this file doesn't depend on
 * the `webworker` TS lib (which conflicts with `dom` in this project). */
declare const self: {
  onmessage: ((ev: { data: WorkerRequest }) => void) | null;
  postMessage(message: unknown, transfer?: Transferable[]): void;
  createFFmpegCore?: CoreFactory;
};

/* -------------------------------------------------------------------------- */
/* Command handlers                                                            */
/* -------------------------------------------------------------------------- */

let core: CoreModule | null = null;

function requireCore(): CoreModule {
  if (!core) throw new Error('ffmpeg core not loaded');
  return core;
}

async function handle(cmd: string, data: unknown): Promise<unknown> {
  switch (cmd) {
    case 'load': {
      const { coreURL, wasmURL } = data as {
        coreURL: string;
        wasmURL?: string;
      };
      const first = core === null;
      // The ESM core build exports `createFFmpegCore` as its default. The
      // URL is a runtime asset (Vite `?url`) so the import is ignored by
      // the bundler and resolved by the browser inside the module worker.
      const mod = (await import(
        /* @vite-ignore */ coreURL
      )) as { default?: CoreFactory } & Partial<CoreFactory>;
      const factory: CoreFactory | undefined =
        mod.default ?? (mod as CoreFactory);
      if (typeof factory !== 'function') {
        throw new Error('ffmpeg core module has no usable export');
      }
      const wasm = wasmURL ?? coreURL.replace(/\.js$/g, '.wasm');
      const worker = coreURL.replace(/\.js$/g, '.worker.js');
      // The core decodes locateFile hints from the `#` hash of
      // `mainScriptUrlOrBlob` - this is how the wasm URL reaches it.
      core = await factory({
        mainScriptUrlOrBlob: `${coreURL}#${btoa(
          JSON.stringify({ wasmURL: wasm, workerURL: worker }),
        )}`,
      });
      const c = requireCore();
      c.setLogger((d) => self.postMessage({ event: 'log', data: d }));
      c.setProgress((d) => self.postMessage({ event: 'progress', data: d }));
      return first;
    }

    case 'exec':
    case 'ffprobe': {
      const c = requireCore();
      const { args, timeout = -1 } = data as {
        args: string[];
        timeout?: number;
      };
      c.setTimeout(timeout);
      if (cmd === 'exec') c.exec(...args);
      else c.ffprobe(...args);
      const ret = c.ret;
      c.reset();
      return ret;
    }

    case 'writeFile': {
      const c = requireCore();
      const { path, data: fileData } = data as {
        path: string;
        data: Uint8Array | string;
      };
      c.FS.writeFile(path, fileData);
      return true;
    }

    case 'readFile': {
      const c = requireCore();
      const { path, encoding } = data as {
        path: string;
        encoding?: string;
      };
      return c.FS.readFile(path, { encoding });
    }

    case 'deleteFile': {
      const c = requireCore();
      const { path } = data as { path: string };
      c.FS.unlink(path);
      return true;
    }

    case 'rename': {
      const c = requireCore();
      const { oldPath, newPath } = data as {
        oldPath: string;
        newPath: string;
      };
      c.FS.rename(oldPath, newPath);
      return true;
    }

    case 'createDir': {
      const c = requireCore();
      const { path } = data as { path: string };
      c.FS.mkdir(path);
      return true;
    }

    case 'listDir': {
      const c = requireCore();
      const { path } = data as { path: string };
      const nodes: { name: string; isDir: boolean }[] = [];
      for (const name of c.FS.readdir(path)) {
        const stat = c.FS.stat(`${path}/${name}`);
        nodes.push({ name, isDir: c.FS.isDir(stat.mode) });
      }
      return nodes;
    }

    case 'deleteDir': {
      const c = requireCore();
      const { path } = data as { path: string };
      c.FS.rmdir(path);
      return true;
    }

    default:
      throw new Error(`unknown ffmpeg worker command: ${cmd}`);
  }
}

self.onmessage = ({ data }): void => {
  const { id, cmd, data: payload } = data;
  void handle(cmd, payload)
    .then((result) => {
      // Transfer the buffer back zero-copy when the result is binary.
      const transfer: Transferable[] =
        result instanceof Uint8Array ? [result.buffer as ArrayBuffer] : [];
      self.postMessage({ id, ok: true, data: result }, transfer);
    })
    .catch((e: unknown) => {
      self.postMessage({
        id,
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      });
    });
};

export {};
