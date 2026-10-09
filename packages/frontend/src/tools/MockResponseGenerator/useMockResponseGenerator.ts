/**
 * useMockResponseGenerator — composable + pure logic for generating mock JSON
 * from schema, template, or faker-style patterns.
 *
 * No external dependencies.
 */
import { ref, computed, type ComputedRef, type Ref } from 'vue';
import { useToolEmbed } from '@/composables/useToolEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Types                                                                       */
/* -------------------------------------------------------------------------- */

export type GenerationMode = 'schema' | 'template' | 'random';

export interface MockConfig {
  mode: GenerationMode;
  input: string;
  count: number;
  indent: number;
}

/* -------------------------------------------------------------------------- */
/* Pure logic                                                                  */
/* -------------------------------------------------------------------------- */

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function randomString(length: number): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[randomInt(0, chars.length - 1)];
  }
  return result;
}

function randomEmail(): string {
  return `${randomString(randomInt(5, 10))}@${randomString(randomInt(4, 8))}.com`;
}

function randomUuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function randomDate(): string {
  return new Date(randomInt(946684800000, 1893456000000)).toISOString();
}

function randomBool(): boolean {
  return Math.random() > 0.5;
}

function generateFromSchema(schema: unknown): unknown {
  if (typeof schema !== 'object' || schema === null) return schema;

  if (Array.isArray(schema)) {
    return schema.length > 0 ? [generateFromSchema(schema[0])] : [];
  }

  const obj = schema as Record<string, unknown>;
  const type = obj.type as string | undefined;
  const mockType = obj.mock as string | undefined;
  const fakerTag = obj.faker as string | undefined;

  if (type === 'object' && obj.properties) {
    const props = obj.properties as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(props)) {
      result[key] = generateFromSchema(props[key]);
    }
    return result;
  }

  if (type === 'array' && obj.items) {
    const count = typeof obj.minItems === 'number' ? obj.minItems : 1;
    return Array.from({ length: count }, () => generateFromSchema(obj.items));
  }

  if (type === 'string') {
    if (fakerTag === 'email' || mockType === 'email') return randomEmail();
    if (fakerTag === 'uuid' || mockType === 'uuid') return randomUuid();
    if (fakerTag === 'date' || mockType === 'date') return randomDate();
    if (fakerTag === 'name' || mockType === 'name') return randomString(randomInt(5, 12));
    if (fakerTag === 'boolean' || mockType === 'boolean') return randomBool();
    if (typeof obj.format === 'string' && obj.format === 'email') return randomEmail();
    if (typeof obj.format === 'string' && obj.format === 'uuid') return randomUuid();
    if (typeof obj.format === 'string' && obj.format === 'date-time') return randomDate();
    if (typeof obj.enum === 'object' && Array.isArray(obj.enum)) return obj.enum[randomInt(0, obj.enum.length - 1)];
    return randomString(typeof obj.maxLength === 'number' ? Math.min(obj.maxLength, 20) : 10);
  }

  if (type === 'integer' || type === 'number') {
    const min = typeof obj.minimum === 'number' ? obj.minimum : 0;
    const max = typeof obj.maximum === 'number' ? obj.maximum : 1000;
    return type === 'integer' ? randomInt(min, max) : Math.round(randomFloat(min, max) * 100) / 100;
  }

  if (type === 'boolean') return randomBool();

  if (obj.example !== undefined) return obj.example;
  if (obj.default !== undefined) return obj.default;

  return null;
}

function generateFromTemplate(template: unknown): unknown {
  if (typeof template === 'string') {
    return template
      .replace(/\{\{randomInt\((\d+),\s*(\d+)\)\}\}/g, (_, min, max) => String(randomInt(parseInt(min), parseInt(max))))
      .replace(/\{\{randomString\((\d+)\)\}\}/g, (_, len) => randomString(parseInt(len)))
      .replace(/\{\{randomEmail\}\}/g, randomEmail())
      .replace(/\{\{randomUuid\}\}/g, randomUuid())
      .replace(/\{\{randomDate\}\}/g, randomDate())
      .replace(/\{\{randomBool\}\}/g, String(randomBool()))
      .replace(/\{\{randomFloat\((\d+),\s*(\d+)\)\}\}/g, (_, min, max) => String(Math.round(randomFloat(parseInt(min), parseInt(max)) * 100) / 100));
  }
  if (Array.isArray(template)) {
    return template.map((item) => generateFromTemplate(item));
  }
  if (typeof template === 'object' && template !== null) {
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(template)) {
      result[key] = generateFromTemplate((template as Record<string, unknown>)[key]);
    }
    return result;
  }
  return template;
}

function generateRandomData(count: number): unknown[] {
  const items: unknown[] = [];
  for (let i = 0; i < count; i++) {
    items.push({
      id: randomUuid(),
      name: randomString(randomInt(5, 12)),
      email: randomEmail(),
      active: randomBool(),
      score: randomInt(0, 100),
      createdAt: randomDate(),
    });
  }
  return items;
}

export function generateMock(config: MockConfig): { output: string; error: string } {
  if (!config.input.trim() && config.mode !== 'random') {
    return { output: '', error: 'Empty input.' };
  }

  try {
    let data: unknown;

    if (config.mode === 'schema') {
      const schema = JSON.parse(config.input);
      data = generateFromSchema(schema);
    } else if (config.mode === 'template') {
      const template = JSON.parse(config.input);
      data = generateFromTemplate(template);
    } else {
      data = generateRandomData(config.count);
    }

    return { output: JSON.stringify(data, null, config.indent), error: '' };
  } catch (e) {
    return { output: '', error: e instanceof Error ? e.message : String(e) };
  }
}

/* -------------------------------------------------------------------------- */
/* Composable                                                                  */
/* -------------------------------------------------------------------------- */

export interface UseMockResponseGeneratorReturn {
  config: Ref<MockConfig>;
  output: ComputedRef<string>;
  error: ComputedRef<string>;
  reset: () => void;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
}

export interface MockResult {
  output: string;
  error: string;
}

export function useMockResponseGenerator(): UseMockResponseGeneratorReturn {
  const config = ref<MockConfig>({
    mode: 'random',
    input: '',
    count: 5,
    indent: 2,
  });

  const mockResult = computed(() => generateMock(config.value));
  const output = computed(() => mockResult.value.output);
  const error = computed(() => mockResult.value.error);

  function reset(): void {
    config.value = { mode: 'random', input: '', count: 5, indent: 2 };
  }

  const { isEmbed, input: embedInput } = useToolEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.input === 'string') config.value.input = p.input;
      if (typeof p.mode === 'string') config.value.mode = p.mode as GenerationMode;
    },
    output: mockResult,
    toOutput: () => ({ output: mockResult.value.output }),
  });

  return { config, output, error, reset, isEmbed, embedInput };
}
