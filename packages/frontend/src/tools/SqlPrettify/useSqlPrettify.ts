/**
 * useSqlPrettify - composable + pure logic for the SQL prettify & format tool.
 *
 * Formats SQL queries via the lazy-loaded `sql-formatter` package. The
 * formatter supports multiple dialects (standard SQL, MySQL, PostgreSQL,
 * T-SQL, and many more) and configurable indent / keyword case / spacing
 * options. The package is dynamically imported on first use so it lands in
 * its own Vite chunk (~50 KB) and is cached for subsequent calls.
 *
 * Pure helpers (`loadSqlFormatter`, `formatSql`, `normaliseError`) have no
 * Vue dependency and can be imported standalone for unit testing or reuse.
 * The `useSqlPrettify()` composable wraps them in reactive state and wires
 * up the embed PostMessage protocol.
 *
 * Dependencies: `sql-formatter` (lazy-loaded, listed in tech-stack.md).
 */
import { ref, watch, type Ref } from 'vue';
import { useEmbed } from '@/composables/useEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Types - pure logic (no Vue dependency)                                      */
/* -------------------------------------------------------------------------- */

/**
 * SQL dialects exposed by the tool. The full `sql-formatter` set is larger,
 * but the spec calls for standard, MySQL, PostgreSQL, and T-SQL. We expose
 * exactly those four to keep the UI focused.
 */
export type SqlLanguage = 'sql' | 'mysql' | 'postgresql' | 'tsql';

/** Indentation mode for the formatted SQL. */
export type SqlIndent = 2 | 4 | 'tab';

/** Casing applied to SQL keywords (SELECT, FROM, …) in the output. */
export type SqlKeywordCase = 'preserve' | 'upper' | 'lower';

/** Number of blank lines between consecutive queries (separated by `;`). */
export type SqlLinesBetweenQueries = 1 | 2 | 3;

/** Options accepted by `formatSql`. */
export interface SqlPrettifyOptions {
  language?: SqlLanguage;
  indent?: SqlIndent;
  keywordCase?: SqlKeywordCase;
  linesBetweenQueries?: SqlLinesBetweenQueries;
  newlineBeforeSemicolon?: boolean;
}

/** Result of a successful SQL format operation. */
export interface SqlPrettifyResult {
  /** Formatted SQL text. */
  sql: string;
  /** Number of bytes in the input SQL (UTF-8). */
  inputBytes: number;
  /** Number of bytes in the output SQL (UTF-8). */
  outputBytes: number;
}

/** Normalised error from the SQL formatter. */
export interface SqlPrettifyError {
  message: string;
}

/* -------------------------------------------------------------------------- */
/* Lazy-loaded sql-formatter module cache                                      */
/* -------------------------------------------------------------------------- */

/**
 * Cached dynamic import of `sql-formatter`. The package is ~50 KB and only
 * needed when the user actually formats SQL, so we load it on first use and
 * reuse the resolved module for every subsequent call.
 */
type SqlFormatterModule = typeof import('sql-formatter');

let formatterPromise: Promise<SqlFormatterModule> | null = null;

/**
 * Lazily import the `sql-formatter` module. The import is cached so repeated
 * calls share a single promise (and a single Vite chunk download).
 */
export function loadSqlFormatter(): Promise<SqlFormatterModule> {
  if (!formatterPromise) {
    formatterPromise = import('sql-formatter');
  }
  return formatterPromise;
}

/**
 * Reset the cached formatter promise. Exposed for unit tests so each test
 * can simulate a fresh load (and exercise the dynamic-import path).
 */
export function _resetSqlFormatterCache(): void {
  formatterPromise = null;
}

/* -------------------------------------------------------------------------- */
/* Pure logic - no Vue dependency below this point                             */
/* -------------------------------------------------------------------------- */

/**
 * Convert an `SqlIndent` value into the `tabWidth` / `useTabs` pair expected
 * by `sql-formatter`.
 */
function indentToConfig(indent: SqlIndent): { tabWidth: number; useTabs: boolean } {
  if (indent === 'tab') return { tabWidth: 1, useTabs: true };
  return { tabWidth: indent, useTabs: false };
}

/**
 * Format a SQL query string.
 *
 * - Empty input → empty result (caller shows the empty state).
 * - Otherwise the input is handed to `sql-formatter`'s `format()` with the
 *   chosen dialect and options.
 *
 * Throws a normalised `SqlPrettifyError` on failure (bad dialect, parse
 * error, etc.).
 */
