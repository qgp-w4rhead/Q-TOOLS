/**
 * CaseConverter tool module - exports the lazy-loaded component plus its
 * metadata and composable so the tool can be registered in the registry
 * and routed dynamically.
 */
import { defineAsyncComponent } from 'vue';
import type { ToolMetadata } from '@q-tools/shared';

export const metadata: ToolMetadata = {
  slug: 'case-converter',
  name: 'Case converter',
  description: 'Convert text between UPPER, lower, Title, camel, Pascal, snake, kebab, CONSTANT and sentence case.',
  category: 'converter',
  icon: 'case-sensitive',
  keywords: ['case', 'camel', 'snake', 'kebab', 'pascal', 'upper', 'lower', 'title'],
  dependencies: [],
};

export {
  useCaseConverter,
  splitWords,
  capitalize,
  lowercaseFirst,
  uppercaseWord,
  lowercaseWord,
  toUpper,
  toLower,
  toTitleCase,
  toSentenceCase,
  toCamelCase,
  toPascalCase,
  toSnakeCase,
  toKebabCase,
  toConstantCase,
  convertCase,
  CASE_MODES,
} from './useCaseConverter';
export type {
  CaseMode,
  UseCaseConverterReturn,
} from './useCaseConverter';

const CaseConverter = defineAsyncComponent(
  () => import('./CaseConverter.vue'),
);

export default CaseConverter;
