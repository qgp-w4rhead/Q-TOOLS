/**
 * useCronExpressionValidator - composable + pure logic for cron expression
 * validation, explanation, and next-run preview.
 *
 * Reuses parsing and validation from CrontabGenerator and adds:
 *   - Next-run calculation (next 5 runs)
 *   - Expression explanation
 *
 * No external dependencies.
 */
import { computed, ref, type ComputedRef, type Ref } from 'vue';
import { useToolEmbed } from '@/composables/useToolEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';
import {
  parseCronExpression,
  validateCron,
  describeCron,
  buildCronExpression,
  type CronFields,
  type FieldValidation,
} from '@/tools/CrontabGenerator/useCrontabGenerator';

/* -------------------------------------------------------------------------- */
/* Types - pure logic                                                         */
/* -------------------------------------------------------------------------- */

export interface CronValidationResult {
  valid: boolean;
  error: string | null;
  fields: CronFields;
  description: string;
  expression: string;
  nextRuns: Date[];
}

/* -------------------------------------------------------------------------- */
/* Pure logic - next-run calculation                                          */
/* -------------------------------------------------------------------------- */

function getFieldValues(fields: CronFields): {
  minutes: number[];
  hours: number[];
  doms: number[];
  months: number[];
  dows: number[];
} {
  function expandValues(cfg: { mode: string; value?: number; step?: number; rangeStart?: number; rangeEnd?: number }): number[] {
    switch (cfg.mode) {
      case 'every':
        return Array.from({ length: 60 }, (_, i) => i);
      case 'step': {
        const step = cfg.step ?? 1;
        return Array.from({ length: 60 }, (_, i) => i).filter((i) => i % step === 0);
      }
      case 'value':
        return [cfg.value ?? 0];
      case 'range': {
        const start = cfg.rangeStart ?? 0;
        const end = cfg.rangeEnd ?? 59;
        const out: number[] = [];
        for (let i = start; i <= end; i++) out.push(i);
        return out;
      }
      default:
        return [];
    }
  }

  return {
    minutes: expandValues(fields.minute),
    hours: expandValues(fields.hour),
    doms: expandValues(fields.dayOfMonth),
    months: expandValues(fields.month),
    dows: expandValues(fields.dayOfWeek),
  };
}

export function calculateNextRuns(fields: CronFields, count: number = 5, from: Date = new Date()): Date[] {
  const { minutes, hours, doms, months, dows } = getFieldValues(fields);
  const results: Date[] = [];
  const candidate = new Date(from.getTime() + 60 * 1000);
  candidate.setSeconds(0, 0);

  const maxIterations = 500000;
  let iterations = 0;

  while (results.length < count && iterations < maxIterations) {
    iterations++;

    const month = candidate.getMonth() + 1;
    if (!months.includes(month)) {
      candidate.setMonth(candidate.getMonth() + 1, 1);
      candidate.setHours(0, 0, 0, 0);
      continue;
    }

    const dom = candidate.getDate();
    const dow = candidate.getDay();
    const dowMatch = dows.length === 0 || dows.includes(dow) || dows.includes(7) && dow === 0;
    const domMatch = doms.length === 0 || doms.includes(dom);

    if (!domMatch && !dowMatch) {
      candidate.setDate(candidate.getDate() + 1);
      candidate.setHours(0, 0, 0, 0);
      continue;
    }

    const hour = candidate.getHours();
    if (!hours.includes(hour)) {
      candidate.setHours(candidate.getHours() + 1, 0, 0, 0);
      continue;
    }

    const minute = candidate.getMinutes();
    if (!minutes.includes(minute)) {
      candidate.setMinutes(candidate.getMinutes() + 1, 0, 0);
      continue;
    }

    results.push(new Date(candidate));
    candidate.setMinutes(candidate.getMinutes() + 1, 0, 0);
  }

  return results;
}

export function validateCronExpression(expr: string): CronValidationResult {
  const fields = parseCronExpression(expr);
  const validation: FieldValidation = validateCron(fields);
  const valid = validation.ok;
  const expression = buildCronExpression(fields);
  const description = valid ? describeCron(fields) : '';
  const nextRuns = valid ? calculateNextRuns(fields, 5) : [];

  return {
    valid,
    error: valid ? null : validation.message ?? 'Invalid cron expression',
    fields,
    description,
    expression,
    nextRuns,
  };
}

/* -------------------------------------------------------------------------- */
/* Composable - reactive state + embed integration                            */
/* -------------------------------------------------------------------------- */

export interface UseCronExpressionValidatorReturn {
  expression: Ref<string>;
  result: ComputedRef<CronValidationResult>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  reset: () => void;
}

export function useCronExpressionValidator(): UseCronExpressionValidatorReturn {
  const expression = ref<string>('*/5 * * * *');

  const result = computed(() => validateCronExpression(expression.value));

  function reset(): void {
    expression.value = '*/5 * * * *';
  }

  const { isEmbed, input: embedInput } = useToolEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.expression === 'string') {
        expression.value = p.expression;
      }
      if (typeof p.value === 'string') {
        expression.value = p.value;
      }
    },
    output: result,
    toOutput: () => ({
      expression: expression.value,
      valid: result.value.valid,
      error: result.value.error,
      description: result.value.description,
      nextRuns: result.value.nextRuns.map((d) => d.toISOString()),
    }),
  });

  return {
    expression,
    result,
    isEmbed,
    embedInput,
    reset,
  };
}
