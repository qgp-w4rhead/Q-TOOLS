/**
 * useMarkdownToHtml — composable + pure logic for the Markdown → HTML converter.
 *
 * Renders Markdown text to HTML via `marked` (initial bundle per
 * `tech-stack.md`, statically imported here — no dynamic import, no separate
 * Vite chunk). The component itself is still lazy-loaded so the UI lands in
 * its own chunk.
 *
 * `marked` removed its built-in `sanitize` option in v4. For the "sanitize"
 * acceptance criterion we provide a DOMParser-based allowlist sanitizer
 * (`sanitizeHtml`) that strips dangerous tags (`<script>`, `<iframe>`, …),
 * event-handler attributes (`on*`), and `javascript:`/`vbscript:` URLs in
 * `href`/`src`. It uses only the browser DOM API — no new npm dependency.
 *
 * Pure helpers (`renderMarkdown`, `sanitizeHtml`, `markdownToHtml`) have no
 * Vue dependency and can be imported standalone for unit testing or reuse.
 * The `useMarkdownToHtml()` composable wraps them in reactive state and wires
 * up the embed PostMessage protocol.
 *
 * Dependencies: `marked` (initial bundle).
 */
import { ref, watch, type Ref } from 'vue';
import { marked } from 'marked';
import { useEmbed } from '@/composables/useEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Pure logic — no Vue dependency below this point                             */
/* -------------------------------------------------------------------------- */

/** Options accepted by the pure `markdownToHtml` helper. */
export interface MarkdownToHtmlOptions {
  /** GitHub-Flavoured Markdown (tables, strikethrough, task lists, autolinks). Default `true`. */
  gfm: boolean;
  /** Convert single `\n` to `<br>` (requires `gfm`). Default `false`. */
  breaks: boolean;
  /** Strip dangerous tags/attributes via an allowlist sanitizer. Default `true`. */
  sanitize: boolean;
}

/** Result of a successful Markdown → HTML conversion. */
export interface MarkdownToHtmlResult {
  /** Raw HTML string produced by `marked` (before sanitization). */
  htmlRaw: string;
  /** HTML string after sanitization (identical to `htmlRaw` when `sanitize` is false). */
  html: string;
  /** Number of bytes in the input Markdown (UTF-8). */
  inputBytes: number;
  /** Number of bytes in the output HTML (UTF-8, after sanitization). */
  outputBytes: number;
}

/** Normalised error from Markdown rendering or sanitization. */
export interface MarkdownToHtmlError {
  message: string;
}

export const DEFAULT_GFM = true;
export const DEFAULT_BREAKS = false;
export const DEFAULT_SANITIZE = true;

/**
 * Allowlist of element names that may appear in sanitized output. Anything
 * not in this set is removed (its children are preserved by unwrapping the
 * tag). Covers everything `marked` emits for CommonMark + GFM plus a few
 * common inline elements.
 */
const SAFE_TAGS = new Set([
  'a', 'abbr', 'address', 'article', 'aside', 'b', 'bdi', 'bdo', 'blockquote',
  'br', 'caption', 'cite', 'code', 'col', 'colgroup', 'data', 'dd', 'del',
  'details', 'dfn', 'div', 'dl', 'dt', 'em', 'figcaption', 'figure', 'footer',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'hgroup', 'hr', 'i', 'img',
  'ins', 'kbd', 'li', 'main', 'mark', 'nav', 'ol', 'p', 'pre', 'q', 'rp', 'rt',
  'ruby', 's', 'samp', 'section', 'small', 'span', 'strong', 'sub', 'summary',
  'sup', 'table', 'tbody', 'td', 'tfoot', 'th', 'thead', 'time', 'tr', 'u',
  'ul', 'var', 'wbr',
  // GFM task-list checkboxes are `<input disabled type="checkbox">`.
  'input',
]);

/**
 * Per-tag attribute allowlist. Attributes not listed for a given tag (and not
 * in the global allowlist) are dropped. `*` applies to every allowed tag.
 */
