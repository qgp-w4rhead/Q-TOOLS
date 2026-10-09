/**
 * EscapeHtmlEntities tool module - exports the lazy-loaded component plus its
 * metadata and composable so the tool can be registered in the registry
 * and routed dynamically.
 */
import { defineAsyncComponent } from 'vue';
import type { ToolMetadata } from '@q-tools/shared';

export const metadata: ToolMetadata = {
  slug: 'escape-html-entities',
  name: 'Escape HTML entities',
  description: 'Escape and unescape HTML entities.',
  category: 'web',
  icon: 'code',
  keywords: ['html', 'escape', 'entities', 'unescape'],
  dependencies: [],
};

export {
  useEscapeHtml,
  escapeHtml,
  unescapeHtml,
  DEFAULT_DIRECTION,
  DEFAULT_MODE,
} from './useEscapeHtml';
export type {
  HtmlDirection,
  HtmlEntityMode,
  EscapeHtmlOutputs,
  UseEscapeHtmlReturn,
} from './useEscapeHtml';

const EscapeHtmlEntities = defineAsyncComponent(
  () => import('./EscapeHtmlEntities.vue'),
);

export default EscapeHtmlEntities;
