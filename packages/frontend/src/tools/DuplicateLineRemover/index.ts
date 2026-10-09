/**
 * DuplicateLineRemover tool module - exports the lazy-loaded component plus
 * its metadata and composable so the tool can be registered in the registry
 * and routed dynamically.
 *
 * Remove duplicate lines from text with case-sensitive/insensitive and
 * trim-whitespace options. Shows statistics about removed lines.
 *
 * No external dependencies - pure string manipulation only.
 */
import { defineAsyncComponent } from 'vue';
import type { ToolMetadata } from '@q-tools/shared';

export const metadata: ToolMetadata = {
  slug: 'duplicate-line-remover',
  name: 'Duplicate line remover',
  description: 'Remove duplicate lines from text with case and trim options.',
  category: 'text',
  icon: 'eraser',
  keywords: ['duplicate', 'remove', 'deduplicate', 'unique', 'lines', 'text'],
  dependencies: [],
};

export {
  useDuplicateLineRemover,
  removeDuplicateLines,
} from './useDuplicateLineRemover';
export type {
  UseDuplicateLineRemoverReturn,
} from './useDuplicateLineRemover';

const DuplicateLineRemover = defineAsyncComponent(
  () => import('./DuplicateLineRemover.vue'),
);

export default DuplicateLineRemover;
