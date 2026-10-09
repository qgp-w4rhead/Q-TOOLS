/**
 * TabOrderVisualizer tool module.
 */
import { defineTool } from '@/tools/defineTool';

const { metadata, component } = defineTool(
  {
    slug: 'tab-order-visualizer',
    name: 'Tab Order Visualizer',
    description: 'Paste HTML to see tab navigation order with tabindex analysis.',
    category: 'a11y',
    icon: 'list-ordered',
    keywords: ['tab', 'order', 'tabindex', 'navigation', 'keyboard', 'accessibility', 'focus'],
    dependencies: [],
  },
  () => import('./TabOrderVisualizer.vue'),
);

export { metadata };

export {
  useTabOrderVisualizer,
  parseTabOrder,
} from './useTabOrderVisualizer';
export type {
  TabElement,
  TabOrderResult,
  UseTabOrderVisualizerReturn,
} from './useTabOrderVisualizer';

export default component;
