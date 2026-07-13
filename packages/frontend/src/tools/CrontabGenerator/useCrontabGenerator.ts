/**
 * useCrontabGenerator — composable + pure logic for the Crontab generator tool.
 *
 * A visual cron expression builder covering the five standard Vixie-cron
 * fields: minute, hour, day-of-month, month, day-of-week. Each field supports
 * the common cron syntax primitives:
 *
 *   - `*`           every value (every minute / hour / day / month / weekday)
 *   - `a,b,c`       a list of specific values
 *   - `a-b`         a range (inclusive)
 *   - `a-b/N`       every Nth value inside a range (stepped range)
 *   - `star/N`      every Nth value across the whole field range
 *   - `N`           a single specific value
 *
 * The pure helpers (`buildCronExpression`, `describeField`, `describeCron`,
 * `parseField`, `validateField`) have no Vue dependency and can be imported
 * standalone for unit testing or reuse. The `useCrontabGenerator()` composable
 * wraps them in reactive state and wires up the embed PostMessage protocol.
 *
 * No external dependencies.
 */
import { computed, ref, watch, type ComputedRef, type Ref } from 'vue';
import { useEmbed } from '@/composables/useEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Pure logic — no Vue dependency below this point                            */
/* -------------------------------------------------------------------------- */

/** The five Vixie-cron fields, in canonical order. */
export type CronFieldName =
  | 'minute'
  | 'hour'
  | 'dayOfMonth'
  | 'month'
  | 'dayOfWeek';

export const FIELD_ORDER: CronFieldName[] = [
  'minute',
  'hour',
  'dayOfMonth',
  'month',
  'dayOfWeek',
];

export interface CronFieldBounds {
  /** Inclusive minimum value. */
  min: number;
  /** Inclusive maximum value. */
  max: number;
  /** Human label, e.g. "Minute". */
  label: string;
  /** Short label used in the description, e.g. "minute". */
  unit: string;
  /** Plural unit, e.g. "minutes". */
  unitPlural: string;
  /** Names for each value (months / weekdays), or null for numeric fields. */
  names: string[] | null;
}

export const FIELD_BOUNDS: Record<CronFieldName, CronFieldBounds> = {
  minute: {
    min: 0,
    max: 59,
    label: 'Minute',
    unit: 'minute',
    unitPlural: 'minutes',
    names: null,
  },
  hour: {
    min: 0,
    max: 23,
    label: 'Hour',
    unit: 'hour',
    unitPlural: 'hours',
    names: null,
  },
  dayOfMonth: {
    min: 1,
    max: 31,
    label: 'Day of month',
    unit: 'day',
    unitPlural: 'days',
    names: null,
  },
  month: {
    min: 1,
    max: 12,
    label: 'Month',
    unit: 'month',
    unitPlural: 'months',
    names: [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ],
  },
  dayOfWeek: {
    // 0-6 (0 = Sunday) in standard cron. We display 0-6.
    min: 0,
    max: 6,
    label: 'Day of week',
    unit: 'weekday',
    unitPlural: 'weekdays',
    names: [
      'Sunday',
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
    ],
  },
};

/** How a single cron field is specified. */
export type CronFieldMode =
  | 'every' // `*`
  | 'specific' // a single value, or a comma list of values
  | 'range' // a-b
  | 'step' // */N (every N across the whole field range)
  | 'rangeStep'; // a-b/N (every N inside a range)

export interface CronFieldConfig {
  mode: CronFieldMode;
  /** Comma-separated list of specific values (mode === 'specific'). */
  values: number[];
  /** Range lower bound (modes 'range' / 'rangeStep'). */
  rangeStart: number;
  /** Range upper bound (modes 'range' / 'rangeStep'). */
  rangeEnd: number;
  /** Step value (modes 'step' / 'rangeStep'). Must be >= 1. */
  step: number;
}

export type CronFields = Record<CronFieldName, CronFieldConfig>;

/** Default config: every minute (`* * * * *`). */
export function defaultField(name: CronFieldName): CronFieldConfig {
  const b = FIELD_BOUNDS[name];
  return {
    mode: 'every',
    values: [b.min],
    rangeStart: b.min,
    rangeEnd: b.max,
    step: 1,
  };
}

