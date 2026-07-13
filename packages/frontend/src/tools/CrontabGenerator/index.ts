/**
 * CrontabGenerator tool module — exports the lazy-loaded component plus its
 * metadata, composable, and pure helpers so the tool can be registered in the
 * registry and routed dynamically.
 */
import { defineAsyncComponent } from 'vue';
import type { ToolMetadata } from '@q-tools/shared';

export const metadata: ToolMetadata = {
  slug: 'crontab-generator',
  name: 'Crontab generator',
  description: 'Build and explain cron schedule expressions.',
  category: 'dev',
  icon: 'clock',
  keywords: ['cron', 'crontab', 'schedule', 'scheduler', 'cronjob'],
  dependencies: [],
};

export {
  useCrontabGenerator,
  buildCronExpression,
  buildFieldExpression,
  describeCron,
  describeField,
  parseCronExpression,
  parseField,
  validateCron,
  validateField,
  normalizeField,
  clampValue,
  defaultCronFields,
  defaultField,
  FIELD_ORDER,
  FIELD_BOUNDS,
} from './useCrontabGenerator';
export type {
  CronFieldName,
  CronFieldBounds,
  CronFieldMode,
  CronFieldConfig,
  CronFields,
  FieldValidation,
  UseCrontabGeneratorReturn,
} from './useCrontabGenerator';

const CrontabGenerator = defineAsyncComponent(
  () => import('./CrontabGenerator.vue'),
);

export default CrontabGenerator;
