/**
 * useRegexTester - composable + pure logic for the Regex tester tool.
 *
 * Compiles a user-supplied regex pattern with chosen flags against a test
 * string and reports every match (with its capture groups, named groups,
 * index, and length). The test string is also segmented into
 * matched / unmatched runs so the UI can render inline highlighting without
 * resorting to `v-html` of arbitrary user content (each segment is text-bound
 * and rendered through Vue's text interpolation).
 *
 * Pure helpers (`compilePattern`, `runRegex`, `segmentMatches`, `escapeHtml`)
 * have no Vue dependency and can be imported standalone for unit testing or
 * reuse. The `useRegexTester()` composable wraps them in reactive state and
 * wires up the embed PostMessage protocol.
 *
 * No external dependencies - only the built-in `RegExp`.
 */
import { ref, watch, type Ref } from 'vue';
import { useEmbed } from '@/composables/useEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Pure logic - no Vue dependency below this point                             */
/* -------------------------------------------------------------------------- */

/** Individual flags supported by the tester, with description + label. */
export interface RegexFlag {
  /** Single-character flag. */
  char: string;
  /** Human-readable name. */
  label: string;
  /** Short description of the flag's effect. */
  description: string;
}

export const REGEX_FLAGS: ReadonlyArray<RegexFlag> = [
  { char: 'g', label: 'global', description: 'Find all matches (not just the first).' },
  { char: 'i', label: 'ignore case', description: 'Case-insensitive matching.' },
  { char: 'm', label: 'multiline', description: '^ and $ match at line breaks.' },
  { char: 's', label: 'dotall', description: 'Dot (.) matches newlines.' },
  { char: 'u', label: 'unicode', description: 'Treat pattern as Unicode code points.' },
  { char: 'y', label: 'sticky', description: 'Match at lastIndex only.' },
];

/** A single capture group within a match. */
export interface RegexGroup {
  /** 1-based group index (0 is reserved for the full match). */
  index: number;
  /** Group name when named, otherwise `null`. */
  name: string | null;
  /** Captured text, or `undefined` when the group did not participate. */
  value: string | undefined;
}

/** A single regex match within the test string. */
export interface RegexMatch {
  /** 0-based match number (1-based in display). */
  matchIndex: number;
  /** Full matched substring. */
  full: string;
  /** Start index in the test string. */
  start: number;
  /** End index (exclusive) in the test string. */
  end: number;
  /** Number of characters matched. */
  length: number;
  /** Numbered + named capture groups (1-based, group 0 excluded). */
  groups: RegexGroup[];
}

/** Result of compiling a pattern. */
export interface CompiledRegex {
  regex: RegExp | null;
  error: string | null;
}

/** A run of text in the segmented test string - either matched or plain. */
export interface Segment {
  /** Whether this segment is a match. */
  isMatch: boolean;
  /** The text content of the segment. */
  text: string;
  /** When `isMatch`, the 0-based match index this segment corresponds to. */
  matchIndex: number | null;
}

/**
 * Compile a regex pattern with the given flags.
 *
 * Returns `{ regex, error }`. When compilation fails, `regex` is `null` and
 * `error` holds a human-readable message (the raw `SyntaxError` message is
 * cleaned up: the `Invalid regular expression: /…/: ` prefix is stripped).
 *
 * Flags are deduplicated and sorted into a stable order so identical inputs
 * produce identical `RegExp` instances.
 */
export function compilePattern(pattern: string, flags: string): CompiledRegex {
  const trimmedPattern = pattern;
  const cleanedFlags = Array.from(new Set(flags.replace(/\s/g, ''))).sort().join('');
  if (trimmedPattern.length === 0) {
    return { regex: null, error: null };
  }
  try {
    const regex = new RegExp(trimmedPattern, cleanedFlags);
    return { regex, error: null };
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    // V8 messages look like:
    //   "Invalid regular expression: /(/: Unterminated group"
    //   "Invalid regular expression: /?/: Nothing to repeat"
    // Strip the leading "Invalid regular expression: /…/: " prefix when present.
    const cleaned = raw.replace(/^Invalid regular expression:\s*\/.*?:\s*/, '');
    return { regex: null, error: cleaned };
  }
}

