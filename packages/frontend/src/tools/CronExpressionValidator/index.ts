/**
 * CronExpressionValidator tool module - exports the lazy-loaded component plus
 * its metadata, composable, and pure helpers.
 *
 * Extends CrontabGenerator with validation, explanation, and next-run preview.
 *
 * No external dependencies.
 */
import { defineTool } from '@/tools/defineTool';

const { metadata, component } = defineTool(
  {
    slug: 'cron-expression-validator',
    name: 'Cron Expression Validator',
    description:
      'Validate and explain cron expressions with next-run preview.',
    category: 'devops',
    icon: 'clock',
    keywords: ['cron', 'validate', 'explain', 'schedule', 'next-run', 'crontab'],
    dependencies: [],
  },
  () => import('./CronExpressionValidator.vue'),
);

export { metadata };

export {
  useCronExpressionValidator,
  validateCronExpression,
  calculateNextRuns,
} from './useCronExpressionValidator';
export type {
  CronValidationResult,
  UseCronExpressionValidatorReturn,
} from './useCronExpressionValidator';

export default component;
