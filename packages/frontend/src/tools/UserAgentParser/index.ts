/**
 * UserAgentParser tool module - exports the lazy-loaded component plus its
 * metadata and composable so the tool can be registered in the registry and
 * routed dynamically.
 */
import { defineAsyncComponent } from 'vue';
import type { ToolMetadata } from '@q-tools/shared';

export const metadata: ToolMetadata = {
  slug: 'user-agent-parser',
  name: 'User-agent parser',
  description: 'Parse user-agent strings into browser/OS details.',
  category: 'web',
  icon: 'monitor',
  keywords: ['useragent', 'ua', 'browser', 'os', 'device', 'cpu', 'engine'],
  dependencies: ['ua-parser-js'],
};

export {
  useUserAgentParser,
  ensureUaParserModule,
  parseUserAgent,
  getCurrentUserAgent,
  resultToText,
} from './useUserAgentParser';
export type {
  UaField,
  UaFieldGroup,
  UaParseResult,
  UseUserAgentParserReturn,
} from './useUserAgentParser';

const UserAgentParser = defineAsyncComponent(() => import('./UserAgentParser.vue'));

export default UserAgentParser;