export function defaultCronFields(): CronFields {
  return {
    minute: defaultField('minute'),
    hour: defaultField('hour'),
    dayOfMonth: defaultField('dayOfMonth'),
    month: defaultField('month'),
    dayOfWeek: defaultField('dayOfWeek'),
  };
}

export interface FieldValidation {
  ok: boolean;
  message: string;
}

/** Clamp a value into the field's inclusive range; NaN → min. */
export function clampValue(n: number, lo: number, hi: number): number {
  if (Number.isNaN(n)) return lo;
  return Math.min(hi, Math.max(lo, n));
}

/** Normalise a single field config against its bounds. */
export function normalizeField(
  name: CronFieldName,
  cfg: CronFieldConfig,
): CronFieldConfig {
  const b = FIELD_BOUNDS[name];
  const step = clampValue(cfg.step, 1, b.max - b.min + 1);
  const values = Array.from(new Set(cfg.values.map((v) => clampValue(v, b.min, b.max)))).sort(
    (a, z) => a - z,
  );
  let rangeStart = clampValue(cfg.rangeStart, b.min, b.max);
  let rangeEnd = clampValue(cfg.rangeEnd, b.min, b.max);
  if (rangeEnd < rangeStart) {
    const tmp = rangeStart;
    rangeStart = rangeEnd;
    rangeEnd = tmp;
  }
  return { mode: cfg.mode, values, rangeStart, rangeEnd, step };
}

/** Validate a single field config. */
export function validateField(
  name: CronFieldName,
  cfg: CronFieldConfig,
): FieldValidation {
  const b = FIELD_BOUNDS[name];
  if (cfg.step < 1) {
    return { ok: false, message: `${b.label}: step must be at least 1.` };
  }
  if (cfg.step > b.max - b.min + 1) {
    return { ok: false, message: `${b.label}: step exceeds the field range.` };
  }
  if (cfg.mode === 'specific') {
    if (cfg.values.length === 0) {
      return { ok: false, message: `${b.label}: select at least one value.` };
    }
    for (const v of cfg.values) {
      if (v < b.min || v > b.max) {
        return {
          ok: false,
          message: `${b.label}: value ${v} is out of range (${b.min}-${b.max}).`,
        };
      }
    }
  }
  if (cfg.mode === 'range' || cfg.mode === 'rangeStep') {
    if (cfg.rangeStart < b.min || cfg.rangeStart > b.max) {
      return {
        ok: false,
        message: `${b.label}: range start ${cfg.rangeStart} is out of range.`,
      };
    }
    if (cfg.rangeEnd < b.min || cfg.rangeEnd > b.max) {
      return {
        ok: false,
        message: `${b.label}: range end ${cfg.rangeEnd} is out of range.`,
      };
    }
    if (cfg.rangeEnd < cfg.rangeStart) {
      return {
        ok: false,
        message: `${b.label}: range end must be ≥ range start.`,
      };
    }
  }
  return { ok: true, message: '' };
}

/** Render a single field config as its cron expression fragment. */
export function buildFieldExpression(
  name: CronFieldName,
  cfg: CronFieldConfig,
): string {
  void name; // bounds not needed for rendering (values already normalised)
  switch (cfg.mode) {
    case 'every':
      return '*';
    case 'specific':
      return cfg.values.join(',');
    case 'range':
      return `${cfg.rangeStart}-${cfg.rangeEnd}`;
    case 'step':
      return `*/${cfg.step}`;
    case 'rangeStep':
      return `${cfg.rangeStart}-${cfg.rangeEnd}/${cfg.step}`;
    default: {
      // Exhaustiveness guard.
      const _exhaustive: never = cfg.mode;
      void _exhaustive;
      return '*';
    }
  }
}

/** Build the full 5-field cron expression from a config. */
export function buildCronExpression(fields: CronFields): string {
  return FIELD_ORDER.map((n) => buildFieldExpression(n, fields[n])).join(' ');
}