/**
 * Run a compiled regex against a test string and collect every match.
 *
 * When the `g` (global) or `y` (sticky) flag is set, all matches are
 * collected via `regex.exec` in a loop (with a guard against zero-width-match
 * infinite loops). Without `g`/`y`, only the first match is returned (the
 * native `match` / `exec` semantics).
 *
 * Named groups are extracted from `match.groups` when present. Numbered
 * groups are taken from `match[i]` for `i = 1..n` where `n` is derived from
 * the regex's source (count of unescaped `(`).
 */
export function runRegex(regex: RegExp, testString: string): RegexMatch[] {
  const matches: RegexMatch[] = [];
  if (!regex || testString.length === 0) return matches;

  const global = regex.global || regex.sticky;
  // Count capture groups by counting unescaped `(` that are not `(?:` / `(?<`
  // etc. A simple heuristic - sufficient for display purposes.
  const groupCount = countCaptureGroups(regex.source);

  if (!global) {
    const m = regex.exec(testString);
    if (!m) return matches;
    matches.push(buildMatch(0, m, groupCount));
    return matches;
  }

  // Global / sticky - iterate via exec, guarding against zero-width loops.
  let lastEnd = -1;
  let matchIndex = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const m = regex.exec(testString);
    if (!m) break;
    const start = m.index;
    const end = start + m[0].length;
    matches.push(buildMatch(matchIndex, m, groupCount));
    matchIndex++;
    if (m[0].length === 0) {
      // Zero-width match - advance by one to avoid an infinite loop.
      if (end === lastEnd) {
        regex.lastIndex = end + 1;
      }
      lastEnd = end;
    } else {
      lastEnd = end;
    }
    if (matchIndex > 100000) break; // hard safety cap
  }
  return matches;
}

/** Build a `RegexMatch` from a single `RegExpExecArray`. */
function buildMatch(
  matchIndex: number,
  m: RegExpExecArray,
  groupCount: number,
): RegexMatch {
  const groups: RegexGroup[] = [];
  const namedGroups =
    m.groups && typeof m.groups === 'object' ? (m.groups as Record<string, string>) : null;
  for (let i = 1; i <= groupCount; i++) {
    let name: string | null = null;
    if (namedGroups) {
      // Find the named-group key whose value matches m[i] - but multiple groups
      // can share a value, so we look up by index using a reverse map built on
      // the fly. The native `groups` object does not expose index→name, so we
      // scan entries.
      for (const [k, v] of Object.entries(namedGroups)) {
        if (v === m[i] && k !== undefined) {
          // First matching key wins - good enough for display.
          name = k;
          break;
        }
      }
    }
    groups.push({ index: i, name, value: m[i] });
  }
  return {
    matchIndex,
    full: m[0],
    start: m.index,
    end: m.index + m[0].length,
    length: m[0].length,
    groups,
  };
}

/**
 * Count the number of capturing groups in a regex source string.
 *
 * Counts unescaped `(` that are not followed by `?:` / `?=` / `?!` / `?<=` /
 * `?<!`. This is a heuristic (does not handle character classes containing
 * parens), but is sufficient for display purposes.
 */
export function countCaptureGroups(source: string): number {
  let count = 0;
  let inClass = false;
  let escaped = false;
  for (let i = 0; i < source.length; i++) {
    const ch = source[i]!;
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === '\\') {
      escaped = true;
      continue;
    }
    if (ch === '[') {
      inClass = true;
      continue;
    }
    if (ch === ']' && inClass) {
      inClass = false;
      continue;
    }
    if (inClass) continue;
    if (ch === '(') {
      const next = source[i + 1];
      if (next === '?') {
        const after = source[i + 2];
        // (?:  (?=  (?!  (?<=  (?<!  (?<name>  are non-capturing or named.
        // Named groups (?<name>...) ARE capturing - detect `?<` followed by a
        // name char (not `=` or `!`).
        if (after === ':') continue;
        if (after === '=') continue;
        if (after === '!') continue;
        // (?< - could be (?<name> (capturing) or (?<= / (?<! (lookbehind).
        if (after === '<') {
          const after2 = source[i + 3];
          if (after2 === '=' || after2 === '!') continue;
          // Otherwise it's a named capture group - count it.
          count++;
          continue;
        }
        // Unknown `(?` form - treat as non-capturing.
        continue;
      }
      count++;
    }
  }
  return count;
}

/**
 * Segment the test string into matched / plain runs for inline highlighting.
 *
 * Segments are returned in source order. Adjacent matches produce separate
 * `isMatch: true` segments (each tagged with its `matchIndex`); the gaps
 * between them are `isMatch: false` segments. An empty test string yields a
 * single empty plain segment.
 */
