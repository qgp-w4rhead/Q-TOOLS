/**
 * ContentTypeNegotiator tool module — exports the lazy-loaded component plus
 * its metadata, composable, and pure helpers.
 *
 * No external dependencies.
 */
import { defineTool } from '@/tools/defineTool';

const { metadata, component } = defineTool(
  {
    slug: 'content-type-negotiator',
    name: 'Content-Type Negotiation',
    description:
      'Parse Accept headers, show matched MIME types and quality factors.',
    category: 'api',
    icon: 'file-text',
    keywords: ['content-type', 'accept', 'negotiation', 'mime', 'quality', 'q-value', 'header', 'http'],
    dependencies: [],
  },
  () => import('./ContentTypeNegotiator.vue'),
);

export { metadata };

export {
  useContentTypeNegotiator,
  parseAcceptHeader,
} from './useContentTypeNegotiator';
export type {
  AcceptEntry,
  NegotiationResult,
  UseContentTypeNegotiatorReturn,
} from './useContentTypeNegotiator';

export default component;
