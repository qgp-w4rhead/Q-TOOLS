/**
 * regexCheatsheetDatabase — bundled regular-expression syntax reference
 * (no external dependency).
 *
 * Covers seven categories of regex syntax:
 *   characters, quantifiers, groups, lookaround, anchors, escapes, flags
 *
 * Each entry carries the canonical token, a concise one-line description, an
 * example pattern (without delimiters), and a sample of strings the pattern
 * matches. The database is human-curated and favours the syntax developers
 * actually reach for, in both JavaScript (ECMAScript) flavour and common
 * cross-engine usage.
 *
 * Token strings use single backslashes (`\d`, `\b`) as the canonical form.
 * The UI escapes them for display; the copy button copies the raw token.
 */

/** The seven cheatsheet categories (stable display order). */
export type RegexCheatsheetCategory =
  | 'characters'
  | 'quantifiers'
  | 'groups'
  | 'lookaround'
  | 'anchors'
  | 'escapes'
  | 'flags';

/** A single regex cheatsheet entry. */
export interface RegexCheatsheetEntry {
  /** Stable unique id (used as v-for key). */
  id: string;
  /** The canonical token / syntax being described. */
  token: string;
  /** One-sentence description of what the token does. */
  description: string;
  /** Example pattern (without delimiters). */
  example: string;
  /** Example input that the pattern matches. */
  matches: string;
  /** Category id. */
  category: RegexCheatsheetCategory;
  /** Optional longer-form notes / caveat. */
  notes?: string;
}

/** Display order for categories (used by chips and grouping). */
export const REGEX_CHEATSHEET_CATEGORIES: readonly RegexCheatsheetCategory[] = [
  'characters',
  'quantifiers',
  'groups',
  'lookaround',
  'anchors',
  'escapes',
  'flags',
];

/** Human-readable labels for each category. */
export const REGEX_CHEATSHEET_CATEGORY_LABELS: Record<
  RegexCheatsheetCategory,
  string
> = {
  characters: 'Characters',
  quantifiers: 'Quantifiers',
  groups: 'Groups',
  lookaround: 'Lookaround',
  anchors: 'Anchors',
  escapes: 'Escapes',
  flags: 'Flags',
};