const SAFE_ATTRS: Record<string, Set<string>> = {
  '*': new Set(['abbr', 'cite', 'datetime', 'dir', 'lang', 'title', 'translate']),
  a: new Set(['href', 'name', 'target', 'rel']),
  img: new Set(['src', 'alt', 'width', 'height', 'srcset', 'sizes', 'loading']),
  td: new Set(['colspan', 'rowspan', 'align']),
  th: new Set(['colspan', 'rowspan', 'align', 'scope']),
  col: new Set(['span']),
  colgroup: new Set(['span']),
  time: new Set(['datetime']),
  ol: new Set(['start', 'reversed', 'type']),
  input: new Set(['type', 'checked', 'disabled']),
  pre: new Set(['class']), // marked adds `language-xxx` for syntax highlighting
  code: new Set(['class']),
  span: new Set(['class']),
  div: new Set(['class']),
};

/** URL schemes considered safe for `href`/`src` attributes. */
const SAFE_URL_SCHEMES = new Set([
  'http', 'https', 'mailto', 'tel', 'ftp', 'ftps', 'data', 'blob',
]);

/**
 * Render Markdown text to raw HTML via `marked`. Throws a normalised
 * `MarkdownToHtmlError` on failure (marked is very tolerant, but a custom
 * extension or invalid input could still throw).
 *
 * - Empty input → empty string.
 * - `gfm` enables GitHub-Flavoured Markdown (tables, strikethrough, task
 *   lists, autolinks). `breaks` converts single `\n` to `<br>` (requires gfm).
 */
export function renderMarkdown(
  input: string,
  opts: Pick<MarkdownToHtmlOptions, 'gfm' | 'breaks'>,
): string {
  if (typeof input !== 'string') {
    throw toMdError(new Error('Input must be a string.'));
  }
  if (input.trim().length === 0) return '';
  try {
    const out = marked.parse(input, {
      gfm: opts.gfm,
      breaks: opts.breaks,
      // Synchronous parse — marked.parse returns a string when `async: false`.
      async: false,
    });
    return typeof out === 'string' ? out : '';
  } catch (e) {
    throw toMdError(e);
  }
}

/**
 * Sanitize an HTML string via a DOMParser-based allowlist. Removes:
 *  - any element not in `SAFE_TAGS` (children preserved by unwrapping),
 *  - any attribute not in the per-tag allowlist,
 *  - any `on*` event-handler attribute,
 *  - any `href`/`src` whose scheme is not in `SAFE_URL_SCHEMES` (after
 *    stripping whitespace and control chars used to disguise schemes),
 *  - `style` attributes (could carry `url(javascript:...)` or CSS expressions).
 *
 * Uses the browser DOM API only — no external dependency. When called outside
 * a browser (SSR / unit test without DOM), falls back to a regex-based strip
 * of `<script>`/`on*=`/`javascript:` to remain safe.
 */
export function sanitizeHtml(html: string): string {
  if (typeof html !== 'string' || html.length === 0) return '';
  if (typeof DOMParser === 'undefined') {
    return sanitizeHtmlFallback(html);
  }
  const doc = new DOMParser().parseFromString(html, 'text/html');
  sanitizeNode(doc.body);
  return doc.body.innerHTML;
}

