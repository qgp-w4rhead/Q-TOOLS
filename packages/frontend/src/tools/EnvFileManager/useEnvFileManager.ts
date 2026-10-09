/**
 * useEnvFileManager - composable + pure logic for the .env file manager.
 *
 * Supports:
 *   - .env → JSON conversion (parseEnvFile)
 *   - JSON → .env conversion (jsonToEnvString)
 *   - Diff two .env files (diffEnvFiles)
 *   - Merge two .env files (mergeEnvFiles)
 *   - Quote handling, duplicate key detection
 *
 * No external dependencies.
 */
import { computed, ref, type ComputedRef, type Ref } from 'vue';
import { useToolEmbed } from '@/composables/useToolEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Types - pure logic                                                         */
/* -------------------------------------------------------------------------- */

export interface EnvEntry {
  key: string;
  value: string;
  quoted: boolean;
  comment: string;
}

export interface EnvParseResult {
  entries: EnvEntry[];
  duplicates: string[];
  errors: string[];
}

export type EnvMode = 'env-to-json' | 'json-to-env' | 'diff' | 'merge';

/* -------------------------------------------------------------------------- */
/* Pure logic - parsing & serialisation                                       */
/* -------------------------------------------------------------------------- */

export function parseEnvFile(text: string): EnvParseResult {
  const lines = text.split('\n');
  const entries: EnvEntry[] = [];
  const seen = new Map<string, number>();
  const duplicates: string[] = [];
  const errors: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i] ?? '';
    const line = raw.trim();

    if (line === '' || line.startsWith('#')) continue;

    const eqIdx = line.indexOf('=');
    if (eqIdx === -1) {
      errors.push(`Line ${i + 1}: missing '=' separator`);
      continue;
    }

    const key = line.slice(0, eqIdx).trim();
    let value = line.slice(eqIdx + 1);
    let comment = '';

    const hashIdx = value.indexOf(' #');
    if (hashIdx !== -1) {
      comment = value.slice(hashIdx + 1).trim();
      value = value.slice(0, hashIdx);
    }

    value = value.trim();

    let quoted = false;
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      quoted = true;
      value = value.slice(1, -1);
    }

    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      errors.push(`Line ${i + 1}: invalid key "${key}"`);
    }

    if (seen.has(key)) {
      duplicates.push(key);
    }
    seen.set(key, entries.length);

    entries.push({ key, value, quoted, comment });
  }

  return { entries, duplicates, errors };
}

export function envEntriesToJson(entries: EnvEntry[]): string {
  const obj: Record<string, string> = {};
  for (const e of entries) {
    obj[e.key] = e.value;
  }
  return JSON.stringify(obj, null, 2);
}

export function jsonToEnvString(jsonText: string): { output: string; errors: string[] } {
  const errors: string[] = [];
  let obj: Record<string, unknown>;
  try {
    obj = JSON.parse(jsonText);
  } catch {
    errors.push('Invalid JSON input');
    return { output: '', errors };
  }

  const lines: string[] = [];
  for (const [key, val] of Object.entries(obj)) {
    const strVal = String(val);
    const needsQuoting = strVal.includes(' ') || strVal.includes('#') || strVal === '';
    if (needsQuoting) {
      lines.push(`${key}="${strVal}"`);
    } else {
      lines.push(`${key}=${strVal}`);
    }
  }
  return { output: lines.join('\n'), errors };
}

export function diffEnvFiles(a: string, b: string): string {
  const resultA = parseEnvFile(a);
  const resultB = parseEnvFile(b);
  const mapA = new Map(resultA.entries.map((e) => [e.key, e.value]));
  const mapB = new Map(resultB.entries.map((e) => [e.key, e.value]));

  const allKeys = new Set([...mapA.keys(), ...mapB.keys()]);
  const lines: string[] = [];

  for (const key of allKeys) {
    const valA = mapA.get(key);
    const valB = mapB.get(key);

    if (valA === undefined && valB !== undefined) {
      lines.push(`+ ${key}=${valB}`);
    } else if (valA !== undefined && valB === undefined) {
      lines.push(`- ${key}=${valA}`);
    } else if (valA !== valB) {
      lines.push(`- ${key}=${valA}`);
      lines.push(`+ ${key}=${valB}`);
    }
  }

  return lines.length > 0 ? lines.join('\n') : 'No differences found.';
}

