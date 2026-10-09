/**
 * useIcuMessageFormatBuilder - composable + pure logic for ICU MessageFormat.
 *
 * Implements a simplified ICU MessageFormat parser/renderer that supports:
 *   - Simple argument substitution: `{name}`
 *   - Plural: `{count, plural, =0{...} one{...} other{...}}`
 *   - Select: `{gender, select, male{...} female{...} other{...}}`
 *   - Number formatting: `{value, number}`
 *   - Date formatting: `{date, date}`
 *   - Nested messages inside plural/select branches
 *
 * No external dependencies - uses Intl.NumberFormat and Intl.DateTimeFormat.
 */
import { ref, watch, type Ref } from 'vue';
import { useToolEmbed } from '@/composables/useToolEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

export interface IcuVariable {
  name: string;
  value: string;
}

export interface IcuRenderResult {
  output: string;
  error: string | null;
  parsedAst: string | null;
}

export interface UseIcuMessageFormatBuilderReturn {
  message: Ref<string>;
  locale: Ref<string>;
  variables: Ref<IcuVariable[]>;
  result: Ref<IcuRenderResult>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  reset: () => void;
  addVariable: () => void;
  removeVariable: (index: number) => void;
}

/* -------------------------------------------------------------------------- */
/* Pure logic - ICU MessageFormat parser                                      */
/* -------------------------------------------------------------------------- */

/** AST node types for the parsed message. */
type AstNode =
  | { type: 'text'; value: string }
  | { type: 'arg'; name: string; argType?: string; options?: Record<string, AstNode[]> };

/**
 * Parse an ICU MessageFormat string into an AST.
 * Supports `{name}`, `{name, type}`, `{name, plural, ...}`, `{name, select, ...}`.
 */
export function parseIcuMessage(message: string): { ast: AstNode[]; error: string | null } {
  if (!message) return { ast: [{ type: 'text', value: '' }], error: null };

  try {
    const parser = new IcuParser(message);
    const ast = parser.parseTopLevel();
    if (parser.pos < parser.src.length) {
      return { ast, error: `Unexpected character at position ${parser.pos}` };
    }
    return { ast, error: null };
  } catch (e) {
    return {
      ast: [{ type: 'text', value: '' }],
      error: e instanceof Error ? e.message : 'Parse error',
    };
  }
}

class IcuParser {
  pos = 0;
  readonly src: string;

  constructor(src: string) {
    this.src = src;
  }

  parseTopLevel(): AstNode[] {
    return this.parseText('}');
  }

  private parseText(stopChar: string): AstNode[] {
    const nodes: AstNode[] = [];
    let text = '';

    while (this.pos < this.src.length) {
      const ch = this.src[this.pos];

      if (ch === '{') {
        if (text) {
          nodes.push({ type: 'text', value: text });
          text = '';
        }
        this.pos++;
        nodes.push(this.parseArg());
      } else if (ch === stopChar) {
        break;
      } else if (ch === '#' && stopChar === '}') {
        // In plural/select branches, # is a placeholder for the count
        if (text) {
          nodes.push({ type: 'text', value: text });
          text = '';
        }
        nodes.push({ type: 'text', value: '#' });
        this.pos++;
      } else {
        text += ch;
        this.pos++;
      }
    }

    if (text) nodes.push({ type: 'text', value: text });
    return nodes;
  }

  private parseArg(): AstNode {
    this.skipWhitespace();
    const name = this.readIdentifier();
    if (!name) throw new Error(`Expected argument name at position ${this.pos}`);

    this.skipWhitespace();

    if (this.peek() === '}') {
      this.pos++;
      return { type: 'arg', name };
    }

    if (this.peek() !== ',') throw new Error(`Expected ',' or '}' at position ${this.pos}`);
    this.pos++;
    this.skipWhitespace();

    const argType = this.readIdentifier();
    if (!argType) throw new Error(`Expected argument type at position ${this.pos}`);

    this.skipWhitespace();

    if (argType === 'plural' || argType === 'select') {
      const options: Record<string, AstNode[]> = {};
      while (this.peek() !== '}') {
        this.skipWhitespace();
        const selector = this.readSelector();
        if (!selector) throw new Error(`Expected selector at position ${this.pos}`);
        this.skipWhitespace();
        if (this.peek() !== '{') throw new Error(`Expected '{' after selector at position ${this.pos}`);
        this.pos++;
        const branch = this.parseText('}');
        if (this.peek() !== '}') throw new Error(`Expected '}' at position ${this.pos}`);
        this.pos++;
        options[selector] = branch;
        this.skipWhitespace();
      }
      if (this.peek() !== '}') throw new Error(`Expected '}' at position ${this.pos}`);
      this.pos++;
      return { type: 'arg', name, argType, options };
    }

    // Simple typed arg: {name, number} or {name, date}
    if (this.peek() !== '}') throw new Error(`Expected '}' at position ${this.pos}`);
    this.pos++;
    return { type: 'arg', name, argType };
  }

  private readIdentifier(): string {
    let result = '';
    while (this.pos < this.src.length) {
      const ch = this.src[this.pos] ?? '';
      if (/[a-zA-Z0-9_]/.test(ch)) {
        result += ch;
        this.pos++;
      } else break;
    }
    return result;
  }

