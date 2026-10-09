/**
 * RegexTester tool module - exports the lazy-loaded component plus its
 * metadata and composable so the tool can be registered in the registry
 * and routed dynamically.
 *
 * No external npm dependencies - uses only the built-in `RegExp`.
 */
import { defineAsyncComponent } from 'vue';
import type { ToolMetadata } from '@q-tools/shared';

export const metadata: ToolMetadata = {
  slug: 'regex-tester',
  name: 'Regex tester',
  description: 'Test regular expressions against input with live highlighting and capture groups.',
  category: 'dev',
  icon: 'regex',
  keywords: ['regex', 'regexp', 'test', 'match', 'pattern', 'capture', 'groups'],
  dependencies: [],
};

export {
  useRegexTester,
  compilePattern,
  runRegex,
  segmentMatches,
  countCaptureGroups,
  escapeHtml,
  REGEX_FLAGS,
  REGEX_REFERENCE,
} from './useRegexTester';
export type {
  RegexFlag,
  RegexGroup,
  RegexMatch,
  CompiledRegex,
  Segment,
  RegexReferenceEntry,
  RegexReferenceSection,
  UseRegexTesterReturn,
} from './useRegexTester';

const RegexTester = defineAsyncComponent(
  () => import('./RegexTester.vue'),
);

export default RegexTester;