export async function formatSql(
  input: string,
  options: SqlPrettifyOptions = {},
): Promise<SqlPrettifyResult> {
  if (typeof input !== 'string') {
    throw normaliseError(new Error('Input must be a string.'));
  }
  const inputBytes = new TextEncoder().encode(input).length;
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return { sql: '', inputBytes, outputBytes: 0 };
  }

  const language = options.language ?? 'sql';
  const indent = options.indent ?? 2;
  const keywordCase = options.keywordCase ?? 'preserve';
  const linesBetweenQueries = options.linesBetweenQueries ?? 1;
  const newlineBeforeSemicolon = options.newlineBeforeSemicolon ?? false;

  const { tabWidth, useTabs } = indentToConfig(indent);

  const mod = await loadSqlFormatter();
  let sql: string;
  try {
    sql = mod.format(trimmed, {
      language,
      tabWidth,
      useTabs,
      keywordCase,
      linesBetweenQueries,
      newlineBeforeSemicolon,
    });
  } catch (e) {
    throw normaliseError(e);
  }

  return {
    sql,
    inputBytes,
    outputBytes: new TextEncoder().encode(sql).length,
  };
}

/**
 * Convert a thrown value into a normalised `SqlPrettifyError`. `sql-formatter`
 * throws `ConfigError` (a subclass of `Error`) for invalid configuration and
 * plain `Error` for tokeniser/parser issues - both surface a useful
 * `message`.
 */
export function normaliseError(err: unknown): SqlPrettifyError {
  if (err instanceof Error) {
    return { message: err.message };
  }
  return { message: String(err) };
}

/* -------------------------------------------------------------------------- */
/* Composable - reactive state + embed integration                            */
/* -------------------------------------------------------------------------- */

export interface SqlPrettifyOutputs {
  sql: string;
  inputBytes: number;
  outputBytes: number;
}

export const DEFAULT_LANGUAGE: SqlLanguage = 'sql';
export const DEFAULT_INDENT: SqlIndent = 2;
export const DEFAULT_KEYWORD_CASE: SqlKeywordCase = 'preserve';
export const DEFAULT_LINES_BETWEEN_QUERIES: SqlLinesBetweenQueries = 1;
export const DEFAULT_NEWLINE_BEFORE_SEMICOLON = false;

/** Debounce window (ms) for recomputing on input changes. */
const DEBOUNCE_MS = 150;

export interface UseSqlPrettifyReturn {
  input: Ref<string>;
  language: Ref<SqlLanguage>;
  indent: Ref<SqlIndent>;
  keywordCase: Ref<SqlKeywordCase>;
  linesBetweenQueries: Ref<SqlLinesBetweenQueries>;
  newlineBeforeSemicolon: Ref<boolean>;
  outputs: Ref<SqlPrettifyOutputs | null>;
  error: Ref<SqlPrettifyError | null>;
  loading: Ref<boolean>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  recompute: () => void;
  setLanguage: (l: SqlLanguage) => void;
  setIndent: (i: SqlIndent) => void;
  setKeywordCase: (k: SqlKeywordCase) => void;
  setLinesBetweenQueries: (n: SqlLinesBetweenQueries) => void;
  toggleNewlineBeforeSemicolon: () => void;
}

