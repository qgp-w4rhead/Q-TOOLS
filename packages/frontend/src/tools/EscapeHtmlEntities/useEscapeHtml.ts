/**
 * useEscapeHtml - composable + pure logic for the HTML entity escape/unescape
 * tool.
 *
 * Bidirectional converter:
 *
 * - **escape** - replaces the five HTML-significant characters
 *   (`&` `<` `>` `"` `'`) with their entity references. Two modes:
 *   - **named** - `&amp;` `&lt;` `&gt;` `&quot;` `&#39;` (the apostrophe uses
 *     the numeric form `&#39;` because `&apos;` is not recognised in HTML4 and
 *     is unreliable in legacy contexts - `&#39;` works everywhere).
 *   - **numeric** - decimal numeric character references
 *     `&#38;` `&#60;` `&#62;` `&#34;` `&#39;`.
 * - **unescape** - decodes both named and numeric (decimal `&#NN;` and hex
 *   `&#xHH;`) character references back to their literal characters. A small
 *   built-in named-entity map covers the five HTML-significant entities plus
 *   the common ones (`&nbsp;` `&copy;` …). Unknown named entities are left
 *   untouched so the output is never silently corrupted.
 *
 * Pure helpers (`escapeHtml`, `unescapeHtml`) have no Vue dependency and can be
 * imported standalone for unit testing or reuse. The `useEscapeHtml()`
 * composable wraps them in reactive state and wires up the embed PostMessage
 * protocol.
 *
 * No external dependencies - the entity map and the regex decoder are
 * hand-rolled. We deliberately avoid the DOM `innerHTML` trick (assigning to
 * an element and reading `textContent`) because (a) it requires a DOM, (b) it
 * silently drops unknown entities, and (c) it is a known XSS sink when fed
 * untrusted input.
 */
import { ref, watch, type Ref } from 'vue';
import { useEmbed } from '@/composables/useEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Pure logic - no Vue dependency below this point                             */
/* -------------------------------------------------------------------------- */

/** Conversion direction. */
export type HtmlDirection = 'escape' | 'unescape';

/** Entity output style for the escape direction. */
export type HtmlEntityMode = 'named' | 'numeric';

/**
 * The five HTML-significant characters and their named entity counterparts.
 * The apostrophe uses the numeric form `&#39;` (see file header).
 */
const NAMED_ENTITIES: Readonly<Record<string, string>> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/**
 * Reverse map used by `unescapeHtml`. Includes the five HTML-significant
 * entities plus a handful of common ones that appear in user content. Unknown
 * named entities are left untouched rather than dropped.
 */
const NAMED_ENTITY_MAP: Readonly<Record<string, string>> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: '\u00a0',
  copy: '\u00a9',
  reg: '\u00ae',
  trade: '\u2122',
  hellip: '\u2026',
  mdash: '\u2014',
  ndash: '\u2013',
  lsquo: '\u2018',
  rsquo: '\u2019',
  ldquo: '\u201c',
  rdquo: '\u201d',
  laquo: '\u00ab',
  raquo: '\u00bb',
  deg: '\u00b0',
  plusmn: '\u00b1',
  times: '\u00d7',
  divide: '\u00f7',
  euro: '\u20ac',
  pound: '\u00a3',
  cent: '\u00a2',
  yen: '\u00a5',
  sect: '\u00a7',
  para: '\u00b6',
  middot: '\u00b7',
  bull: '\u2022',
  dagger: '\u2020',
  Dagger: '\u2021',
  permil: '\u2030',
  prime: '\u2032',
  Prime: '\u2033',
  infin: '\u221e',
  ne: '\u2260',
  le: '\u2264',
  ge: '\u2265',
  sum: '\u2211',
  prod: '\u220f',
  radic: '\u221a',
  micro: '\u00b5',
  alpha: '\u03b1',
  beta: '\u03b2',
  gamma: '\u03b3',
  delta: '\u03b4',
  pi: '\u03c0',
  Sigma: '\u03a3',
  omega: '\u03c9',
  Omega: '\u03a9',
  larr: '\u2190',
  uarr: '\u2191',
  rarr: '\u2192',
  darr: '\u2193',
  harr: '\u2194',
  lArr: '\u21d0',
  rArr: '\u21d2',
  spades: '\u2660',
  clubs: '\u2663',
  hearts: '\u2665',
  diams: '\u2666',
};

/**
 * Escape the five HTML-significant characters in `text`.
 *
 * `mode = 'named'` (default) emits named entities (`&amp;` `&lt;` `&gt;`
 * `&quot;` `&#39;`); `mode = 'numeric'` emits decimal numeric character
 * references (`&#38;` `&#60;` `&#62;` `&#34;` `&#39;`).
 *
 * The replacement is performed in a single pass with a regex that matches any
 * of the five characters, so the `&` produced by escaping `&` itself is never
 * re-escaped (no double-encoding).
 */
