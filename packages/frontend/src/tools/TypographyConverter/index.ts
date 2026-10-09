/**
 * TypographyConverter tool module - exports the lazy-loaded component plus
 * its metadata and composable so the tool can be registered in the registry
 * and routed dynamically.
 *
 * Convert between typographic units: point, pica, pixel (configurable DPI),
 * em (configurable base font size), inch, millimetre, centimetre, cicero,
 * and didot.
 *
 * No external dependencies - pure arithmetic only.
 */
import { defineTool } from '@/tools/defineTool';

const { metadata, component } = defineTool(
  {
    slug: 'typography-converter',
    name: 'Typography unit converter',
    description: 'Convert between typography units (pt, pica, px at configurable DPI, em, in, mm, cicero, didot).',
    category: 'measurement',
    icon: 'type',
    keywords: ['typography', 'point', 'pica', 'pixel', 'em', 'cicero', 'didot', 'font size', 'dpi', 'print'],
    dependencies: [],
  },
  () => import('./TypographyConverter.vue'),
);

export { metadata };

export {
  useTypographyConverter,
  buildTypographyUnits,
  convertTypography,
  formatTypography,
} from './useTypographyConverter';
export type { UseTypographyConverterReturn } from './useTypographyConverter';

export default component;
