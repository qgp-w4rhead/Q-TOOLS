/**
 * HomoglyphDetector tool module - exports the lazy-loaded component plus its
 * metadata and composable so the tool can be registered in the registry and
 * routed dynamically.
 */
import { defineTool } from '@/tools/defineTool';

const { metadata, component } = defineTool(
  {
    slug: 'homoglyph-detector',
    name: 'Homoglyph / Punycode Detector',
    description:
      'Flag confusable Unicode, xn-- punycode, and mixed-script phishing indicators in a URL or domain.',
    category: 'security',
    icon: 'scan-line',
    keywords: [
      'homoglyph', 'punycode', 'idn', 'phishing', 'unicode', 'confusable',
      'domain', 'url', 'xn--', 'cyrillic', 'lookalike',
    ],
    dependencies: [],
  },
  () => import('./HomoglyphDetector.vue'),
);

export { metadata };

export {
  useHomoglyphDetector,
  punycodeDecode,
  decodePunycodeHost,
  scriptOf,
  extractHost,
  analyzeHomoglyphs,
  CONFUSABLES,
} from './useHomoglyphDetector';
export type {
  ScriptClass,
  FlaggedChar,
  HomoglyphIssue,
  HomoglyphResult,
  UseHomoglyphDetectorReturn,
} from './useHomoglyphDetector';

export default component;
