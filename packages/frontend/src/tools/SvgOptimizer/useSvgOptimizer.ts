/**
 * useSvgOptimizer - composable + pure logic for the SVG optimizer tool.
 *
 * Minifies/optimizes pasted or uploaded SVG markup via a hand-rolled
 * optimizer (no external dependencies - SVGO is not bundled). Stages:
 *   - Strip XML declaration, DOCTYPE, comments, processing instructions.
 *   - Remove editor metadata (`<metadata>`, inkscape/sodipodi elements +
 *     attributes, `data-name`, `id` on the root, `version`, `xml:space`).
 *   - Optionally remove `<title>`/`<desc>` (accessibility content).
 *   - Optionally remove `width`/`height` on the root (keeps `viewBox`).
 *   - Collapse inter-tag whitespace and trim attribute whitespace.
 *   - Optionally pretty-print the result (2-space indent).
 *
 * Pure helpers (`optimizeSvg`, `savingsPercent`, `byteSize`) have no Vue
 * dependency and can be imported standalone.
 */
import { ref, watch, type Ref } from 'vue';
import { useEmbed } from '@/composables/useEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Types + constants                                                           */
/* -------------------------------------------------------------------------- */

export interface OptimizeOptions {
  /** Remove `<metadata>`, inkscape/sodipodi elements + attrs, `data-name`. */
  removeMetadata: boolean;
  /** Remove `<title>` and `<desc>` (accessibility content). */
  removeTitleDesc: boolean;
  /** Remove `width`/`height` on the root `<svg>` (keeps `viewBox`). */
  removeDimensions: boolean;
  /** Pretty-print the output (2-space indent) instead of single-line. */
  pretty: boolean;
}

export const DEFAULT_OPTIONS: OptimizeOptions = {
  removeMetadata: true,
  removeTitleDesc: false,
  removeDimensions: false,
  pretty: false,
};

/* -------------------------------------------------------------------------- */
/* Pure logic                                                                  */
/* -------------------------------------------------------------------------- */

/** Byte size of a UTF-8 string. */
export function byteSize(text: string): number {
  return new TextEncoder().encode(text).length;
}

/** Percentage saved (0-100) from input to output byte size. */
export function savingsPercent(inputBytes: number, outputBytes: number): number {
  if (!Number.isFinite(inputBytes) || inputBytes <= 0) return 0;
  return Math.max(0, (1 - outputBytes / inputBytes) * 100);
}

/** `true` when the input looks like SVG markup. */
export function looksLikeSvg(input: string): boolean {
  return /<svg[\s>]/i.test(input);
}

/** Editor-namespace prefixes whose elements/attributes are stripped. */
const EDITOR_PREFIXES = ['inkscape', 'sodipodi', 'adobe', 'sketch', 'figma'];

/**
 * Optimize an SVG string. Returns the minified (or pretty-printed) markup.
 * Throws when the input does not contain an `<svg>` element.
 */
export function optimizeSvg(input: string, opts: OptimizeOptions = DEFAULT_OPTIONS): string {
  let s = input;
  if (!looksLikeSvg(s)) {
    throw new Error('Input does not contain an <svg> element.');
  }

  // Strip XML declaration, DOCTYPE, comments, processing instructions.
  s = s.replace(/<\?xml[^?]*\?>/gi, '');
  s = s.replace(/<!DOCTYPE[^>]*(\[[\s\S]*?\])?\s*>/gi, '');
  s = s.replace(/<!--[\s\S]*?-->/g, '');
  s = s.replace(/<\?[\s\S]*?\?>/g, '');

  if (opts.removeMetadata) {
    // Remove <metadata>…</metadata> blocks.
    s = s.replace(/<metadata[\s\S]*?<\/metadata>/gi, '');
    // Remove editor-namespaced elements (e.g. <sodipodi:namedview …/>).
    for (const p of EDITOR_PREFIXES) {
      const re = new RegExp(`<${p}:[\\w-]+[\\s\\S]*?(?:\\/>|<\\/${p}:[\\w-]+>)`, 'gi');
      s = s.replace(re, '');
    }
  }
  if (opts.removeTitleDesc) {
    s = s.replace(/<title[\s\S]*?<\/title>/gi, '');
    s = s.replace(/<desc[\s\S]*?<\/desc>/gi, '');
  }

  // Remove editor-namespaced + editor attributes.
  if (opts.removeMetadata) {
    for (const p of EDITOR_PREFIXES) {
      const re = new RegExp(`\\s${p}:[\\w-]+="[^"]*"`, 'gi');
      s = s.replace(re, '');
      const reSq = new RegExp(`\\s${p}:[\\w-]+='[^']*'`, 'gi');
      s = s.replace(reSq, '');
    }
    // xmlns declarations for editor namespaces.
    for (const p of EDITOR_PREFIXES) {
      const re = new RegExp(`\\sxmlns:${p}="[^"]*"`, 'gi');
      s = s.replace(re, '');
    }
    s = s.replace(/\sdata-name="[^"]*"/gi, '');
    s = s.replace(/\sxml:space="[^"]*"/gi, '');
  }

  if (opts.removeDimensions) {
    // Remove width/height only on the root <svg> tag.
    s = s.replace(/<svg\b([^>]*?)\s(?:width|height)="[^"]*"/gi, '<svg$1');
  }

  // Collapse whitespace between tags and trim attribute whitespace.
  s = s.replace(/>\s+</g, '><');
  s = s.replace(/\s{2,}/g, ' ');
  s = s.replace(/\s+(\/?>)/g, '$1');
  s = s.trim();

  if (opts.pretty) {
    s = prettyPrint(s);
  }
  return s;
}

