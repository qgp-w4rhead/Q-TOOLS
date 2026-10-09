/**
 * SecretScanner tool module - exports the lazy-loaded component plus its
 * metadata and composable so the tool can be registered in the registry and
 * routed dynamically.
 */
import { defineTool } from '@/tools/defineTool';

const { metadata, component } = defineTool(
  {
    slug: 'secret-scanner',
    name: 'Secret Scanner',
    description:
      'Detect leaked API keys, tokens, and private key blocks in pasted text or code.',
    category: 'security',
    icon: 'scan-line',
    keywords: [
      'secret', 'scanner', 'api key', 'token', 'leak', 'aws', 'github', 'slack',
      'stripe', 'private key', 'credentials', 'gitleaks',
    ],
    dependencies: [],
  },
  () => import('./SecretScanner.vue'),
);

export { metadata };

export {
  useSecretScanner,
  scanSecrets,
  maskSecret,
  lineNumberAt,
  countBySeverity,
  SECRET_RULES,
  SEVERITY_ORDER,
} from './useSecretScanner';
export type {
  SecretRule,
  SecretFinding,
  Severity,
  UseSecretScannerReturn,
} from './useSecretScanner';

export default component;
