/**
 * useCaseConverter — composable + pure logic for the Case converter tool.
 *
 * Converts text between nine casing conventions:
 *
 *   - UPPER           `HELLO WORLD`
 *   - lower           `hello world`
 *   - Title Case      `Hello World`
 *   - camelCase       `helloWorld`
 *   - PascalCase      `HelloWorld`
 *   - snake_case      `hello_world`
 *   - kebab-case      `hello-world`
 *   - CONSTANT_CASE   `HELLO_WORLD`
 *   - sentence case   `Hello world`
 *
 * A robust word splitter recognises boundaries at non-alphanumeric runs,
 * lower→upper transitions (camelCase / PascalCase), acronym→word
 * transitions (`XMLParser` → `XML` `Parser`), and letter↔digit transitions
 * (`v2` → `v` `2`).
 *
 * `UPPER` and `lower` apply a whole-string transform that preserves all
 * separators and whitespace. `sentence case` and `Title Case` preserve
 * newlines and sentence structure. The five identifier conventions
 * (camel, Pascal, snake, kebab, constant) process the input line-by-line,
 * emitting one token per line so multi-line input stays multi-line.
 *
 * Pure helpers (`splitWords`, `capitalize`, `lowercaseWord`, `uppercaseWord`,
 * `toUpper`, `toLower`, `toTitleCase`, `toSentenceCase`, `toCamelCase`,
 * `toPascalCase`, `toSnakeCase`, `toKebabCase`, `toConstantCase`,
 * `convertCase`) have no Vue dependency and can be imported standalone for
 * unit testing or reuse. The `useCaseConverter()` composable wraps them in
 * reactive state and wires up the embed PostMessage protocol.
 *
 * No external dependencies.
 */
import { ref, watch, type Ref } from 'vue';
import { useEmbed } from '@/composables/useEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Pure logic — no Vue dependency below this point                            */
/* -------------------------------------------------------------------------- */

/** Supported case-conversion modes. */
export type CaseMode =
  | 'upper'
  | 'lower'
  | 'title'
  | 'camel'
  | 'pascal'
  | 'snake'
  | 'kebab'
  | 'constant'
  | 'sentence';

/** Human-readable labels for each mode, in display order. */
export const CASE_MODES: ReadonlyArray<{ value: CaseMode; label: string; example: string }> = [
  { value: 'upper', label: 'UPPER', example: 'HELLO WORLD' },
  { value: 'lower', label: 'lower', example: 'hello world' },
  { value: 'title', label: 'Title Case', example: 'Hello World' },
  { value: 'sentence', label: 'Sentence case', example: 'Hello world' },
  { value: 'camel', label: 'camelCase', example: 'helloWorld' },
  { value: 'pascal', label: 'PascalCase', example: 'HelloWorld' },
  { value: 'snake', label: 'snake_case', example: 'hello_world' },
  { value: 'kebab', label: 'kebab-case', example: 'hello-world' },
  { value: 'constant', label: 'CONSTANT_CASE', example: 'HELLO_WORLD' },
];

/** Null-byte separator used internally to mark word boundaries. */
const SEP = '\u0000';

/**
 * Split a single line into words.
 *
 * Boundaries are inserted at:
 *   - any run of non-alphanumeric characters (spaces, `_`, `-`, `.`, …)
 *   - a lowercase/digit → uppercase transition (`aB` → `a B`)
 *   - an acronym run → Capitalised word (`XMLParser` → `XML Parser`)
 *
 * Digits stay attached to the adjacent letter group (`v2` and `HTML5` are
 * kept intact) so identifiers like `v2Value` split into `v2` + `Value`.
 *
 * Returns the list of alphanumeric word tokens (no separators).
 */
export function splitWords(line: string): string[] {
  if (!line) return [];
  const marked = line
    .replace(/([a-z0-9])([A-Z])/g, `$1${SEP}$2`)
    .replace(/([A-Z]+)([A-Z][a-z])/g, `$1${SEP}$2`);
  return marked
    .split(/[^a-zA-Z0-9]+/)
    .filter((w) => w.length > 0);
}

/** Capitalise the first alphabetic character of `word`, lowercasing the rest. */
export function capitalize(word: string): string {
  if (!word) return word;
  const [first, ...rest] = word;
  return (first!.toUpperCase() + rest.join('').toLowerCase());
}

/** Lowercase the first alphabetic character of `word`, keeping the rest. */
export function lowercaseFirst(word: string): string {
  if (!word) return word;
  const [first, ...rest] = word;
  return (first!.toLowerCase() + rest.join(''));
}

/** Uppercase a word, preserving digits. Alias for `word.toUpperCase()`. */
export function uppercaseWord(word: string): string {
  return word.toUpperCase();
}

/** Lowercase a word, preserving digits. Alias for `word.toLowerCase()`. */
export function lowercaseWord(word: string): string {
  return word.toLowerCase();
}

/* ------------------------------ whole-string ------------------------------ */

/** UPPER — uppercase the entire input, preserving all separators. */
export function toUpper(input: string): string {
  return input.toUpperCase();
}

/** lower — lowercase the entire input, preserving all separators. */
export function toLower(input: string): string {
  return input.toLowerCase();
}