export function useSqlPrettify(): UseSqlPrettifyReturn {
  const input = ref<string>('');
  const language = ref<SqlLanguage>(DEFAULT_LANGUAGE);
  const indent = ref<SqlIndent>(DEFAULT_INDENT);
  const keywordCase = ref<SqlKeywordCase>(DEFAULT_KEYWORD_CASE);
  const linesBetweenQueries = ref<SqlLinesBetweenQueries>(DEFAULT_LINES_BETWEEN_QUERIES);
  const newlineBeforeSemicolon = ref<boolean>(DEFAULT_NEWLINE_BEFORE_SEMICOLON);
  const outputs = ref<SqlPrettifyOutputs | null>(null);
  const error = ref<SqlPrettifyError | null>(null);
  const loading = ref<boolean>(false);

  let debounceTimer: ReturnType<typeof setTimeout> | undefined;
  // Token used to ignore stale async results when the user types quickly.
  let runToken = 0;

  async function run(): Promise<void> {
    const text = input.value;
    if (text.trim().length === 0) {
      outputs.value = null;
      error.value = null;
      loading.value = false;
      return;
    }
    const token = ++runToken;
    loading.value = true;
    try {
      const r = await formatSql(text, {
        language: language.value,
        indent: indent.value,
        keywordCase: keywordCase.value,
        linesBetweenQueries: linesBetweenQueries.value,
        newlineBeforeSemicolon: newlineBeforeSemicolon.value,
      });
      if (token !== runToken) return; // a newer run superseded us
      outputs.value = {
        sql: r.sql,
        inputBytes: r.inputBytes,
        outputBytes: r.outputBytes,
      };
      error.value = null;
    } catch (e) {
      if (token !== runToken) return;
      outputs.value = null;
      error.value = e as SqlPrettifyError;
    } finally {
      if (token === runToken) loading.value = false;
    }
  }

  function scheduleRun(): void {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = undefined;
      void run();
    }, DEBOUNCE_MS);
  }

  function recompute(): void {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = undefined;
    }
    void run();
  }

  function setLanguage(l: SqlLanguage): void {
    language.value = l;
  }
  function setIndent(i: SqlIndent): void {
    indent.value = i;
  }
  function setKeywordCase(k: SqlKeywordCase): void {
    keywordCase.value = k;
  }
  function setLinesBetweenQueries(n: SqlLinesBetweenQueries): void {
    linesBetweenQueries.value = n;
  }
  function toggleNewlineBeforeSemicolon(): void {
    newlineBeforeSemicolon.value = !newlineBeforeSemicolon.value;
  }

  watch(input, scheduleRun);
  watch(language, scheduleRun);
  watch(indent, scheduleRun);
  watch(keywordCase, scheduleRun);
  watch(linesBetweenQueries, scheduleRun);
  watch(newlineBeforeSemicolon, scheduleRun);

  const { isEmbed, input: embedInput, sendOutput } = useEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.input === 'string') {
        input.value = p.input;
      } else if (typeof p.sql === 'string') {
        input.value = p.sql;
      } else if (typeof p.query === 'string') {
        input.value = p.query;
      } else if (typeof p.value === 'string') {
        input.value = p.value;
      } else if (typeof p.content === 'string') {
        input.value = p.content;
      }
      if (typeof p.language === 'string' && isSqlLanguage(p.language)) {
        language.value = p.language;
      }
      if (typeof p.indent === 'number' && (p.indent === 2 || p.indent === 4)) {
        indent.value = p.indent;
      } else if (p.indent === 'tab') {
        indent.value = 'tab';
      }
      if (typeof p.keywordCase === 'string' && isSqlKeywordCase(p.keywordCase)) {
        keywordCase.value = p.keywordCase;
      }
      if (
        typeof p.linesBetweenQueries === 'number' &&
        (p.linesBetweenQueries === 1 || p.linesBetweenQueries === 2 || p.linesBetweenQueries === 3)
      ) {
        linesBetweenQueries.value = p.linesBetweenQueries;
      }
      if (typeof p.newlineBeforeSemicolon === 'boolean') {
        newlineBeforeSemicolon.value = p.newlineBeforeSemicolon;
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
    language,
    indent,
    keywordCase,
    linesBetweenQueries,
    newlineBeforeSemicolon,
    outputs,
    error,
    loading,
    isEmbed,
    embedInput,
    recompute,
    setLanguage,
    setIndent,
    setKeywordCase,
    setLinesBetweenQueries,
    toggleNewlineBeforeSemicolon,
  };
}

/* -------------------------------------------------------------------------- */
/* Type guards for embed input                                                 */
/* -------------------------------------------------------------------------- */

const SQL_LANGUAGES: readonly SqlLanguage[] = ['sql', 'mysql', 'postgresql', 'tsql'];
const SQL_KEYWORD_CASES: readonly SqlKeywordCase[] = ['preserve', 'upper', 'lower'];

function isSqlLanguage(v: unknown): v is SqlLanguage {
  return typeof v === 'string' && (SQL_LANGUAGES as readonly string[]).includes(v);
}

function isSqlKeywordCase(v: unknown): v is SqlKeywordCase {
  return typeof v === 'string' && (SQL_KEYWORD_CASES as readonly string[]).includes(v);
}
