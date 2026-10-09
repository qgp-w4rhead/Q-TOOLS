/**
 * WebhookPayloadInspector tool module — exports the lazy-loaded component plus
 * its metadata, composable, and pure helpers.
 *
 * No external dependencies.
 */
import { defineTool } from '@/tools/defineTool';

const { metadata, component } = defineTool(
  {
    slug: 'webhook-payload-inspector',
    name: 'Webhook Payload Inspector',
    description:
      'Paste JSON → formatted tree view with JSONPath/jq-style filtering.',
    category: 'api',
    icon: 'webhook',
    keywords: ['webhook', 'payload', 'json', 'inspect', 'tree', 'jsonpath', 'jq', 'filter'],
    dependencies: [],
  },
  () => import('./WebhookPayloadInspector.vue'),
);

export { metadata };

export {
  useWebhookPayloadInspector,
  inspectPayload,
} from './useWebhookPayloadInspector';
export type {
  TreeNode,
  InspectionResult,
  UseWebhookPayloadInspectorReturn,
} from './useWebhookPayloadInspector';

export default component;