/** Format a single value using the field's names when available. */
function formatValue(name: CronFieldName, v: number): string {
  const b = FIELD_BOUNDS[name];
  if (b.names) return b.names[v - b.min] ?? String(v);
  return String(v);
}

/** Pluralise a count + unit. */
function plural(n: number, unit: string, plural: string): string {
  return `${n} ${n === 1 ? unit : plural}`;
}

/** Describe a single field in plain English. */
export function describeField(name: CronFieldName, cfg: CronFieldConfig): string {
  const b = FIELD_BOUNDS[name];
  switch (cfg.mode) {
    case 'every':
      return `every ${b.unit}`;
    case 'specific': {
      if (cfg.values.length === 1) {
        return `at ${b.unit} ${formatValue(name, cfg.values[0]!)}`;
      }
      const list = cfg.values.map((v) => formatValue(name, v)).join(', ');
      return `at ${b.unitPlural} ${list}`;
    }
    case 'range':
      return `from ${b.unit} ${formatValue(name, cfg.rangeStart)} to ${formatValue(
        name,
        cfg.rangeEnd,
      )}`;
    case 'step':
      return `every ${plural(cfg.step, b.unit, b.unitPlural)}`;
    case 'rangeStep':
      return `every ${plural(cfg.step, b.unit, b.unitPlural)} from ${formatValue(
        name,
        cfg.rangeStart,
      )} to ${formatValue(name, cfg.rangeEnd)}`;
    default: {
      const _exhaustive: never = cfg.mode;
      void _exhaustive;
      return `every ${b.unit}`;
    }
  }
}

/** Compose a full human-readable description of the cron expression. */
export function describeCron(fields: CronFields): string {
  const minute = describeField('minute', fields.minute);
  const hour = describeField('hour', fields.hour);
  const dom = describeField('dayOfMonth', fields.dayOfMonth);
  const month = describeField('month', fields.month);
  const dow = describeField('dayOfWeek', fields.dayOfWeek);

  // Special-case the canonical "every minute" form for clarity.
  if (
    fields.minute.mode === 'every' &&
    fields.hour.mode === 'every' &&
    fields.dayOfMonth.mode === 'every' &&
    fields.month.mode === 'every' &&
    fields.dayOfWeek.mode === 'every'
  ) {
    return 'Every minute, every hour, every day.';
  }

  // Common shortcut: every-X-minutes past every hour, every day.
  const parts: string[] = [];
  parts.push(minute);
  parts.push(hour);
  parts.push(dom);
  parts.push(month);
  parts.push(dow);
  // Capitalise the first letter.
  const joined = parts.join(', ');
  return joined.charAt(0).toUpperCase() + joined.slice(1) + '.';
}

/** Parse a cron expression fragment into a CronFieldConfig. */
export function parseField(name: CronFieldName, raw: string): CronFieldConfig {
  const b = FIELD_BOUNDS[name];
  const token = raw.trim();
  if (token === '' || token === '*') {
    return defaultField(name);
  }

  // Range with step: a-b/N
  if (token.includes('/') && token.includes('-')) {
    const [rangePart, stepPart] = token.split('/');
    const step = Number(stepPart);
    const [rs, re] = (rangePart ?? '').split('-');
    return {
      mode: 'rangeStep',
      values: [b.min],
      rangeStart: Number(rs),
      rangeEnd: Number(re),
      step: Number.isNaN(step) ? 1 : step,
    };
  }

  // Every-N step: */N
  if (token.startsWith('*/')) {
    const step = Number(token.slice(2));
    return {
      mode: 'step',
      values: [b.min],
      rangeStart: b.min,
      rangeEnd: b.max,
      step: Number.isNaN(step) ? 1 : step,
    };
  }

  // Plain range: a-b
  if (token.includes('-')) {
    const [rs, re] = token.split('-');
    return {
      mode: 'range',
      values: [b.min],
      rangeStart: Number(rs),
      rangeEnd: Number(re),
      step: 1,
    };
  }

  // List: a,b,c
  if (token.includes(',')) {
    const values = token
      .split(',')
      .map((v) => Number(v.trim()))
      .filter((v) => !Number.isNaN(v));
    return {
      mode: 'specific',
      values: values.length ? values : [b.min],
      rangeStart: b.min,
      rangeEnd: b.max,
      step: 1,
    };
  }

  // Single value.
  const v = Number(token);
  return {
    mode: 'specific',
    values: Number.isNaN(v) ? [b.min] : [v],
    rangeStart: b.min,
    rangeEnd: b.max,
    step: 1,
  };
}