  private readSelector(): string {
    let result = '';
    while (this.pos < this.src.length) {
      const ch = this.src[this.pos] ?? '';
      if (ch === '{' || ch === '}' || ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') break;
      result += ch;
      this.pos++;
    }
    return result;
  }

  private skipWhitespace(): void {
    while (this.pos < this.src.length && /\s/.test(this.src[this.pos] ?? '')) this.pos++;
  }

  private peek(): string {
    return this.src[this.pos] ?? '';
  }
}

/**
 * Render a parsed ICU MessageFormat AST with the given variables and locale.
 */
export function renderIcuMessage(
  ast: AstNode[],
  vars: Record<string, string>,
  locale: string,
): string {
  return ast.map((node) => renderNode(node, vars, locale)).join('');
}

function renderNode(node: AstNode, vars: Record<string, string>, locale: string): string {
  if (node.type === 'text') return node.value;

  // arg node
  const rawValue = vars[node.name] ?? '';
  const numValue = Number(rawValue);

  if (!node.argType) {
    return rawValue;
  }

  if (node.argType === 'number') {
    if (!Number.isFinite(numValue)) return rawValue;
    return new Intl.NumberFormat(locale).format(numValue);
  }

  if (node.argType === 'date') {
    const date = new Date(rawValue);
    if (isNaN(date.getTime())) return rawValue;
    return new Intl.DateTimeFormat(locale).format(date);
  }

  if (node.argType === 'plural') {
    if (!Number.isFinite(numValue)) return rawValue;
    const category = selectPluralCategory(numValue, locale);
    // Check exact match selectors (=0, =1, etc.)
    const exactKey = `=${numValue}`;
    const branch = node.options?.[exactKey] ?? node.options?.[category] ?? node.options?.['other'];
    if (!branch) return '';
    return branch
      .map((n) => renderNode(n, vars, locale))
      .join('')
      .replace(/#/g, new Intl.NumberFormat(locale).format(numValue));
  }

  if (node.argType === 'select') {
    const branch = node.options?.[rawValue] ?? node.options?.['other'];
    if (!branch) return '';
    return branch.map((n) => renderNode(n, vars, locale)).join('');
  }

  return rawValue;
}

function selectPluralCategory(n: number, locale: string): string {
  try {
    const pr = new Intl.PluralRules(locale);
    return pr.select(n);
  } catch {
    return n === 1 ? 'one' : 'other';
  }
}

/** Format the AST as a readable string for debugging. */
export function astToString(ast: AstNode[], indent = 0): string {
  const pad = '  '.repeat(indent);
  return ast
    .map((node) => {
      if (node.type === 'text') return `${pad}text(${JSON.stringify(node.value)})`;
      if (!node.argType) return `${pad}arg(${node.name})`;
      if (node.options) {
        const opts = Object.entries(node.options)
          .map(([k, v]) => `${pad}  ${k}:\n${astToString(v, indent + 2)}`)
          .join('\n');
        return `${pad}${node.argType}(${node.name}):\n${opts}`;
      }
      return `${pad}${node.argType}(${node.name})`;
    })
    .join('\n');
}

/* -------------------------------------------------------------------------- */
/* Composable                                                                  */
/* -------------------------------------------------------------------------- */

const DEFAULT_MESSAGE = `{count, plural, =0 {No items} one {# item} other {# items}}`;
const DEFAULT_LOCALE = 'en';

export function useIcuMessageFormatBuilder(): UseIcuMessageFormatBuilderReturn {
  const message = ref<string>(DEFAULT_MESSAGE);
  const locale = ref<string>(DEFAULT_LOCALE);
  const variables = ref<IcuVariable[]>([
    { name: 'count', value: '0' },
  ]);
  const result = ref<IcuRenderResult>({ output: '', error: null, parsedAst: null });

  function recompute(): void {
    const { ast, error } = parseIcuMessage(message.value);
    if (error) {
      result.value = { output: '', error, parsedAst: null };
      return;
    }

    const vars: Record<string, string> = {};
    for (const v of variables.value) {
      if (v.name.trim()) vars[v.name.trim()] = v.value;
    }

    const output = renderIcuMessage(ast, vars, locale.value);
    result.value = {
      output,
      error: null,
      parsedAst: astToString(ast),
    };
  }

  function reset(): void {
    message.value = DEFAULT_MESSAGE;
    locale.value = DEFAULT_LOCALE;
    variables.value = [{ name: 'count', value: '0' }];
    recompute();
  }

  function addVariable(): void {
    variables.value.push({ name: '', value: '' });
  }

  function removeVariable(index: number): void {
    variables.value.splice(index, 1);
  }

  watch([message, locale, variables], () => recompute(), { deep: true });
  recompute();

  const { isEmbed, input: embedInput } = useToolEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.message === 'string') message.value = p.message;
      if (typeof p.locale === 'string') locale.value = p.locale;
      if (Array.isArray(p.variables)) {
        variables.value = (p.variables as IcuVariable[]).filter(
          (v) => v && typeof v.name === 'string' && typeof v.value === 'string',
        );
      }
    },
    output: result,
    toOutput: () => ({
      output: result.value.output,
      error: result.value.error,
    }),
  });

  return {
    message,
    locale,
    variables,
    result,
    isEmbed,
    embedInput,
    reset,
    addVariable,
    removeVariable,
  };
}
