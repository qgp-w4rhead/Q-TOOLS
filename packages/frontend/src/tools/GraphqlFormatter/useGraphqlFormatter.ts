/**
 * useGraphqlFormatter — composable + pure logic for prettifying and
 * validating GraphQL queries/mutations/subscriptions.
 *
 * No external dependencies.
 */
import { ref, computed, type ComputedRef, type Ref } from 'vue';
import { useToolEmbed } from '@/composables/useToolEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Types                                                                       */
/* -------------------------------------------------------------------------- */

export interface FormatResult {
  formatted: string;
  errors: string[];
  operationType: string | null;
  operationName: string | null;
  fieldsCount: number;
}

/* -------------------------------------------------------------------------- */
/* Pure logic                                                                  */
/* -------------------------------------------------------------------------- */

function tokenize(input: string): string[] {
  const tokens: string[] = [];
  let i = 0;
  while (i < input.length) {
    const ch = input[i] ?? '';
    if (/\s/.test(ch)) { i++; continue; }
    if (ch === '#') {
      while (i < input.length && input[i] !== '\n') i++;
      continue;
    }
    if (ch === '"' || ch === '\'') {
      const quote = ch;
      let str = ch;
      i++;
      while (i < input.length && input[i] !== quote) {
        str += input[i];
        i++;
      }
      str += quote;
      i++;
      tokens.push(str);
      continue;
    }
    if (ch === '{' || ch === '}' || ch === '(' || ch === ')' || ch === '[' || ch === ']' || ch === ':' || ch === ',' || ch === '=' || ch === '!' || ch === '$' || ch === '@' || ch === '&') {
      tokens.push(ch);
      i++;
      continue;
    }
    if (ch === '.') {
      let dots = '';
      while (i < input.length && input[i] === '.') { dots += '.'; i++; }
      tokens.push(dots);
      continue;
    }
    let ident = '';
    while (i < input.length && /[a-zA-Z0-9_]/.test(input[i] ?? '')) {
      ident += input[i];
      i++;
    }
    if (ident) { tokens.push(ident); continue; }
    i++;
  }
  return tokens;
}

export function formatGraphql(input: string): FormatResult {
  const errors: string[] = [];

  if (!input.trim()) {
    return { formatted: '', errors: ['Empty input.'], operationType: null, operationName: null, fieldsCount: 0 };
  }

  const tokens = tokenize(input);
  if (tokens.length === 0) {
    return { formatted: '', errors: ['No tokens found.'], operationType: null, operationName: null, fieldsCount: 0 };
  }

  let indent = 0;
  let formatted = '';
  let prevToken = '';
  let fieldsCount = 0;
  let operationType: string | null = null;
  let operationName: string | null = null;

  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i] ?? '';

    if (tok === '{') {
      formatted += ' {\n';
      indent++;
      prevToken = tok;
      continue;
    }
    if (tok === '}') {
      indent = Math.max(0, indent - 1);
      formatted += '\n' + '  '.repeat(indent) + '}';
      if (i < tokens.length - 1) formatted += '\n';
      prevToken = tok;
      continue;
    }
    if (tok === '(' || tok === '[') {
      formatted += tok;
      prevToken = tok;
      continue;
    }
    if (tok === ')' || tok === ']') {
      formatted += tok;
      prevToken = tok;
      continue;
    }
    if (tok === ':') {
      formatted += ': ';
      prevToken = tok;
      continue;
    }
    if (tok === ',') {
      formatted += ', ';
      prevToken = tok;
      continue;
    }
    if (tok === '!') {
      formatted += '!';
      prevToken = tok;
      continue;
    }
    if (tok === '=') {
      formatted += ' = ';
      prevToken = tok;
      continue;
    }

    if (prevToken === '' || prevToken === '{' || prevToken === '}' || prevToken === '\n') {
      if (prevToken !== '') formatted += '  '.repeat(indent);
      formatted += tok;
    } else if (prevToken === '(' || prevToken === '[' || prevToken === ':' || prevToken === '=' || prevToken === ',' || prevToken === '@' || prevToken === '$' || prevToken === '&') {
      formatted += tok;
    } else {
      formatted += '\n' + '  '.repeat(indent) + tok;
    }

    if ((tok === 'query' || tok === 'mutation' || tok === 'subscription') && (prevToken === '' || prevToken === '{' || prevToken === '}')) {
      operationType = tok;
      const next = tokens[i + 1];
      if (next && next !== '{' && next !== '(') {
        operationName = next;
      }
    }

    if (tok !== 'query' && tok !== 'mutation' && tok !== 'subscription' && tok !== '{' && tok !== '}' && tok !== '(' && tok !== ')' && tok !== '[' && tok !== ']' && tok !== ':' && tok !== ',' && tok !== '!' && tok !== '=' && tok !== '@' && tok !== '$' && tok !== '&') {
      const nextTok = tokens[i + 1] ?? '';
      if (nextTok === '{' || nextTok === '(' || nextTok === ':' || nextTok === ')') {
        // it's a field or argument
      } else if (nextTok === '' || nextTok === '}') {
        fieldsCount++;
      }
    }

    prevToken = tok;
  }

  if (indent !== 0) {
    errors.push('Unbalanced braces — check for missing } or {.');
  }

  return { formatted: formatted.trim(), errors, operationType, operationName, fieldsCount };
}

/* -------------------------------------------------------------------------- */
/* Composable                                                                  */
/* -------------------------------------------------------------------------- */

export interface UseGraphqlFormatterReturn {
  input: Ref<string>;
  result: ComputedRef<FormatResult>;
  reset: () => void;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
}

export function useGraphqlFormatter(): UseGraphqlFormatterReturn {
  const input = ref('');

  const result = computed(() => formatGraphql(input.value));

  function reset(): void {
    input.value = '';
  }

  const { isEmbed, input: embedInput } = useToolEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.input === 'string') input.value = p.input;
    },
    output: result,
    toOutput: () => ({ formatted: result.value.formatted, errors: result.value.errors }),
  });

  return { input, result, reset, isEmbed, embedInput };
}
