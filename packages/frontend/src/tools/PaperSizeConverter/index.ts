/**
 * PaperSizeConverter tool module - exports the lazy-loaded component plus
 * its metadata and composable so the tool can be registered in the registry
 * and routed dynamically.
 *
 * Searchable reference of ISO 216 A/B/C series and North American paper
 * sizes with mm/inch dimensions and closest-ISO-A matching.
 *
 * No external dependencies - bundled data only.
 */
import { defineTool } from '@/tools/defineTool';

const { metadata, component } = defineTool(
  {
    slug: 'paper-size-converter',
    name: 'Paper size reference',
    description: 'ISO A/B/C series and US paper sizes (Letter, Legal, Tabloid) with mm/inch dimensions.',
    category: 'measurement',
    icon: 'file',
    keywords: ['paper', 'size', 'a4', 'letter', 'legal', 'tabloid', 'iso 216', 'ansi', 'dimensions', 'print'],
    dependencies: [],
  },
  () => import('./PaperSizeConverter.vue'),
);

export { metadata };

export {
  usePaperSizeConverter,
  PAPER_SIZES,
  PAPER_SERIES,
  mmToInches,
  areaMm2,
  closestIsoASize,
  filterPaperSizes,
} from './usePaperSizeConverter';
export type { PaperSize, UsePaperSizeConverterReturn } from './usePaperSizeConverter';

export default component;
