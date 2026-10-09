/**
 * useJsonSchemaValidator — composable + pure logic for validating JSON
 * instances against a JSON Schema (draft 2020-12 / draft-7).
 *
 * No external dependencies. Implements a subset of JSON Schema validation:
 * type, required, properties, items, enum, minimum, maximum, minLength,
 * maxLength, pattern, minItems, maxItems, additionalProperties.
 */
import { ref, computed, type ComputedRef, type Ref } from 'vue';
import { useToolEmbed } from '@/composables/useToolEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Types                                                                       */
/* -------------------------------------------------------------------------- */

export interface ValidationError {
  path: string;
  message: string;
}

export interface ValidationOutcome {
  valid: boolean;
  errors: ValidationError[];
  draft: string;
  schemaValid: boolean;
  schemaErrors: string[];
}

/* -------------------------------------------------------------------------- */
/* Pure logic                                                                  */
/* -------------------------------------------------------------------------- */

function checkType(value: unknown, type: string): boolean {
  if (type === 'string') return typeof value === 'string';
  if (type === 'number' || type === 'integer') {
    if (typeof value !== 'number') return false;
    if (type === 'integer') return Number.isInteger(value);
    return true;
  }
  if (type === 'boolean') return typeof value === 'boolean';
  if (type === 'null') return value === null;
  if (type === 'object') return typeof value === 'object' && value !== null && !Array.isArray(value);
  if (type === 'array') return Array.isArray(value);
  return false;
}

function validateAgainstSchema(
  instance: unknown,
  schema: Record<string, unknown>,
  path: string,
  errors: ValidationError[],
): void {
  const type = schema.type;
  if (typeof type === 'string' && !checkType(instance, type)) {
    errors.push({ path, message: `Expected type "${type}", got ${Array.isArray(instance) ? 'array' : typeof instance}.` });
    return;
  }
  if (Array.isArray(type)) {
    const matched = type.some((t) => checkType(instance, t));
    if (!matched) {
      errors.push({ path, message: `Expected one of types [${type.join(', ')}], got ${typeof instance}.` });
      return;
    }
  }

  if (schema.enum !== undefined) {
    if (!Array.isArray(schema.enum) || !schema.enum.includes(instance)) {
      errors.push({ path, message: `Value must be one of: ${JSON.stringify(schema.enum)}.` });
    }
  }

  if (typeof instance === 'string') {
    if (typeof schema.minLength === 'number' && instance.length < schema.minLength) {
      errors.push({ path, message: `String length ${instance.length} is less than minLength ${schema.minLength}.` });
    }
    if (typeof schema.maxLength === 'number' && instance.length > schema.maxLength) {
      errors.push({ path, message: `String length ${instance.length} exceeds maxLength ${schema.maxLength}.` });
    }
    if (typeof schema.pattern === 'string') {
      const re = new RegExp(schema.pattern);
      if (!re.test(instance)) {
        errors.push({ path, message: `String does not match pattern "${schema.pattern}".` });
      }
    }
  }

  if (typeof instance === 'number') {
    if (typeof schema.minimum === 'number' && instance < schema.minimum) {
      errors.push({ path, message: `Value ${instance} is less than minimum ${schema.minimum}.` });
    }
    if (typeof schema.maximum === 'number' && instance > schema.maximum) {
      errors.push({ path, message: `Value ${instance} exceeds maximum ${schema.maximum}.` });
    }
    if (typeof schema.exclusiveMinimum === 'number' && instance <= schema.exclusiveMinimum) {
      errors.push({ path, message: `Value ${instance} must be greater than ${schema.exclusiveMinimum}.` });
    }
    if (typeof schema.exclusiveMaximum === 'number' && instance >= schema.exclusiveMaximum) {
      errors.push({ path, message: `Value ${instance} must be less than ${schema.exclusiveMaximum}.` });
    }
  }

  if (Array.isArray(instance)) {
    if (typeof schema.minItems === 'number' && instance.length < schema.minItems) {
      errors.push({ path, message: `Array length ${instance.length} is less than minItems ${schema.minItems}.` });
    }
    if (typeof schema.maxItems === 'number' && instance.length > schema.maxItems) {
      errors.push({ path, message: `Array length ${instance.length} exceeds maxItems ${schema.maxItems}.` });
    }
    if (schema.items && typeof schema.items === 'object') {
      for (let i = 0; i < instance.length; i++) {
        validateAgainstSchema(instance[i], schema.items as Record<string, unknown>, `${path}[${i}]`, errors);
      }
    }
  }

  if (typeof instance === 'object' && instance !== null && !Array.isArray(instance)) {
    const obj = instance as Record<string, unknown>;
    const required = schema.required;
    if (Array.isArray(required)) {
      for (const req of required) {
        if (typeof req === 'string' && !(req in obj)) {
          errors.push({ path, message: `Missing required property: "${req}".` });
        }
      }
    }
    const properties = schema.properties;
    if (properties && typeof properties === 'object') {
      for (const key of Object.keys(properties as Record<string, unknown>)) {
        if (key in obj) {
          validateAgainstSchema(obj[key], (properties as Record<string, unknown>)[key] as Record<string, unknown>, `${path}.${key}`, errors);
        }
      }
    }
    if (schema.additionalProperties === false) {
      const propKeys = properties ? Object.keys(properties as Record<string, unknown>) : [];
      for (const key of Object.keys(obj)) {
        if (!propKeys.includes(key)) {
          errors.push({ path, message: `Additional property "${key}" is not allowed.` });
        }
      }
    }
  }
}