/** The bundled cheatsheet database. */
export const REGEX_CHEATSHEET_ENTRIES: readonly RegexCheatsheetEntry[] = [
  /* ---- Characters ---- */
  {
    id: 'char-dot',
    token: '.',
    description: 'Any character except newline (unless the `s` flag is set).',
    example: 'a.c',
    matches: 'abc, aXc',
    category: 'characters',
  },
  {
    id: 'char-class',
    token: '[abc]',
    description: 'Character class — match any one of the listed characters.',
    example: '[aeiou]',
    matches: 'a, e, i',
    category: 'characters',
  },
  {
    id: 'char-neg-class',
    token: '[^abc]',
    description: 'Negated class — match any character NOT listed.',
    example: '[^0-9]',
    matches: 'a, !, _',
    category: 'characters',
  },
  {
    id: 'char-range',
    token: '[a-z]',
    description: 'Character range inside a class.',
    example: '[a-zA-Z]',
    matches: 'a, Z, m',
    category: 'characters',
  },
  {
    id: 'char-d',
    token: '\\d',
    description: 'Digit — equivalent to `[0-9]`.',
    example: '\\d+',
    matches: '42, 7',
    category: 'characters',
  },
  {
    id: 'char-D',
    token: '\\D',
    description: 'Non-digit — equivalent to `[^0-9]`.',
    example: '\\D+',
    matches: 'abc, !',
    category: 'characters',
  },
  {
    id: 'char-w',
    token: '\\w',
    description: 'Word character — equivalent to `[A-Za-z0-9_]`.',
    example: '\\w+',
    matches: 'foo_2',
    category: 'characters',
  },
  {
    id: 'char-W',
    token: '\\W',
    description: 'Non-word character.',
    example: '\\W+',
    matches: '!, @',
    category: 'characters',
  },
  {
    id: 'char-s',
    token: '\\s',
    description: 'Whitespace — space, tab, newline, etc.',
    example: '\\s+',
    matches: ' , \t, \n',
    category: 'characters',
  },
  {
    id: 'char-S',
    token: '\\S',
    description: 'Non-whitespace character.',
    example: '\\S+',
    matches: 'abc',
    category: 'characters',
  },
  {
    id: 'char-unicode-p',
    token: '\\p{...}',
    description: 'Unicode property escape (requires `u` flag).',
    example: '\\p{Letter}+',
    matches: 'café, 日本',
    category: 'characters',
    notes: 'Requires the `u` flag. e.g. \\p{N} for any number, \\p{P} for punctuation.',
  },
  {
    id: 'char-unicode-P',
    token: '\\P{...}',
    description: 'Negated Unicode property escape (requires `u` flag).',
    example: '\\P{Letter}+',
    matches: '123, !!!',
    category: 'characters',
  },

  /* ---- Quantifiers ---- */
  {
    id: 'q-star',
    token: '*',
    description: 'Match 0 or more times (greedy).',
    example: 'ab*',
    matches: 'a, ab, abbb',
    category: 'quantifiers',
  },
  {
    id: 'q-plus',
    token: '+',
    description: 'Match 1 or more times (greedy).',
    example: 'ab+',
    matches: 'ab, abbb',
    category: 'quantifiers',
  },
  {
    id: 'q-question',
    token: '?',
    description: 'Match 0 or 1 time (optional).',
    example: 'colou?r',
    matches: 'color, colour',
    category: 'quantifiers',
  },
  {
    id: 'q-exact',
    token: '{n}',
    description: 'Match exactly n times.',
    example: '\\d{3}',
    matches: '123',
    category: 'quantifiers',
  },
  {
    id: 'q-min',
    token: '{n,}',
    description: 'Match n or more times.',
    example: '\\d{2,}',
    matches: '12, 123',
    category: 'quantifiers',
  },
  {
    id: 'q-range',
    token: '{n,m}',
    description: 'Match between n and m times.',
    example: '\\d{2,4}',
    matches: '12, 1234',
    category: 'quantifiers',
  },
  {
    id: 'q-lazy-star',
    token: '*?',
    description: 'Lazy 0+ — match the fewest possible.',
    example: 'a.*?b',
    matches: 'aXXbYYb → aXXb',
    category: 'quantifiers',
  },
  {
    id: 'q-lazy-plus',
    token: '+?',
    description: 'Lazy 1+ — match the fewest possible.',
    example: 'a.+?b',
    matches: 'aXXbYYb → aXXb',
    category: 'quantifiers',
  },
  {
    id: 'q-lazy-question',
    token: '??',
    description: 'Lazy optional — prefer to skip.',
    example: 'a??',
    matches: 'a → (empty)',
    category: 'quantifiers',
  },
  {
    id: 'q-possessive',
    token: '*+',
    description: 'Possessive 0+ — greedy, no backtracking (not in JS).',
    example: 'a*+',
    matches: 'aaa',
    category: 'quantifiers',
    notes: 'Supported in Java/PCRE, not in JavaScript.',
  },

  /* ---- Groups & alternation ---- */
  {
    id: 'g-capture',
    token: '(abc)',
    description: 'Capturing group — stores the matched substring.',
    example: '(ab)+',
    matches: 'ab, abab',
    category: 'groups',
  },
  {
    id: 'g-noncapture',
    token: '(?:abc)',
    description: 'Non-capturing group — group without storing.',
    example: '(?:ab)+',
    matches: 'ab, abab',
    category: 'groups',
  },
  {
    id: 'g-named',
    token: '(?<name>abc)',
    description: 'Named capturing group.',
    example: '(?<year>\\d{4})',
    matches: '2026',
    category: 'groups',
  },
  {
    id: 'g-alternation',
    token: 'a|b',
    description: 'Alternation — match a OR b.',
    example: 'cat|dog',
    matches: 'cat, dog',
    category: 'groups',
  },
  {
    id: 'g-backref',
    token: '\\1',
    description: 'Backreference to capturing group 1.',
    example: '(\\w)\\1',
    matches: 'aa, bb',
    category: 'groups',
  },
  {
    id: 'g-named-backref',
    token: '\\k<name>',
    description: 'Backreference by named group.',
    example: '(?<x>\\w)\\k<x>',
    matches: 'aa, bb',
    category: 'groups',
  },
  {
    id: 'g-branch-reset',
    token: '(?|a|b)',
    description: 'Branch-reset group — shared capture numbers (not in JS).',
    example: '(?|(a)|(b))',
    matches: 'a, b',
    category: 'groups',
    notes: 'PCRE-only; not supported in JavaScript.',
  },

  /* ---- Lookaround ---- */
  {
    id: 'la-ahead',
    token: '(?=abc)',
    description: 'Positive lookahead — must match ahead (zero-width).',
    example: '\\d(?=px)',
    matches: '9 in 9px',
    category: 'lookaround',
  },
  {
    id: 'la-neg-ahead',
    token: '(?!abc)',
    description: 'Negative lookahead — must NOT match ahead (zero-width).',
    example: '\\d(?!px)',
    matches: '9 in 9em',
    category: 'lookaround',
  },
  {
    id: 'la-behind',
    token: '(?<=abc)',
    description: 'Positive lookbehind — must match before (zero-width).',
    example: '(?<=\\$)\\d+',
    matches: '50 in $50',
    category: 'lookaround',
    notes: 'Lookbehind requires modern engines (ES2018+).',
  },
  {
    id: 'la-neg-behind',
    token: '(?<!abc)',
    description: 'Negative lookbehind — must NOT match before (zero-width).',
    example: '(?<!\\$)\\d+',
    matches: '50 in 50px',
    category: 'lookaround',
  },

  /* ---- Anchors ---- */
  {
    id: 'a-start',
    token: '^',
    description: 'Start of string (or start of line with `m` flag).',
    example: '^Hello',
    matches: 'Hello world',
    category: 'anchors',
  },
  {
    id: 'a-end',
    token: '$',
    description: 'End of string (or end of line with `m` flag).',
    example: 'world$',
    matches: 'Hello world',
    category: 'anchors',
  },
  {
    id: 'a-word-boundary',
    token: '\\b',
    description: 'Word boundary — between a word and non-word character.',
    example: '\\bcat\\b',
    matches: 'the cat sat',
    category: 'anchors',
  },
  {
    id: 'a-non-word-boundary',
    token: '\\B',
    description: 'Not a word boundary.',
    example: '\\Bcat',
    matches: 'concatenate',
    category: 'anchors',
  },
  {
    id: 'a-start-string',
    token: '\\A',
    description: 'Start of string only (not in JS).',
    example: '\\AHello',
    matches: 'Hello',
    category: 'anchors',
    notes: 'PCRE/Java; not supported in JavaScript — use `^` without `m` flag.',
  },
  {
    id: 'a-end-string',
    token: '\\z',
    description: 'Very end of string (not in JS).',
    example: 'world\\z',
    matches: 'Hello world',
    category: 'anchors',
    notes: 'PCRE/Java; not supported in JavaScript — use `$` without `m` flag.',
  },

  /* ---- Escapes ---- */
  {
    id: 'e-dot',
    token: '\\.',
    description: 'Literal dot (escape any metacharacter).',
    example: 'example\\.com',
    matches: 'example.com',
    category: 'escapes',
  },
  {
    id: 'e-backslash',
    token: '\\\\',
    description: 'Literal backslash.',
    example: 'C:\\\\',
    matches: 'C:\\',
    category: 'escapes',
  },
  {
    id: 'e-newline',
    token: '\\n',
    description: 'Newline (LF).',
    example: 'a\\nb',
    matches: 'a↵b',
    category: 'escapes',
  },
  {
    id: 'e-tab',
    token: '\\t',
    description: 'Horizontal tab.',
    example: 'a\\tb',
    matches: 'a→b',
    category: 'escapes',
  },
  {
    id: 'e-carriage',
    token: '\\r',
    description: 'Carriage return (CR).',
    example: 'a\\rb',
    matches: 'a↵b (CR)',
    category: 'escapes',
  },
  {
    id: 'e-hex',
    token: '\\xHH',
    description: 'Hex code point (2 hex digits).',
    example: '\\x41',
    matches: 'A',
    category: 'escapes',
  },
  {
    id: 'e-unicode',
    token: '\\uHHHH',
    description: 'Unicode code point (4 hex digits).',
    example: '\\u00E9',
    matches: 'é',
    category: 'escapes',
  },
  {
    id: 'e-unicode-brace',
    token: '\\u{H...}',
    description: 'Code point with braces (requires `u` flag).',
    example: '\\u{1F600}',
    matches: '😀',
    category: 'escapes',
  },
  {
    id: 'e-octal',
    token: '\\0',
    description: 'NUL character (or \\ooo octal in some engines).',
    example: '\\0',
    matches: 'NUL',
    category: 'escapes',
    notes: 'Octal escapes are not supported in strict JS with the `u` flag.',
  },
  {
    id: 'e-control',
    token: '\\cX',
    description: 'Control character (X is A–Z or a–z).',
    example: '\\cM',
    matches: 'Ctrl-M (CR)',
    category: 'escapes',
  },

  /* ---- Flags ---- */
  {
    id: 'f-global',
    token: 'g',
    description: 'Global — find all matches, not just the first.',
    example: '/a/g',
    matches: 'banana → a,a,a',
    category: 'flags',
  },
  {
    id: 'f-ignore-case',
    token: 'i',
    description: 'Case-insensitive match.',
    example: '/hello/i',
    matches: 'Hello, HELLO',
    category: 'flags',
  },
  {
    id: 'f-multiline',
    token: 'm',
    description: 'Multiline — `^` and `$` match line boundaries.',
    example: '/^foo/m',
    matches: 'foo\\nbar → foo',
    category: 'flags',
  },
  {
    id: 'f-dotall',
    token: 's',
    description: 'Dotall — `.` matches newline too.',
    example: '/a.b/s',
    matches: 'a\\nb',
    category: 'flags',
  },
  {
    id: 'f-unicode',
    token: 'u',
    description: 'Unicode mode — treat pattern as Unicode code points.',
    example: '/\\u{1F600}/u',
    matches: '😀',
    category: 'flags',
  },
  {
    id: 'f-sticky',
    token: 'y',
    description: 'Sticky — match must start at `lastIndex`.',
    example: '/abc/y',
    matches: 'abc at lastIndex',
    category: 'flags',
  },
  {
    id: 'f-indices',
    token: 'd',
    description: 'Indices — expose start/end of each capture group.',
    example: '/(a)(b)/d',
    matches: 'indices on .exec()',
    category: 'flags',
    notes: 'ES2022 — adds `match.indices` to results.',
  },
];

/** Per-category counts (precomputed for stable chip badges). */
export const REGEX_CHEATSHEET_COUNTS: Readonly<
  Record<RegexCheatsheetCategory, number>
> = REGEX_CHEATSHEET_CATEGORIES.reduce(
  (acc, c) => {
    acc[c] = REGEX_CHEATSHEET_ENTRIES.filter((e) => e.category === c).length;
    return acc;
  },
  {} as Record<RegexCheatsheetCategory, number>,
);

/** Total entry count. */
export const REGEX_CHEATSHEET_TOTAL = REGEX_CHEATSHEET_ENTRIES.length;

/** Approximate size of the bundled database in bytes. */
export const REGEX_CHEATSHEET_SIZE_BYTES = REGEX_CHEATSHEET_ENTRIES.reduce(
  (sum, e) =>
    sum +
    e.id.length +
    e.token.length +
    e.description.length +
    e.example.length +
    e.matches.length +
    (e.notes?.length ?? 0),
  0,
);
