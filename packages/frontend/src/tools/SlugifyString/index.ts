/**
 * SlugifyString tool module — exports the lazy-loaded component plus its
 * metadata and composable so the tool can be registered in the registry
 * and routed dynamically.
 */
import { defineAsyncComponent } from 'vue';
import type { ToolMetadata } from '@q-tools/shared';

export const metadata: ToolMetadata = {
  slug: 'slugify-string',
  name: 'Slugify string',
  description: 'Convert text to URL-safe slugs with separator, lowercase, trim and strict options.',
  category: 'web',
  icon: 'link',
  keywords: ['slug', 'slugify', 'url', 'permalink'],
  dependencies: [],
};

export {
  useSlugifyString,
  slugify,
  slugifyLine,
  transliterate,
  DEFAULT_SLUGIFY_OPTIONS,
} from './useSlugifyString';
export type {
  SlugSeparator,
  SlugifyOptions,
  UseSlugifyStringReturn,
} from './useSlugifyString';

const SlugifyString = defineAsyncComponent(
  () => import('./SlugifyString.vue'),
);

export default SlugifyString;
