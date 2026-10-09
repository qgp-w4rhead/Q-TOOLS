/**
 * useCurlCommandBuilder - composable + pure logic for building and parsing cURL commands.
 *
 * Build mode: form fields → cURL command string.
 * Parse mode: paste cURL command → parsed fields.
 *
 * No external dependencies.
 */
import { ref, computed, type ComputedRef, type Ref } from 'vue';
import { useToolEmbed } from '@/composables/useToolEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Types                                                                       */
/* -------------------------------------------------------------------------- */

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

export interface CurlField {
  method: HttpMethod;
  url: string;
  headers: { key: string; value: string }[];
  body: string;
  includeHeaders: boolean;
  followRedirects: boolean;
  insecure: boolean;
  compressed: boolean;
  verbose: boolean;
}

export interface ParsedCurl {
  method: HttpMethod;
  url: string;
  headers: { key: string; value: string }[];
  body: string;
  flags: string[];
  errors: string[];
}

/* -------------------------------------------------------------------------- */
/* Pure logic - build cURL command                                             */
/* -------------------------------------------------------------------------- */

export function buildCurlCommand(field: CurlField): string {
  const parts: string[] = ['curl'];

  if (field.verbose) parts.push('-v');
  if (field.includeHeaders) parts.push('-i');
  if (field.followRedirects) parts.push('-L');
  if (field.insecure) parts.push('-k');
  if (field.compressed) parts.push('--compressed');

  if (field.method !== 'GET') {
    parts.push('-X', field.method);
  }

  for (const h of field.headers) {
    if (h.key.trim()) {
      parts.push('-H', `'${h.key}: ${h.value}'`);
    }
  }

  if (field.body.trim()) {
    parts.push('-d', `'${field.body}'`);
  }

  if (field.url.trim()) {
    parts.push(`'${field.url}'`);
  }

  return parts.join(' ');
}

/* -------------------------------------------------------------------------- */
/* Pure logic - parse cURL command                                              */
/* -------------------------------------------------------------------------- */

export function parseCurlCommand(input: string): ParsedCurl {
  const result: ParsedCurl = {
    method: 'GET',
    url: '',
    headers: [],
    body: '',
    flags: [],
    errors: [],
  };

  const trimmed = input.trim();
  if (!trimmed) {
    result.errors.push('Empty input.');
    return result;
  }

  // Tokenize respecting single and double quotes
  const tokens: string[] = [];
  let current = '';
  let inSingle = false;
  let inDouble = false;

  for (let i = 0; i < trimmed.length; i++) {
    const ch = trimmed[i] ?? '';

    if (ch === "'" && !inDouble) {
      inSingle = !inSingle;
      continue;
    }
    if (ch === '"' && !inSingle) {
      inDouble = !inDouble;
      continue;
    }
    if (ch === ' ' && !inSingle && !inDouble) {
      if (current) {
        tokens.push(current);
        current = '';
      }
      continue;
    }
    current += ch;
  }
  if (current) tokens.push(current);

  // Remove 'curl' prefix
  if (tokens.length > 0 && tokens[0] === 'curl') {
    tokens.shift();
  } else if (tokens.length > 0 && tokens[0]?.endsWith('curl')) {
    tokens.shift();
  }

  let i = 0;
  while (i < tokens.length) {
    const tok = tokens[i] ?? '';

    if (tok === '-X' || tok === '--request') {
      const method = tokens[i + 1] as HttpMethod | undefined;
      if (method) {
        result.method = method as HttpMethod;
        i += 2;
      } else {
        result.errors.push('Missing method after -X');
        i++;
      }
    } else if (tok === '-H' || tok === '--header') {
      const header = tokens[i + 1];
      if (header) {
        const colonIdx = header.indexOf(':');
        if (colonIdx > 0) {
          result.headers.push({
            key: header.slice(0, colonIdx).trim(),
            value: header.slice(colonIdx + 1).trim(),
          });
        } else {
          result.headers.push({ key: header, value: '' });
        }
        i += 2;
      } else {
        result.errors.push('Missing header value after -H');
        i++;
      }
    } else if (tok === '-d' || tok === '--data' || tok === '--data-raw') {
      const body = tokens[i + 1];
      if (body !== undefined) {
        result.body = body;
        if (result.method === 'GET') result.method = 'POST';
        i += 2;
      } else {
        result.errors.push('Missing body after -d');
        i++;
      }
    } else if (tok === '-i' || tok === '--include') {
      result.flags.push('-i');
      i++;
    } else if (tok === '-L' || tok === '--location') {
      result.flags.push('-L');
      i++;
    } else if (tok === '-k' || tok === '--insecure') {
      result.flags.push('-k');
      i++;
    } else if (tok === '-v' || tok === '--verbose') {
      result.flags.push('-v');
      i++;
    } else if (tok === '--compressed') {
      result.flags.push('--compressed');
      i++;
    } else if (tok.startsWith('-')) {
      // Skip unknown flags with optional value
      result.flags.push(tok);
      i++;
    } else {
      // Treat as URL
      result.url = tok;
      i++;
    }
  }

  return result;
}