/** Indent a single-line SVG string (2 spaces per depth). */
function prettyPrint(svg: string): string {
  const tokens = svg.replace(/></g, '>\n<').split('\n');
  let depth = 0;
  const out: string[] = [];
  for (const raw of tokens) {
    const t = raw.trim();
    if (!t) continue;
    const isClose = /^<\//.test(t);
    const isSelfClose = /\/>$/.test(t) || /^<(?!\/)[^>]*\/>$/.test(t);
    const isOpen = /^<(?!\/|!|\?)/.test(t) && !isSelfClose;
    if (isClose) depth = Math.max(0, depth - 1);
    out.push('  '.repeat(depth) + t);
    if (isOpen) depth += 1;
  }
  return out.join('\n');
}

/* -------------------------------------------------------------------------- */
/* Composable                                                                  */
/* -------------------------------------------------------------------------- */

export interface UseSvgOptimizerReturn {
  input: Ref<string>;
  output: Ref<string>;
  options: Ref<OptimizeOptions>;
  inputBytes: Ref<number>;
  outputBytes: Ref<number>;
  error: Ref<string | null>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  optimize: () => void;
  setInput: (text: string) => void;
  loadFile: (file: File) => Promise<void>;
  download: () => void;
  reset: () => void;
}

export function useSvgOptimizer(): UseSvgOptimizerReturn {
  const input = ref<string>('');
  const output = ref<string>('');
  const options = ref<OptimizeOptions>({ ...DEFAULT_OPTIONS });
  const inputBytes = ref<number>(0);
  const outputBytes = ref<number>(0);
  const error = ref<string | null>(null);

  function optimize(): void {
    error.value = null;
    output.value = '';
    outputBytes.value = 0;
    const src = input.value.trim();
    if (!src) {
      error.value = 'Paste SVG markup or drop a .svg file first.';
      return;
    }
    try {
      const result = optimizeSvg(src, options.value);
      output.value = result;
      inputBytes.value = byteSize(src);
      outputBytes.value = byteSize(result);
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Optimization failed.';
    }
  }

  function setInput(text: string): void {
    input.value = text;
  }

  async function loadFile(file: File): Promise<void> {
    error.value = null;
    try {
      const text = await file.text();
      input.value = text;
      optimize();
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to read the file.';
    }
  }

  function download(): void {
    if (!output.value) return;
    const blob = new Blob([output.value], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'optimized.svg';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  function reset(): void {
    input.value = '';
    output.value = '';
    inputBytes.value = 0;
    outputBytes.value = 0;
    error.value = null;
  }

  /* ----------------------------- embed I/O ------------------------------ */

  const { isEmbed, input: embedInput, sendOutput } = useEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.input === 'string' || typeof p.svg === 'string') {
        input.value = (p.input ?? p.svg) as string;
      }
      if (p.options && typeof p.options === 'object') {
        options.value = { ...options.value, ...(p.options as Partial<OptimizeOptions>) };
      }
      if (p.action === 'optimize') optimize();
      if (p.action === 'reset') reset();
    },
  });

  watch([input, output, options, error], () => {
    if (!isEmbed.value) return;
    sendOutput({
      inputBytes: inputBytes.value,
      outputBytes: outputBytes.value,
      savingsPercent: savingsPercent(inputBytes.value, outputBytes.value),
      output: output.value || undefined,
      error: error.value ?? undefined,
    });
  }, { deep: true });

  return {
    input,
    output,
    options,
    inputBytes,
    outputBytes,
    error,
    isEmbed,
    embedInput,
    optimize,
    setInput,
    loadFile,
    download,
    reset,
  };
}
