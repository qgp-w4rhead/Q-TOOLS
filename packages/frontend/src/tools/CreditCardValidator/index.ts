/**
 * CreditCardValidator tool module - exports the lazy-loaded component plus
 * its metadata and composable so the tool can be registered in the registry
 * and routed dynamically.
 *
 * Validate credit card numbers using the Luhn algorithm and identify the
 * card brand (Visa, Mastercard, Amex, Discover, etc.).
 *
 * No external dependencies - pure arithmetic only.
 */
import { defineAsyncComponent } from 'vue';
import type { ToolMetadata } from '@q-tools/shared';

export const metadata: ToolMetadata = {
  slug: 'credit-card-validator',
  name: 'Credit card validator',
  description: 'Validate credit card numbers with Luhn checksum and identify the card brand.',
  category: 'data',
  icon: 'credit-card',
  keywords: ['credit', 'card', 'luhn', 'checksum', 'visa', 'mastercard', 'amex', 'discover'],
  dependencies: [],
};

export {
  useCreditCardValidator,
  luhnCheck,
  detectCardBrand,
} from './useCreditCardValidator';
export type {
  CardBrand,
  UseCreditCardValidatorReturn,
} from './useCreditCardValidator';

const CreditCardValidator = defineAsyncComponent(
  () => import('./CreditCardValidator.vue'),
);

export default CreditCardValidator;
