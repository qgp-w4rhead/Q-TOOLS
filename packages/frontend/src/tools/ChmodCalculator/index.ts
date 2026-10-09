/**
 * ChmodCalculator tool module - exports the lazy-loaded component plus its
 * metadata, composable, and pure helpers so the tool can be registered in the
 * registry and routed dynamically.
 *
 * No external dependencies - all logic is pure TypeScript.
 */
import { defineAsyncComponent } from 'vue';
import type { ToolMetadata } from '@q-tools/shared';

export const metadata: ToolMetadata = {
  slug: 'chmod-calculator',
  name: 'Chmod calculator',
  description:
    'Calculate Unix file permissions from checkboxes, numeric octal, or symbolic notation.',
  category: 'dev',
  icon: 'lock',
  keywords: ['chmod', 'permission', 'unix', 'octal', 'symbolic', 'mode'],
  dependencies: [],
};

export {
  useChmodCalculator,
  permissionsToOctal,
  permissionsToSymbolic,
  octalToPermissions,
  symbolicToPermissions,
  describePermissions,
  validateOctal,
  validateSymbolic,
  scopeDigit,
  specialDigit,
  scopeSymbolic,
  digitToScope,
  defaultPermissions,
  SCOPE_ORDER,
  BIT_ORDER,
  BIT_WEIGHT,
  SPECIAL_WEIGHT,
  SCOPE_LABEL,
  BIT_LABEL,
} from './useChmodCalculator';
export type {
  PermissionScope,
  PermissionBit,
  SpecialBit,
  ScopePermissions,
  ChmodPermissions,
  PermissionValidation,
  UseChmodCalculatorReturn,
} from './useChmodCalculator';

const ChmodCalculator = defineAsyncComponent(
  () => import('./ChmodCalculator.vue'),
);

export default ChmodCalculator;
