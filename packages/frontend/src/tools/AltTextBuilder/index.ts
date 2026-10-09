/**
 * AltTextBuilder tool module.
 */
import { defineTool } from '@/tools/defineTool';

const { metadata, component } = defineTool(
  {
    slug: 'alt-text-builder',
    name: 'Alt Text Builder',
    description: 'Template-based alt text generator for images (subject, action, context).',
    category: 'a11y',
    icon: 'image',
    keywords: ['alt', 'text', 'image', 'accessibility', 'template', 'alt-text', 'description'],
    dependencies: [],
  },
  () => import('./AltTextBuilder.vue'),
);

export { metadata };

export {
  useAltTextBuilder,
  buildAltText,
  buildAltAttribute,
} from './useAltTextBuilder';
export type {
  AltTextConfig,
  UseAltTextBuilderReturn,
} from './useAltTextBuilder';

export default component;