/**
 * Title Case — capitalise the first letter of every whitespace-delimited
 * word, lowercasing the remaining letters. Newlines and existing spacing
 * are preserved.
 */
export function toTitleCase(input: string): string {
  return input.replace(/[^\s]+/g, (token) => capitalize(token));
}

/**
 * Sentence case — lowercase the entire text, then capitalise the first
 * alphabetic character of the text and the first alphabetic character after
 * each sentence boundary (`.`, `!`, `?` followed by whitespace, or a
 * newline). Newlines are preserved.
 */
export function toSentenceCase(input: string): string {
  const lower = input.toLowerCase();
  // Capitalise the first alphabetic character of the whole text.
  let out = lower.replace(/^(?:[^a-z]*)([a-z])/, (m, c) => m.slice(0, -1) + c.toUpperCase());
  // Capitalise after each sentence boundary: . ! ?  followed by whitespace,
  // or after a newline.
  out = out.replace(
    /([.!?]\s+|\n\s*)([a-z])/g,
    (_m, lead: string, c: string) => lead + c.toUpperCase(),
  );
  return out;
}

/* ------------------------------- identifier ------------------------------- */

/** Convert one line's words to camelCase. */
function lineToCamel(line: string): string {
  const words = splitWords(line);
  if (words.length === 0) return '';
  return words
    .map((w, i) => (i === 0 ? lowercaseWord(w) : capitalize(w)))
    .join('');
}

/** Convert one line's words to PascalCase. */
function lineToPascal(line: string): string {
  const words = splitWords(line);
  if (words.length === 0) return '';
  return words.map((w) => capitalize(w)).join('');
}

/** Convert one line's words to snake_case. */
function lineToSnake(line: string): string {
  const words = splitWords(line);
  if (words.length === 0) return '';
  return words.map((w) => lowercaseWord(w)).join('_');
}

/** Convert one line's words to kebab-case. */
function lineToKebab(line: string): string {
  const words = splitWords(line);
  if (words.length === 0) return '';
  return words.map((w) => lowercaseWord(w)).join('-');
}

/** Convert one line's words to CONSTANT_CASE. */
function lineToConstant(line: string): string {
  const words = splitWords(line);
  if (words.length === 0) return '';
  return words.map((w) => uppercaseWord(w)).join('_');
}

/** camelCase — process each line independently, join with `\n`. */
export function toCamelCase(input: string): string {
  return input.split('\n').map(lineToCamel).join('\n');
}

/** PascalCase — process each line independently, join with `\n`. */
export function toPascalCase(input: string): string {
  return input.split('\n').map(lineToPascal).join('\n');
}

/** snake_case — process each line independently, join with `\n`. */
export function toSnakeCase(input: string): string {
  return input.split('\n').map(lineToSnake).join('\n');
}

/** kebab-case — process each line independently, join with `\n`. */
export function toKebabCase(input: string): string {
  return input.split('\n').map(lineToKebab).join('\n');
}

/** CONSTANT_CASE — process each line independently, join with `\n`. */
export function toConstantCase(input: string): string {
  return input.split('\n').map(lineToConstant).join('\n');
}

/* --------------------------------- dispatch ------------------------------- */

/**
 * Convert `input` to the requested `mode`. Pure function — no side effects.
 */
export function convertCase(input: string, mode: CaseMode): string {
  switch (mode) {
    case 'upper':
      return toUpper(input);
    case 'lower':
      return toLower(input);
    case 'title':
      return toTitleCase(input);
    case 'sentence':
      return toSentenceCase(input);
    case 'camel':
      return toCamelCase(input);
    case 'pascal':
      return toPascalCase(input);
    case 'snake':
      return toSnakeCase(input);
    case 'kebab':
      return toKebabCase(input);
    case 'constant':
      return toConstantCase(input);
  }
}

/* -------------------------------------------------------------------------- */
/* Composable — reactive state + embed integration                            */
/* -------------------------------------------------------------------------- */

export const DEFAULT_MODE: CaseMode = 'camel';

/** Debounce window (ms) for recomputing on input changes. */
const DEBOUNCE_MS = 120;

export interface UseCaseConverterReturn {
  input: Ref<string>;
  mode: Ref<CaseMode>;
  output: Ref<string>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  recompute: () => void;
  setMode: (m: CaseMode) => void;
}

export function useCaseConverter(): UseCaseConverterReturn {
  const input = ref<string>('');
  const mode = ref<CaseMode>(DEFAULT_MODE);
  const output = ref<string>('');

  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  function run(): void {
    const text = input.value;
    if (text.length === 0) {
      output.value = '';
      return;
    }
    output.value = convertCase(text, mode.value);
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

  function setMode(m: CaseMode): void {
    mode.value = m;
  }

  watch(input, scheduleRun);
  watch(mode, scheduleRun);

  const { isEmbed, input: embedInput, sendOutput } = useEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.input === 'string') input.value = p.input;
      if (typeof p.mode === 'string') {
        const m = p.mode as CaseMode;
        if (CASE_MODES.some((c) => c.value === m)) {
          mode.value = m;
        }
      }
    },
  });

  watch(output, (o) => {
    if (isEmbed.value) {
      sendOutput({ output: o });
    }
  });

  return {
    input,
    mode,
    output,
    isEmbed,
    embedInput,
    recompute,
    setMode,
  };
}
