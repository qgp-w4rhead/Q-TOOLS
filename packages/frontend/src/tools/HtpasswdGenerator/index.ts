/**
 * HtpasswdGenerator tool module - exports the lazy-loaded component plus its
 * metadata and composable so the tool can be registered in the registry and
 * routed dynamically.
 */
import { defineTool } from '@/tools/defineTool';

const { metadata, component } = defineTool(
  {
    slug: 'htpasswd-generator',
    name: 'htpasswd Generator',
    description:
      'Generate .htpasswd lines (bcrypt $2y$, Apache MD5 $apr1$, SHA-1) for basic auth.',
    category: 'security',
    icon: 'file-key',
    keywords: [
      'htpasswd', 'apache', 'nginx', 'basic auth', 'bcrypt', 'apr1', 'md5',
      'sha1', 'password', 'htaccess',
    ],
    dependencies: ['hash-wasm'],
  },
  () => import('./HtpasswdGenerator.vue'),
);

export { metadata };

export {
  useHtpasswdGenerator,
  buildHtpasswdLine,
  bcryptHtpasswd,
  apr1Hash,
  sha1Htpasswd,
  generateApr1Salt,
  randomBytes,
  HTPASSWD_SCHEMES,
  MIN_COST,
  MAX_COST,
  DEFAULT_COST,
} from './useHtpasswdGenerator';
export type {
  HtpasswdScheme,
  UseHtpasswdGeneratorReturn,
} from './useHtpasswdGenerator';

export default component;