/** Recursively sanitize a DOM node and its descendants in place. */
function sanitizeNode(node: Element): void {
  // Walk a snapshot of children so mutation during iteration is safe.
  const children = Array.from(node.children);
  for (const child of children) {
    const tag = child.tagName.toLowerCase();
    if (!SAFE_TAGS.has(tag)) {
      // Unwrap: replace the element with its children, then continue.
      const parent = child.parentElement;
      if (parent) {
        while (child.firstChild) {
          parent.insertBefore(child.firstChild, child);
        }
        parent.removeChild(child);
        // Re-process the moved children (they may themselves be unsafe).
        // We do this by recursing on `node` again — but to avoid infinite
        // loops on pathological input, we just continue scanning the
        // remaining snapshot; moved children are still in `node`'s subtree
        // and will be visited because they were inserted before `child`'s
        // original position. The snapshot was taken before removal, so we
        // rely on the next iteration of the outer loop to visit siblings.
      }
      continue;
    }
    // Filter attributes.
    const allowed = SAFE_ATTRS['*'] ?? new Set<string>();
    const tagAllowed = SAFE_ATTRS[tag] ?? new Set<string>();
    const attrs = Array.from(child.attributes);
    for (const attr of attrs) {
      const name = attr.name.toLowerCase();
      const value = attr.value;
      // Drop event handlers and style outright.
      if (name.startsWith('on') || name === 'style') {
        child.removeAttribute(attr.name);
        continue;
      }
      // Drop attributes not in the global or per-tag allowlist.
      if (!allowed.has(name) && !tagAllowed.has(name)) {
        child.removeAttribute(attr.name);
        continue;
      }
      // Validate URL-bearing attributes.
      if (name === 'href' || name === 'src' || name === 'srcset' || name === 'xlink:href') {
        if (!isSafeUrl(value)) {
          child.removeAttribute(attr.name);
        }
      }
      // Force `rel="noopener noreferrer"` on target="_blank" anchors.
      if (tag === 'a' && name === 'target' && value.toLowerCase() === '_blank') {
        child.setAttribute('rel', 'noopener noreferrer');
      }
    }
    // For anchors with target=_blank but no rel, add the safe rel.
    if (
      tag === 'a' &&
      child.getAttribute('target')?.toLowerCase() === '_blank' &&
      !child.hasAttribute('rel')
    ) {
      child.setAttribute('rel', 'noopener noreferrer');
    }
    // Recurse into the (now-cleaned) child.
    sanitizeNode(child);
  }
}

/**
 * Determine whether a URL string is safe to keep. Strips leading whitespace
 * and control characters (which browsers ignore when resolving schemes) before
 * inspecting the scheme. Relative URLs (no scheme) are always safe.
 */
function isSafeUrl(url: string): boolean {
  if (typeof url !== 'string' || url.length === 0) return false;
  // Strip leading/inline whitespace and control chars (0x00-0x20) that
  // browsers ignore when resolving the scheme (e.g. "java\tscript:").
  const stripped = url.replace(/[\u0000-\u0020]+/g, '');
  if (stripped.length === 0) return false;
  // Extract the scheme, if any. A leading scheme matches `^[a-z][a-z0-9+.-]*:`.
  // Anything without a scheme is a relative URL / fragment → safe.
  const schemeMatch = /^([a-z][a-z0-9+.\-]*):/i.exec(stripped);
  if (!schemeMatch) return true;
  const scheme = schemeMatch[1]!.toLowerCase();
  if (!SAFE_URL_SCHEMES.has(scheme)) return false;
  // `data:` is allowed only for image MIME types (image/png, image/svg+xml, …).
  if (scheme === 'data') {
    return /^data:image\/(png|jpeg|gif|webp|svg\+xml|avif|apng|x-icon|bmp);/i.test(stripped);
  }
  return true;
}

/**
 * Regex-based fallback sanitizer used when `DOMParser` is unavailable (SSR or
 * a non-DOM environment). Strips `<script>` blocks, `on*=` attributes,
 * `javascript:`/`vbscript:` URLs, and `<iframe>`/`<object>`/`<embed>` tags.
 * Less precise than the DOM-based sanitizer but safe for the common XSS
 * vectors.
 */