export function mergeEnvFiles(a: string, b: string): string {
  const resultA = parseEnvFile(a);
  const resultB = parseEnvFile(b);
  const merged = new Map<string, EnvEntry>();

  for (const e of resultA.entries) {
    merged.set(e.key, e);
  }
  for (const e of resultB.entries) {
    merged.set(e.key, e);
  }

  const lines: string[] = [];
  for (const e of merged.values()) {
    const val = e.quoted || e.value.includes(' ') ? `"${e.value}"` : e.value;
    const comment = e.comment ? ` ${e.comment}` : '';
    lines.push(`${e.key}=${val}${comment}`);
  }
  return lines.join('\n');
}

export function envEntriesToString(entries: EnvEntry[]): string {
  const lines: string[] = [];
  for (const e of entries) {
    const val = e.quoted || e.value.includes(' ') ? `"${e.value}"` : e.value;
    const comment = e.comment ? ` ${e.comment}` : '';
    lines.push(`${e.key}=${val}${comment}`);
  }
  return lines.join('\n');
}

/* -------------------------------------------------------------------------- */
/* Composable - reactive state + embed integration                            */
/* -------------------------------------------------------------------------- */

export interface UseEnvFileManagerReturn {
  mode: Ref<EnvMode>;
  inputA: Ref<string>;
  inputB: Ref<string>;
  output: ComputedRef<string>;
  duplicates: ComputedRef<string[]>;
  errors: ComputedRef<string[]>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  reset: () => void;
}

export function useEnvFileManager(): UseEnvFileManagerReturn {
  const mode = ref<EnvMode>('env-to-json');
  const inputA = ref<string>('DATABASE_URL=postgres://localhost:5432/mydb\nPORT=3000\nNODE_ENV=production\nSECRET_KEY="my secret value"');
  const inputB = ref<string>('DATABASE_URL=postgres://remote:5432/mydb\nPORT=8080\nLOG_LEVEL=debug');

  const output = computed(() => {
    switch (mode.value) {
      case 'env-to-json': {
        const result = parseEnvFile(inputA.value);
        return envEntriesToJson(result.entries);
      }
      case 'json-to-env': {
        return jsonToEnvString(inputA.value).output;
      }
      case 'diff': {
        return diffEnvFiles(inputA.value, inputB.value);
      }
      case 'merge': {
        return mergeEnvFiles(inputA.value, inputB.value);
      }
      default:
        return '';
    }
  });

  const duplicates = computed(() => {
    if (mode.value === 'env-to-json' || mode.value === 'merge') {
      return parseEnvFile(inputA.value).duplicates;
    }
    return [];
  });

  const errors = computed(() => {
    if (mode.value === 'env-to-json') {
      return parseEnvFile(inputA.value).errors;
    }
    if (mode.value === 'json-to-env') {
      return jsonToEnvString(inputA.value).errors;
    }
    return [];
  });

  function reset(): void {
    mode.value = 'env-to-json';
    inputA.value = '';
    inputB.value = '';
  }

  const { isEmbed, input: embedInput } = useToolEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.mode === 'string') {
        mode.value = p.mode as EnvMode;
      }
      if (typeof p.input === 'string' || typeof p.input === 'number') {
        inputA.value = String(p.input);
      }
      if (typeof p.inputA === 'string') {
        inputA.value = p.inputA;
      }
      if (typeof p.inputB === 'string') {
        inputB.value = p.inputB;
      }
    },
    output,
    toOutput: () => ({ mode: mode.value, output: output.value }),
  });

  return {
    mode,
    inputA,
    inputB,
    output,
    duplicates,
    errors,
    isEmbed,
    embedInput,
    reset,
  };
}