export function segmentMatches(testString: string, matches: RegexMatch[]): Segment[] {
  if (testString.length === 0) return [];
  const segments: Segment[] = [];
  let cursor = 0;
  for (const m of matches) {
    if (m.start > cursor) {
      segments.push({ isMatch: false, text: testString.slice(cursor, m.start), matchIndex: null });
    }
    segments.push({ isMatch: true, text: m.full, matchIndex: m.matchIndex });
    cursor = m.end;
  }
  if (cursor < testString.length) {
    segments.push({ isMatch: false, text: testString.slice(cursor), matchIndex: null });
  }
  return segments;
}

/**
 * Escape a string for safe HTML interpolation.
 *
 * Used only by the copy-as-HTML export - the live highlight view renders
 * segments through Vue's text interpolation, which escapes automatically.
 */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* -------------------------------------------------------------------------- */
/* Regex reference cheatsheet data                                            */
/* -------------------------------------------------------------------------- */

export interface RegexReferenceEntry {
  /** Token / syntax being described. */
  token: string;
  /** Short human-readable description. */
  description: string;
  /** Example pattern (without delimiters). */
  example: string;
  /** Example input that the pattern matches. */
  matches: string;
}

export interface RegexReferenceSection {
  /** Section heading. */
  title: string;
  /** Entries in the section. */
  entries: RegexReferenceEntry[];
}

export const REGEX_REFERENCE: ReadonlyArray<RegexReferenceSection> = [
  {
    title: 'Character classes',
    entries: [
      { token: '.', description: 'Any character (except newline, unless `s` flag).', example: 'a.c', matches: 'abc, aXc' },
      { token: '[abc]', description: 'Any one of the listed characters.', example: '[aeiou]', matches: 'a, e, i' },
      { token: '[^abc]', description: 'Any character NOT listed.', example: '[^0-9]', matches: 'a, !, _' },
      { token: '[a-z]', description: 'Character range.', example: '[a-z]', matches: 'a, m, z' },
      { token: '\\d', description: 'Digit (`[0-9]`).', example: '\\d+', matches: '42, 7' },
      { token: '\\D', description: 'Non-digit.', example: '\\D+', matches: 'abc, !' },
      { token: '\\w', description: 'Word character (`[A-Za-z0-9_]`).', example: '\\w+', matches: 'foo_2' },
      { token: '\\W', description: 'Non-word character.', example: '\\W+', matches: '!, @' },
      { token: '\\s', description: 'Whitespace.', example: '\\s+', matches: ' , \t' },
      { token: '\\S', description: 'Non-whitespace.', example: '\\S+', matches: 'abc' },
    ],
  },
  {
    title: 'Anchors',
    entries: [
      { token: '^', description: 'Start of string (or line with `m` flag).', example: '^Hello', matches: 'Hello world' },
      { token: '$', description: 'End of string (or line with `m` flag).', example: 'world$', matches: 'Hello world' },
      { token: '\\b', description: 'Word boundary.', example: '\\bcat\\b', matches: 'the cat sat' },
      { token: '\\B', description: 'Not a word boundary.', example: '\\Bcat', matches: 'concatenate' },
    ],
  },
  {
    title: 'Quantifiers',
    entries: [
      { token: '*', description: '0 or more.', example: 'ab*', matches: 'a, ab, abbb' },
      { token: '+', description: '1 or more.', example: 'ab+', matches: 'ab, abbb' },
      { token: '?', description: '0 or 1 (optional).', example: 'colou?r', matches: 'color, colour' },
      { token: '{n}', description: 'Exactly n.', example: '\\d{3}', matches: '123' },
      { token: '{n,}', description: 'n or more.', example: '\\d{2,}', matches: '12, 123' },
      { token: '{n,m}', description: 'Between n and m.', example: '\\d{2,4}', matches: '12, 1234' },
      { token: '*?', description: 'Lazy 0+ (fewest possible).', example: 'a.*?b', matches: 'aXXbYYb → aXXb' },
    ],
  },
  {
    title: 'Groups & alternation',
    entries: [
      { token: '(abc)', description: 'Capturing group.', example: '(ab)+', matches: 'ab, abab' },
      { token: '(?:abc)', description: 'Non-capturing group.', example: '(?:ab)+', matches: 'ab, abab' },
      { token: '(?<name>abc)', description: 'Named capturing group.', example: '(?<year>\\d{4})', matches: '2026' },
      { token: 'a|b', description: 'Alternation (a OR b).', example: 'cat|dog', matches: 'cat, dog' },
      { token: '\\1', description: 'Backreference to group 1.', example: '(\\w)\\1', matches: 'aa, bb' },
      { token: '\\k<name>', description: 'Backreference by name.', example: '(?<x>\\w)\\k<x>', matches: 'aa, bb' },
    ],
  },
  {
    title: 'Lookaround',
    entries: [
      { token: '(?=abc)', description: 'Lookahead - must match ahead.', example: '\\d(?=px)', matches: '9 in 9px' },
      { token: '(?!abc)', description: 'Negative lookahead.', example: '\\d(?!px)', matches: '9 in 9em' },
      { token: '(?<=abc)', description: 'Lookbehind - must match before.', example: '(?<=\\$)\\d+', matches: '50 in $50' },
      { token: '(?<!abc)', description: 'Negative lookbehind.', example: '(?<!\\$)\\d+', matches: '50 in 50px' },
    ],
  },
  {
    title: 'Escapes',
    entries: [
      { token: '\\.', description: 'Literal dot.', example: 'example\\.com', matches: 'example.com' },
      { token: '\\\\', description: 'Literal backslash.', example: 'C:\\\\', matches: 'C:\\' },
      { token: '\\n', description: 'Newline.', example: 'a\\nb', matches: 'a\\nb (LF)' },
      { token: '\\t', description: 'Tab.', example: 'a\\tb', matches: 'a\\tb (tab)' },
      { token: '\\xHH', description: 'Hex code point.', example: '\\x41', matches: 'A' },
      { token: '\\uHHHH', description: 'Unicode code point.', example: '\\u00E9', matches: 'é' },
    ],
  },
];