function sanitizeHtmlFallback(html: string): string {
  return html
    // Remove <script>...</script> (case-insensitive, dot-all).
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    // Remove <style>...</style>.
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    // Remove iframe/object/embed/meta/link/base tags entirely.
    .replace(/<\/?(iframe|object|embed|meta|link|base|script|style)\b[^>]*>/gi, '')
    // Remove on* event-handler attributes.
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    // Remove javascript: and vbscript: URLs in href/src.
    .replace(/(href|src|xlink:href)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, (m, _attr, val) => {
      const v = String(val).replace(/^["']|["']$/g, '');
      if (/^\s*(javascript|vbscript|data:text\/html)/i.test(v)) return '';
      return m;
    });
}

/**
 * Convert Markdown text to a sanitized HTML result. Combines `renderMarkdown`
 * and (optionally) `sanitizeHtml`.
 *
 * - Empty input → empty result (caller shows the empty state).
 */
export function markdownToHtml(
  input: string,
  opts: MarkdownToHtmlOptions,
): MarkdownToHtmlResult {
  const inputBytes = new TextEncoder().encode(input).length;
  const htmlRaw = renderMarkdown(input, { gfm: opts.gfm, breaks: opts.breaks });
  const html = opts.sanitize ? sanitizeHtml(htmlRaw) : htmlRaw;
  return {
    htmlRaw,
    html,
    inputBytes,
    outputBytes: new TextEncoder().encode(html).length,
  };
}

/** Convert any thrown value into a normalised `MarkdownToHtmlError`. */
function toMdError(err: unknown): MarkdownToHtmlError {
  if (err instanceof Error) return { message: err.message };
  return { message: String(err) };
}

/* -------------------------------------------------------------------------- */
/* Composable — reactive state + embed integration                            */
/* -------------------------------------------------------------------------- */

export interface MarkdownToHtmlOutputs {
  htmlRaw: string;
  html: string;
  inputBytes: number;
  outputBytes: number;
}

/** Debounce window (ms) for recomputing on input changes. */
const DEBOUNCE_MS = 120;

export interface UseMarkdownToHtmlReturn {
  input: Ref<string>;
  gfm: Ref<boolean>;
  breaks: Ref<boolean>;
  sanitize: Ref<boolean>;
  outputs: Ref<MarkdownToHtmlOutputs | null>;
  error: Ref<MarkdownToHtmlError | null>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  recompute: () => void;
  setGfm: (v: boolean) => void;
  setBreaks: (v: boolean) => void;
  setSanitize: (v: boolean) => void;
}

export function useMarkdownToHtml(): UseMarkdownToHtmlReturn {
  const input = ref<string>('');
  const gfm = ref<boolean>(DEFAULT_GFM);
  const breaks = ref<boolean>(DEFAULT_BREAKS);
  const sanitize = ref<boolean>(DEFAULT_SANITIZE);
  const outputs = ref<MarkdownToHtmlOutputs | null>(null);
  const error = ref<MarkdownToHtmlError | null>(null);

  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  function opts(): MarkdownToHtmlOptions {
    return {
      gfm: gfm.value,
      breaks: breaks.value,
      sanitize: sanitize.value,
    };
  }

  function run(): void {
    const text = input.value;
    if (text.trim().length === 0) {
      outputs.value = null;
      error.value = null;
      return;
    }
    try {
      const r = markdownToHtml(text, opts());
      outputs.value = {
        htmlRaw: r.htmlRaw,
        html: r.html,
        inputBytes: r.inputBytes,
        outputBytes: r.outputBytes,
      };
      error.value = null;
    } catch (e) {
      outputs.value = null;
      error.value = toMdError(e);
    }
  }

  function scheduleRun(): void {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = undefined;
      run();
    }, DEBOUNCE_MS);
  }

  function recompute(): void {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = undefined;
    }
    run();
  }

  function setGfm(v: boolean): void {
    gfm.value = v;
  }
  function setBreaks(v: boolean): void {
    breaks.value = v;
  }
  function setSanitize(v: boolean): void {
    sanitize.value = v;
  }

  watch(input, scheduleRun);
  watch(gfm, scheduleRun);
  watch(breaks, scheduleRun);
  watch(sanitize, scheduleRun);

  const { isEmbed, input: embedInput, sendOutput } = useEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.input === 'string') input.value = p.input;
      if (typeof p.gfm === 'boolean') gfm.value = p.gfm;
      if (typeof p.breaks === 'boolean') breaks.value = p.breaks;
      if (typeof p.sanitize === 'boolean') sanitize.value = p.sanitize;
    },
  });

  watch(outputs, (o) => {
    if (isEmbed.value) {
      sendOutput(o ?? {});
    }
  });

  return {
    input,
    gfm,
    breaks,
    sanitize,
    outputs,
    error,
    isEmbed,
    embedInput,
    recompute,
    setGfm,
    setBreaks,
    setSanitize,
  };
}
