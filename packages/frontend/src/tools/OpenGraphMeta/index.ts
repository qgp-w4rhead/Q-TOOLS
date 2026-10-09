/**
 * OpenGraphMeta tool module - exports the lazy-loaded component plus its
 * metadata and composable so the tool can be registered in the registry and
 * routed dynamically.
 */
import { defineAsyncComponent } from 'vue';
import type { ToolMetadata } from '@q-tools/shared';

export const metadata: ToolMetadata = {
  slug: 'open-graph-meta-generator',
  name: 'Open Graph meta generator',
  description: 'Generate Open Graph and Twitter Card social meta tags.',
  category: 'web',
  icon: 'share',
  keywords: ['opengraph', 'meta', 'social', 'tags', 'twitter', 'og', 'card'],
  dependencies: [],
};

export {
  useOpenGraphMeta,
  escapeHtmlAttr,
  buildOpenGraphTags,
  buildTwitterTags,
  buildMetaTagHtml,
  buildMetaHtml,
  generateMetaHtml,
  OG_TYPES,
  TWITTER_CARD_TYPES,
} from './useOpenGraphMeta';
export type {
  OgType,
  TwitterCardType,
  OpenGraphInput,
  OpenGraphResult,
  MetaTag,
  UseOpenGraphMetaReturn,
} from './useOpenGraphMeta';

const OpenGraphMeta = defineAsyncComponent(
  () => import('./OpenGraphMeta.vue'),
);

export default OpenGraphMeta;
