/**
 * FaviconGenerator tool module - exports the lazy-loaded component plus its
 * metadata and composable so the tool can be registered in the registry and
 * routed dynamically.
 */
import { defineAsyncComponent } from 'vue';
import type { ToolMetadata } from '@q-tools/shared';

export const metadata: ToolMetadata = {
  slug: 'favicon-generator',
  name: 'Favicon generator',
  description: 'One PNG → full favicon set (16/32/180/192/512, ICO, manifest snippet).',
  category: 'media',
  icon: 'star',
  keywords: ['favicon', 'icon', 'ico', 'png', 'manifest', 'apple-touch-icon', 'pwa'],
  dependencies: [],
};

export {
  useFaviconGenerator,
  buildIco,
  buildManifest,
  buildHtmlSnippet,
  FAVICON_SIZES,
} from './useFaviconGenerator';
export type {
  FaviconSize,
  GeneratedIcon,
  UseFaviconGeneratorReturn,
} from './useFaviconGenerator';

const FaviconGenerator = defineAsyncComponent(
  () => import('./FaviconGenerator.vue'),
);

export default FaviconGenerator;
