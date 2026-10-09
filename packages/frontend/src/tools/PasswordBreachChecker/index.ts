/**
 * PasswordBreachChecker tool module - exports the lazy-loaded component
 * plus its metadata and composable.
 *
 * k-anonymity SHA-1 prefix lookup against HaveIBeenPwned API (client-side).
 *
 * No external dependencies - Web Crypto API for SHA-1, fetch for API.
 */
import { defineTool } from '@/tools/defineTool';

const { metadata, component } = defineTool(
  {
    slug: 'password-breach-checker',
    name: 'Password Breach Checker',
    description: 'Check if a password has appeared in known data breaches (HaveIBeenPwned k-anonymity).',
    category: 'security',
    icon: 'shield-alert',
    keywords: ['password', 'breach', 'haveibeenpwned', 'pwned', 'leak', 'k-anonymity', 'sha1'],
    dependencies: [],
  },
  () => import('./PasswordBreachChecker.vue'),
);

export { metadata };

export {
  usePasswordBreachChecker,
  checkPasswordBreach,
} from './usePasswordBreachChecker';
export type {
  BreachStatus,
  BreachResult,
  UsePasswordBreachCheckerReturn,
} from './usePasswordBreachChecker';

export default component;
