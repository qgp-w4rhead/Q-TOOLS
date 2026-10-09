/**
 * SsnValidator tool module - exports the lazy-loaded component plus its
 * metadata and composable so the tool can be registered in the registry
 * and routed dynamically.
 *
 * Validate US Social Security Numbers with area, group, and serial
 * number rules. Detects ITINs and invalid/reserved ranges.
 *
 * No external dependencies - pure logic only.
 */
import { defineAsyncComponent } from 'vue';
import type { ToolMetadata } from '@q-tools/shared';

export const metadata: ToolMetadata = {
  slug: 'ssn-validator',
  name: 'SSN validator',
  description: 'Validate US Social Security Numbers with area, group, and serial number rules. Detects ITINs.',
  category: 'data',
  icon: 'badge-check',
  keywords: ['ssn', 'social', 'security', 'number', 'validate', 'itin', 'area', 'group', 'serial', 'us'],
  dependencies: [],
};

export {
  useSsnValidator,
  validateSsn,
  sanitizeSsn,
} from './useSsnValidator';
export type {
  SsnType,
  SsnParseResult,
  UseSsnValidatorReturn,
} from './useSsnValidator';

const SsnValidator = defineAsyncComponent(
  () => import('./SsnValidator.vue'),
);

export default SsnValidator;
