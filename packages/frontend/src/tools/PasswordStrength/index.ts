/**
 * PasswordStrength tool module — exports the lazy-loaded component plus its
 * metadata and composable so the tool can be registered in the registry and
 * routed dynamically.
 */
import { defineAsyncComponent } from 'vue';
import type { ToolMetadata } from '@q-tools/shared';

export const metadata: ToolMetadata = {
  slug: 'password-strength-analyser',
  name: 'Password strength analyser',
  description: 'Analyse password strength with zxcvbn.',
  category: 'crypto',
  icon: 'shield-alert',
  keywords: ['password', 'strength', 'zxcvbn', 'entropy', 'crack'],
  dependencies: ['@zxcvbn-ts/core', '@zxcvbn-ts/language-common', '@zxcvbn-ts/language-en'],
};

export {
  usePasswordStrength,
  analyzePassword,
  ensureZxcvbnModule,
  guessesToEntropyBits,
  formatCrackTime,
  SCORE_INFOS,
  SCORE_MAP,
  CRACK_SCENARIOS,
  LOG2_10,
} from './usePasswordStrength';
export type {
  PasswordScore,
  ScoreInfo,
  CrackScenarioKey,
  CrackScenarioInfo,
  CrackTimeEntry,
  PasswordFeedback,
  PasswordAnalysis,
  UsePasswordStrengthReturn,
} from './usePasswordStrength';

const PasswordStrength = defineAsyncComponent(() => import('./PasswordStrength.vue'));

export default PasswordStrength;
