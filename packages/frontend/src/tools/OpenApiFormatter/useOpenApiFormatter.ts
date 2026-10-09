/**
 * useOpenApiFormatter — composable + pure logic for pretty-printing and
 * validating OpenAPI 3.x specs in JSON or YAML.
 *
 * No external dependencies.
 */
import { ref, computed, type ComputedRef, type Ref } from 'vue';
import { useToolEmbed } from '@/composables/useToolEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Types                                                                       */
/* -------------------------------------------------------------------------- */

export type InputFormat = 'json' | 'yaml' | 'auto';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  openapiVersion: string | null;
  title: string | null;
  pathsCount: number;
  formatted: string;
}

/* -------------------------------------------------------------------------- */
/* Pure logic                                                                  */
/* -------------------------------------------------------------------------- */

function detectFormat(input: string): 'json' | 'yaml' {
  const trimmed = input.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return 'json';
  return 'yaml';
}

function tryParseJson(input: string): { ok: true; data: unknown } | { ok: false; error: string } {
  try {
    return { ok: true, data: JSON.parse(input) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

function simpleYamlToJson(input: string): { ok: true; data: unknown } | { ok: false; error: string } {
  try {
    const lines = input.split('\n');
    const result: Record<string, unknown> = {};
    const stack: { indent: number; obj: Record<string, unknown> }[] = [{ indent: -1, obj: result }];

    for (const line of lines) {
      if (!line.trim() || line.trim().startsWith('#')) continue;
      const indent = line.length - line.trimStart().length;
      const content = line.trim();

      while (stack.length > 1 && indent <= (stack[stack.length - 1]?.indent ?? -1)) {
        stack.pop();
      }

      const parent = stack[stack.length - 1];
      if (!parent) continue;

      if (content.includes(':')) {
        const colonIdx = content.indexOf(':');
        const key = content.slice(0, colonIdx).trim().replace(/^["']|["']$/g, '');
        const value = content.slice(colonIdx + 1).trim().replace(/^["']|["']$/g, '');

        if (value === '' || value === '|' || value === '>') {
          const newObj: Record<string, unknown> = {};
          parent.obj[key] = newObj;
          stack.push({ indent, obj: newObj });
        } else {
          let parsedValue: unknown = value;
          if (value === 'true') parsedValue = true;
          else if (value === 'false') parsedValue = false;
          else if (value === 'null') parsedValue = null;
          else if (/^-?\d+$/.test(value)) parsedValue = parseInt(value, 10);
          else if (/^-?\d+\.\d+$/.test(value)) parsedValue = parseFloat(value);
          parent.obj[key] = parsedValue;
        }
      } else if (content.startsWith('- ')) {
        const value = content.slice(2).trim().replace(/^["']|["']$/g, '');
        const arr = parent.obj[parent.obj ? Object.keys(parent.obj).pop() ?? '' : ''] as unknown[];
        if (Array.isArray(arr)) {
          arr.push(value);
        }
      }
    }

    return { ok: true, data: result };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

function countPaths(data: unknown): number {
  if (typeof data !== 'object' || data === null) return 0;
  const paths = (data as Record<string, unknown>).paths;
  if (typeof paths !== 'object' || paths === null) return 0;
  return Object.keys(paths).length;
}

function getVersion(data: unknown): string | null {
  if (typeof data !== 'object' || data === null) return null;
  const ver = (data as Record<string, unknown>).openapi;
  if (typeof ver === 'string') return ver;
  const swagger = (data as Record<string, unknown>).swagger;
  if (typeof swagger === 'string') return `Swagger ${swagger}`;
  return null;
}

function getTitle(data: unknown): string | null {
  if (typeof data !== 'object' || data === null) return null;
  const info = (data as Record<string, unknown>).info;
  if (typeof info !== 'object' || info === null) return null;
  const title = (info as Record<string, unknown>).title;
  return typeof title === 'string' ? title : null;
}

export function validateOpenApi(input: string, format: InputFormat): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!input.trim()) {
    return { valid: false, errors: ['Empty input.'], warnings: [], openapiVersion: null, title: null, pathsCount: 0, formatted: '' };
  }

  const actualFormat = format === 'auto' ? detectFormat(input) : format;
  let data: unknown = null;

  if (actualFormat === 'json') {
    const parsed = tryParseJson(input);
    if (!parsed.ok) {
      errors.push(`JSON parse error: ${parsed.error}`);
      return { valid: false, errors, warnings, openapiVersion: null, title: null, pathsCount: 0, formatted: '' };
    }
    data = parsed.data;
  } else {
    const parsed = simpleYamlToJson(input);
    if (!parsed.ok) {
      errors.push(`YAML parse error: ${parsed.error}`);
      return { valid: false, errors, warnings, openapiVersion: null, title: null, pathsCount: 0, formatted: '' };
    }
    data = parsed.data;
  }

  const version = getVersion(data);
  const title = getTitle(data);
  const pathsCount = countPaths(data);

  if (!version) {
    warnings.push('No "openapi" or "swagger" field found. Is this a valid OpenAPI spec?');
  }
  if (pathsCount === 0) {
    warnings.push('No paths defined in the spec.');
  }

  let formatted: string;
  try {
    formatted = JSON.stringify(data, null, 2);
  } catch {
    formatted = input;
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    openapiVersion: version,
    title,
    pathsCount,
    formatted,
  };
}

/* -------------------------------------------------------------------------- */
/* Composable                                                                  */
/* -------------------------------------------------------------------------- */

export interface UseOpenApiFormatterReturn {
  input: Ref<string>;
  format: Ref<InputFormat>;
  result: ComputedRef<ValidationResult>;
  reset: () => void;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
}

export function useOpenApiFormatter(): UseOpenApiFormatterReturn {
  const input = ref('');
  const format = ref<InputFormat>('auto');

  const result = computed(() => validateOpenApi(input.value, format.value));

  function reset(): void {
    input.value = '';
    format.value = 'auto';
  }

  const { isEmbed, input: embedInput } = useToolEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.input === 'string') input.value = p.input;
    },
    output: result,
    toOutput: () => ({ valid: result.value.valid, formatted: result.value.formatted }),
  });

  return { input, format, result, reset, isEmbed, embedInput };
}
