/**
 * SecurityTxtGenerator tool module - exports the lazy-loaded component plus
 * its metadata and composable so the tool can be registered in the registry
 * and routed dynamically.
 */
import { defineTool } from '@/tools/defineTool';

const { metadata, component } = defineTool(
  {
    slug: 'security-txt-generator',
    name: 'security.txt Generator',
    description:
      'Build an RFC 9116 security.txt file (contact, expires, acknowledgments) for /.well-known/.',
    category: 'security',
    icon: 'file-text',
    keywords: [
      'security.txt', 'rfc9116', 'vulnerability', 'disclosure', 'contact',
      'well-known', 'security policy',
    ],
    dependencies: [],
  },
  () => import('./SecurityTxtGenerator.vue'),
);

export { metadata };

export {
  useSecurityTxtGenerator,
  buildSecurityTxt,
  validateSecurityTxt,
  defaultConfig,
  defaultExpires,
  lines,
} from './useSecurityTxtGenerator';
export type {
  SecurityTxtConfig,
  SecurityTxtIssue,
  UseSecurityTxtGeneratorReturn,
} from './useSecurityTxtGenerator';

export default component;