function detectDraft(schema: unknown): string {
  if (typeof schema !== 'object' || schema === null) return 'unknown';
  const id = (schema as Record<string, unknown>).$schema as string | undefined;
  if (typeof id === 'string') {
    if (id.includes('2020-12')) return 'draft 2020-12';
    if (id.includes('draft-07')) return 'draft-07';
    if (id.includes('draft-06')) return 'draft-06';
    if (id.includes('draft-04')) return 'draft-04';
    return id;
  }
  return 'draft 2020-12 (default)';
}

function validateSchemaObject(schema: unknown): { valid: boolean; errors: string[] } {
  if (typeof schema !== 'object' || schema === null) {
    return { valid: false, errors: ['Schema must be a JSON object.'] };
  }
  if (Array.isArray(schema)) {
    return { valid: false, errors: ['Schema cannot be an array.'] };
  }
  return { valid: true, errors: [] };
}

export function validateJsonSchema(
  instanceStr: string,
  schemaStr: string,
): ValidationOutcome {
  if (!instanceStr.trim()) {
    return { valid: false, errors: [{ path: '$', message: 'Empty instance.' }], draft: 'unknown', schemaValid: false, schemaErrors: [] };
  }
  if (!schemaStr.trim()) {
    return { valid: false, errors: [{ path: '$', message: 'Empty schema.' }], draft: 'unknown', schemaValid: false, schemaErrors: [] };
  }

  let instance: unknown;
  let schema: unknown;

  try {
    instance = JSON.parse(instanceStr);
  } catch (e) {
    return { valid: false, errors: [{ path: '$', message: `Instance JSON parse error: ${e instanceof Error ? e.message : String(e)}` }], draft: 'unknown', schemaValid: false, schemaErrors: [] };
  }

  try {
    schema = JSON.parse(schemaStr);
  } catch (e) {
    return { valid: false, errors: [{ path: '$', message: `Schema JSON parse error: ${e instanceof Error ? e.message : String(e)}` }], draft: 'unknown', schemaValid: false, schemaErrors: [] };
  }

  const schemaCheck = validateSchemaObject(schema);
  if (!schemaCheck.valid) {
    return { valid: false, errors: [], draft: 'unknown', schemaValid: false, schemaErrors: schemaCheck.errors };
  }

  const draft = detectDraft(schema);
  const errors: ValidationError[] = [];
  validateAgainstSchema(instance, schema as Record<string, unknown>, '$', errors);

  return { valid: errors.length === 0, errors, draft, schemaValid: true, schemaErrors: [] };
}

/* -------------------------------------------------------------------------- */
/* Composable                                                                  */
/* -------------------------------------------------------------------------- */

export interface UseJsonSchemaValidatorReturn {
  instanceInput: Ref<string>;
  schemaInput: Ref<string>;
  result: ComputedRef<ValidationOutcome>;
  reset: () => void;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
}

export function useJsonSchemaValidator(): UseJsonSchemaValidatorReturn {
  const instanceInput = ref('');
  const schemaInput = ref('');

  const result = computed(() => validateJsonSchema(instanceInput.value, schemaInput.value));

  function reset(): void {
    instanceInput.value = '';
    schemaInput.value = '';
  }

  const { isEmbed, input: embedInput } = useToolEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.instance === 'string') instanceInput.value = p.instance;
      if (typeof p.schema === 'string') schemaInput.value = p.schema;
    },
    output: result,
    toOutput: () => ({ valid: result.value.valid, errorCount: result.value.errors.length }),
  });

  return { instanceInput, schemaInput, result, reset, isEmbed, embedInput };
}
