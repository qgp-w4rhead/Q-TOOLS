/**
 * SwiftBicValidator tool module - exports the lazy-loaded component plus its
 * metadata and composable so the tool can be registered in the registry
 * and routed dynamically.
 *
 * Validate SWIFT/BIC codes (8 or 11 chars) and parse into bank code,
 * country code, location code, and branch code.
 *
 * No external dependencies - pure logic only.
 */
import { defineAsyncComponent } from 'vue';
import type { ToolMetadata } from '@q-tools/shared';

export const metadata: ToolMetadata = {
  slug: 'swift-bic-validator',
  name: 'SWIFT/BIC validator',
  description: 'Validate SWIFT/BIC codes and parse into bank code, country, location, and branch code.',
  category: 'data',
  icon: 'building-2',
  keywords: ['swift', 'bic', 'validate', 'bank', 'code', 'iso', 'country', 'branch', 'location', 'wire', 'transfer'],
  dependencies: [],
};

export {
  useSwiftBicValidator,
  validateSwiftBic,
  detectBicType,
  sanitizeBic,
} from './useSwiftBicValidator';
export type {
  BicType,
  SwiftBicParseResult,
  UseSwiftBicValidatorReturn,
} from './useSwiftBicValidator';

const SwiftBicValidator = defineAsyncComponent(
  () => import('./SwiftBicValidator.vue'),
);

export default SwiftBicValidator;