/* -------------------------------------------------------------------------- */
/* Composable - reactive state + embed integration                            */
/* -------------------------------------------------------------------------- */

export interface UseRegexTesterReturn {
  pattern: Ref<string>;
  flags: Ref<string>;
  testString: Ref<string>;
  compiled: Ref<CompiledRegex>;
  matches: Ref<RegexMatch[]>;
  segments: Ref<Segment[]>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  recompute: () => void;
  toggleFlag: (char: string) => void;
}

export function useRegexTester(): UseRegexTesterReturn {
  const pattern = ref<string>('');
  const flags = ref<string>('g');
  const testString = ref<string>('');
  const compiled = ref<CompiledRegex>({ regex: null, error: null });
  const matches = ref<RegexMatch[]>([]);
  const segments = ref<Segment[]>([]);

  function recompute(): void {
    const c = compilePattern(pattern.value, flags.value);
    compiled.value = c;
    if (!c.regex) {
      matches.value = [];
      segments.value = [];
      return;
    }
    const ms = runRegex(c.regex, testString.value);
    matches.value = ms;
    segments.value = segmentMatches(testString.value, ms);
  }

  watch([pattern, flags, testString], recompute, { immediate: true });

  function toggleFlag(char: string): void {
    const c = char.trim();
    if (c.length !== 1) return;
    if (flags.value.includes(c)) {
      flags.value = flags.value.replace(c, '');
    } else {
      flags.value = flags.value + c;
    }
  }

  const { isEmbed, input: embedInput, sendOutput } = useEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.pattern === 'string') pattern.value = p.pattern;
      if (typeof p.flags === 'string') flags.value = p.flags;
      if (typeof p.testString === 'string') testString.value = p.testString;
      else if (typeof p.input === 'string') testString.value = p.input;
      else if (typeof p.value === 'string') testString.value = p.value;
      else if (typeof p.text === 'string') testString.value = p.text;
    },
  });

  watch([compiled, matches], () => {
    if (isEmbed.value) {
      sendOutput({
        pattern: pattern.value,
        flags: flags.value,
        count: matches.value.length,
        error: compiled.value.error,
        matches: matches.value.map((m) => ({
          matchIndex: m.matchIndex,
          full: m.full,
          start: m.start,
          end: m.end,
          groups: m.groups,
        })),
      });
    }
  });

  return {
    pattern,
    flags,
    testString,
    compiled,
    matches,
    segments,
    isEmbed,
    embedInput,
    recompute,
    toggleFlag,
  };
}
