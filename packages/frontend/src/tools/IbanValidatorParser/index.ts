/**
 * IbanValidatorParser tool module - exports the lazy-loaded component plus its
 * metadata and composable so the tool can be registered in the registry
 * and routed dynamically.
 *
 * No external npm dependencies - the country spec table and mod-97 algorithm
 * are bundled inside the composable.
 */
import { defineAsyncComponent } from 'vue';
import type { ToolMetadata } from '@q-tools/shared';

export const metadata: ToolMetadata = {
  slug: 'iban-validator-and-parser',
  name: 'IBAN validator and parser',
  description:
    'Validate IBAN account numbers with mod-97 checksum and parse into country, bank code, branch code, and account number.',
  category: 'data',
  icon: 'credit-card',
  keywords: [
    'iban',
    'validate',
    'parse',
    'bank',
    'account',
    'mod-97',
    'checksum',
    'bic',
    'swift',
    'sepa',
    'country',
    'bank code',
    'branch code',
  ],
  dependencies: [],
};

export {
  useIbanValidatorParser,
  normalizeIban,
  rearrangeForMod97,
  mod97,
  letterValue,
  validateIban,
  parseIban,
  formatIban,
  getCountrySpec,
  IBAN_COUNTRY_SPECS,
} from './useIbanValidatorParser';
export type {
  IbanSegmentType,
  IbanSegmentRole,
  IbanSegmentSpec,
  IbanCountrySpec,
  IbanValidation,
  IbanParseResult,
  UseIbanValidatorParserReturn,
} from './useIbanValidatorParser';

const IbanValidatorParser = defineAsyncComponent(
  () => import('./IbanValidatorParser.vue'),
);

export default IbanValidatorParser;
