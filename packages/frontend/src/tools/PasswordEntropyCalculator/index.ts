/**
 * PasswordEntropyCalculator tool module - exports the lazy-loaded component
 * plus its metadata and composable so the tool can be registered in the
 * registry and routed dynamically.
 */
import { defineTool } from '@/tools/defineTool';

const { metadata, component } = defineTool(
  {
    slug: 'password-entropy-calculator',
    name: 'Password Entropy Calculator',
    description:
      'Charset pool → bits of entropy, crack-time table, and strengthening tips.',
    category: 'security',
    icon: 'gauge',
    keywords: [
      'password', 'entropy', 'bits', 'crack', 'brute force', 'strength',
      'charset', 'pool',
    ],
    dependencies: [],
  },
  () => import('./PasswordEntropyCalculator.vue'),
);

export { metadata };

export {
  usePasswordEntropyCalculator,
  analyzeCharset,
  analyzePassword,
  poolSize,
  entropyBits,
  crackSeconds,
  crackTable,
  formatDuration,
  strengthBand,
  strengtheningTips,
  POOL_SIZES,
  CRACK_SCENARIOS,
  STRENGTH_LABELS,
} from './usePasswordEntropyCalculator';
export type {
  CharsetBreakdown,
  CrackTimeRow,
  EntropyResult,
  StrengthBand,
  UsePasswordEntropyCalculatorReturn,
} from './usePasswordEntropyCalculator';

export default component;
