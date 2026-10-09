/**
 * BrowserLeakDemo tool module - exports the lazy-loaded component plus its
 * metadata and composable so the tool can be registered in the registry and
 * routed dynamically.
 */
import { defineTool } from '@/tools/defineTool';

const { metadata, component } = defineTool(
  {
    slug: 'browser-leak-demo',
    name: 'Browser Leak Demo',
    description:
      'See what your browser exposes: WebRTC local IPs, user-agent, screen, timezone, fingerprint entropy.',
    category: 'security',
    icon: 'eye',
    keywords: [
      'browser', 'leak', 'fingerprint', 'webrtc', 'ip', 'privacy', 'tracking',
      'user-agent', 'entropy', 'demo',
    ],
    dependencies: [],
    iframeRequirements: [],
  },
  () => import('./BrowserLeakDemo.vue'),
);

export { metadata };

export {
  useBrowserLeakDemo,
  collectLeaks,
  canvasFingerprint,
  gatherWebRtcIps,
  totalBits,
  uniquenessEstimate,
} from './useBrowserLeakDemo';
export type {
  LeakItem,
  LeakGroup,
  UseBrowserLeakDemoReturn,
} from './useBrowserLeakDemo';

export default component;