export function escapeHtml(text: string, mode: HtmlEntityMode = 'named'): string {
  if (typeof text !== 'string' || text.length === 0) return '';
  const replace =
    mode === 'named'
      ? (ch: string) => NAMED_ENTITIES[ch] ?? ch
      : (ch: string) => `&#${ch.charCodeAt(0)};`;
  return text.replace(/[&<>"']/g, replace);
}

/**
 * Decode HTML entities back to their literal characters.
 *
 * Handles:
 * - The five HTML-significant named entities plus the common ones in
 *   `NAMED_ENTITY_MAP` (case-sensitive - `&copy;` and `&COPY;` are different
 *   entities; we follow the HTML spec which only defines lowercase names).
 * - Decimal numeric character references: `&#NN;`
 * - Hexadecimal numeric character references: `&#xHH;` / `&#XHH;`
 *
 * Unknown named entities (e.g. `&foobar;`) are left untouched in the output.
 * Malformed numeric references (non-parseable code point, out-of-range) are
 * also left untouched. Surrogates in numeric references are joined into the
 * corresponding astral-plane character when valid.
 *
 * Returns the decoded string. Never throws.
 */
export function unescapeHtml(input: string): string {
  if (typeof input !== 'string' || input.length === 0) return '';
  // Single regex pass for all three entity forms. Capture group 1 = named,
  // group 2 = decimal, group 3 = hex.
  return input.replace(
    /&(?:(?:#x([0-9A-Fa-f]+);)|(?:#([0-9]+);)|([A-Za-z][A-Za-z0-9]*);)/g,
    (whole, hex: string | undefined, dec: string | undefined, name: string | undefined) => {
      if (hex !== undefined) {
        const cp = parseInt(hex, 16);
        return codePointToString(cp) ?? whole;
      }
      if (dec !== undefined) {
        const cp = parseInt(dec, 10);
        return codePointToString(cp) ?? whole;
      }
      if (name !== undefined) {
        const mapped = NAMED_ENTITY_MAP[name];
        return mapped !== undefined ? mapped : whole;
      }
      return whole;
    },
  );
}

/**
 * Convert a Unicode code point to its string form, or `null` if the code point
 * is not a valid scalar value (out of range, or a lone surrogate).
 */
function codePointToString(cp: number): string | null {
  if (!Number.isFinite(cp) || cp < 0 || cp > 0x10ffff) return null;
  if (cp >= 0xd800 && cp <= 0xdfff) return null; // lone surrogate
  try {
    return String.fromCodePoint(cp);
  } catch {
    return null;
  }
}

/* -------------------------------------------------------------------------- */
/* Composable - reactive state + embed integration                            */
/* -------------------------------------------------------------------------- */

export interface EscapeHtmlOutputs {
  /** The converted value (escaped text when escaping, decoded text when unescaping). */
  output: string;
  /** Number of input bytes (UTF-8 byte length). */
  inputBytes: number;
  /** Number of output bytes (UTF-8 byte length). */
  outputBytes: number;
}

export const DEFAULT_DIRECTION: HtmlDirection = 'escape';
export const DEFAULT_MODE: HtmlEntityMode = 'named';

/** Debounce window (ms) for recomputing on input changes. */
const DEBOUNCE_MS = 120;

export interface UseEscapeHtmlReturn {
  input: Ref<string>;
  direction: Ref<HtmlDirection>;
  mode: Ref<HtmlEntityMode>;
  outputs: Ref<EscapeHtmlOutputs | null>;
  error: Ref<string>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  recompute: () => void;
  setDirection: (d: HtmlDirection) => void;
  setMode: (m: HtmlEntityMode) => void;
  swap: () => void;
}

export function useEscapeHtml(): UseEscapeHtmlReturn {
  const input = ref<string>('');
  const direction = ref<HtmlDirection>(DEFAULT_DIRECTION);
  const mode = ref<HtmlEntityMode>(DEFAULT_MODE);
  const outputs = ref<EscapeHtmlOutputs | null>(null);
  const error = ref<string>('');

  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  function run(): void {
    const text = input.value;
    if (text.length === 0) {
      outputs.value = null;
      error.value = '';
      return;
    }
    if (direction.value === 'escape') {
      const out = escapeHtml(text, mode.value);
      outputs.value = {
        output: out,
        inputBytes: new TextEncoder().encode(text).length,
        outputBytes: new TextEncoder().encode(out).length,
      };
      error.value = '';
    } else {
      const out = unescapeHtml(text);
      outputs.value = {
        output: out,
        inputBytes: new TextEncoder().encode(text).length,
        outputBytes: new TextEncoder().encode(out).length,
      };
      error.value = '';
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

  function setDirection(d: HtmlDirection): void {
    direction.value = d;
  }

  function setMode(m: HtmlEntityMode): void {
    mode.value = m;
  }

  /** Swap direction and feed the current output back as the new input. */
  function swap(): void {
    if (outputs.value) {
      input.value = outputs.value.output;
    }
    direction.value = direction.value === 'escape' ? 'unescape' : 'escape';
  }

  watch(input, scheduleRun);
  watch(direction, scheduleRun);
  watch(mode, scheduleRun);

  const { isEmbed, input: embedInput, sendOutput } = useEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.input === 'string') input.value = p.input;
      if (
        typeof p.direction === 'string' &&
        (p.direction === 'escape' || p.direction === 'unescape')
      ) {
        direction.value = p.direction;
      }
      if (
        typeof p.mode === 'string' &&
        (p.mode === 'named' || p.mode === 'numeric')
      ) {
        mode.value = p.mode;
      }
    },
  });

  watch(outputs, (o) => {
    if (isEmbed.value) {
      sendOutput(o ?? {});
    }
  });

  return {
    input,
    direction,
    mode,
    outputs,
    error,
    isEmbed,
    embedInput,
    recompute,
    setDirection,
    setMode,
    swap,
  };
}