/** Parse a full 5-field cron expression into a CronFields config. */
export function parseCronExpression(expr: string): CronFields {
  const parts = expr.trim().split(/\s+/);
  const names = FIELD_ORDER;
  const fields = defaultCronFields();
  for (let i = 0; i < names.length; i++) {
    const token = parts[i];
    if (token === undefined) continue;
    fields[names[i]!] = parseField(names[i]!, token);
  }
  return fields;
}

/** Validate every field; returns the first failure (or ok). */
export function validateCron(fields: CronFields): FieldValidation {
  for (const name of FIELD_ORDER) {
    const v = validateField(name, fields[name]);
    if (!v.ok) return v;
  }
  return { ok: true, message: '' };
}

/* -------------------------------------------------------------------------- */
/* Composable — reactive state + embed integration                            */
/* -------------------------------------------------------------------------- */

export interface UseCrontabGeneratorReturn {
  fields: Ref<CronFields>;
  expression: ComputedRef<string>;
  description: ComputedRef<string>;
  validation: ComputedRef<FieldValidation>;
  isValid: ComputedRef<boolean>;
  isEmbed: Ref<boolean>;
  input: Ref<EmbedInputPayload | null>;
  setField: (name: CronFieldName, cfg: Partial<CronFieldConfig>) => void;
  setFieldMode: (name: CronFieldName, mode: CronFieldMode) => void;
  setFieldValue: (
    name: CronFieldName,
    key: keyof CronFieldConfig,
    value: number | number[],
  ) => void;
  loadExpression: (expr: string) => void;
  reset: () => void;
}

export function useCrontabGenerator(): UseCrontabGeneratorReturn {
  const fields = ref<CronFields>(defaultCronFields());

  const expression = computed(() => buildCronExpression(fields.value));
  const description = computed(() => describeCron(fields.value));
  const validation = computed(() => validateCron(fields.value));
  const isValid = computed(() => validation.value.ok);

  function setField(name: CronFieldName, cfg: Partial<CronFieldConfig>): void {
    const current = fields.value[name];
    const next: CronFieldConfig = { ...current, ...cfg };
    fields.value = { ...fields.value, [name]: normalizeField(name, next) };
  }

  function setFieldMode(name: CronFieldName, mode: CronFieldMode): void {
    setField(name, { mode });
  }

  function setFieldValue(
    name: CronFieldName,
    key: keyof CronFieldConfig,
    value: number | number[],
  ): void {
    if (key === 'values') {
      setField(name, { values: value as number[] });
    } else {
      setField(name, { [key]: value as number } as Partial<CronFieldConfig>);
    }
  }

  function loadExpression(expr: string): void {
    fields.value = parseCronExpression(expr);
  }

  function reset(): void {
    fields.value = defaultCronFields();
  }

  const { isEmbed, input, sendOutput } = useEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.expression === 'string' || typeof p.cron === 'string') {
        loadExpression((p.expression as string) ?? (p.cron as string));
        return;
      }
      if (p.fields && typeof p.fields === 'object') {
        const next = { ...fields.value };
        const incoming = p.fields as Record<string, unknown>;
        for (const name of FIELD_ORDER) {
          const f = incoming[name];
          if (f && typeof f === 'object') {
            next[name] = normalizeField(name, {
              ...next[name],
              ...(f as Partial<CronFieldConfig>),
            });
          }
        }
        fields.value = next;
      }
    },
  });

  watch(
    expression,
    (expr) => {
      if (isEmbed.value) {
        sendOutput({ expression: expr, description: description.value });
      }
    },
    { immediate: true },
  );

  return {
    fields,
    expression,
    description,
    validation,
    isValid,
    isEmbed,
    input,
    setField,
    setFieldMode,
    setFieldValue,
    loadExpression,
    reset,
  };
}