/* -------------------------------------------------------------------------- */
/* Composable                                                                  */
/* -------------------------------------------------------------------------- */

export interface UseCurlCommandBuilderReturn {
  field: Ref<CurlField>;
  curlCommand: ComputedRef<string>;
  parseInput: Ref<string>;
  parsedResult: ComputedRef<ParsedCurl>;
  mode: Ref<'build' | 'parse'>;
  addHeader: () => void;
  removeHeader: (index: number) => void;
  applyParsed: () => void;
  reset: () => void;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
}

export function useCurlCommandBuilder(): UseCurlCommandBuilderReturn {
  const field = ref<CurlField>({
    method: 'GET',
    url: '',
    headers: [{ key: '', value: '' }],
    body: '',
    includeHeaders: false,
    followRedirects: false,
    insecure: false,
    compressed: false,
    verbose: false,
  });

  const parseInput = ref('');
  const mode = ref<'build' | 'parse'>('build');

  const curlCommand = computed(() => buildCurlCommand(field.value));
  const parsedResult = computed(() => parseCurlCommand(parseInput.value));

  function addHeader(): void {
    field.value.headers.push({ key: '', value: '' });
  }

  function removeHeader(index: number): void {
    field.value.headers.splice(index, 1);
    if (field.value.headers.length === 0) {
      field.value.headers.push({ key: '', value: '' });
    }
  }

  function applyParsed(): void {
    const parsed = parsedResult.value;
    field.value.method = parsed.method;
    field.value.url = parsed.url;
    field.value.headers = parsed.headers.length > 0
      ? parsed.headers.map((h) => ({ ...h }))
      : [{ key: '', value: '' }];
    field.value.body = parsed.body;
    field.value.includeHeaders = parsed.flags.includes('-i');
    field.value.followRedirects = parsed.flags.includes('-L');
    field.value.insecure = parsed.flags.includes('-k');
    field.value.verbose = parsed.flags.includes('-v');
    field.value.compressed = parsed.flags.includes('--compressed');
    mode.value = 'build';
  }

  function reset(): void {
    field.value = {
      method: 'GET',
      url: '',
      headers: [{ key: '', value: '' }],
      body: '',
      includeHeaders: false,
      followRedirects: false,
      insecure: false,
      compressed: false,
      verbose: false,
    };
    parseInput.value = '';
  }

  const { isEmbed, input: embedInput } = useToolEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.url === 'string') field.value.url = p.url;
      if (typeof p.method === 'string') field.value.method = p.method as HttpMethod;
      if (typeof p.body === 'string') field.value.body = p.body;
    },
    output: curlCommand,
    toOutput: () => ({ command: curlCommand.value }),
  });

  return {
    field,
    curlCommand,
    parseInput,
    parsedResult,
    mode,
    addHeader,
    removeHeader,
    applyParsed,
    reset,
    isEmbed,
    embedInput,
  };
}
