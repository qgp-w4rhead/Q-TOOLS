/**
 * AriaLabelGenerator tool module.
 */
import { defineTool } from '@/tools/defineTool';

const { metadata, component } = defineTool(
  {
    slug: 'aria-label-generator',
    name: 'ARIA Label Generator',
    description: 'Generate ARIA attributes (label, labelledby, describedby, role) from form inputs.',
    category: 'a11y',
    icon: 'tag',
    keywords: ['aria', 'label', 'labelledby', 'describedby', 'role', 'accessibility', 'attribute'],
    dependencies: [],
  },
  () => import('./AriaLabelGenerator.vue'),
);

export { metadata };

export {
  useAriaLabelGenerator,
  escapeAttr,
  buildHtml,
  ELEMENT_TAGS,
  ARIA_ROLES,
} from './useAriaLabelGenerator';
export type {
  AriaConfig,
  ElementType,
  UseAriaLabelGeneratorReturn,
} from './useAriaLabelGenerator';

export default component;
