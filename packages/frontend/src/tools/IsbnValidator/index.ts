/**
 * IsbnValidator tool module - exports the lazy-loaded component plus its
 * metadata and composable so the tool can be registered in the registry
 * and routed dynamically.
 *
 * Validate ISBN-10 and ISBN-13 numbers with checksum verification and
 * parse into parts (prefix, group, publisher, title, check digit).
 *
 * No external dependencies - pure arithmetic only.
 */
import { defineAsyncComponent } from 'vue';
import type { ToolMetadata } from '@q-tools/shared';

export const metadata: ToolMetadata = {
  slug: 'isbn-validator',
  name: 'ISBN validator',
  description: 'Validate ISBN-10 and ISBN-13 numbers with checksum verification.',
  category: 'data',
  icon: 'book',
  keywords: ['isbn', 'validate', 'checksum', 'book', 'isbn10', 'isbn13'],
  dependencies: [],
};

export {
  useIsbnValidator,
  validateIsbn10,
  validateIsbn13,
  detectIsbnType,
} from './useIsbnValidator';
export type {
  IsbnType,
  UseIsbnValidatorReturn,
} from './useIsbnValidator';

const IsbnValidator = defineAsyncComponent(
  () => import('./IsbnValidator.vue'),
);

export default IsbnValidator;
