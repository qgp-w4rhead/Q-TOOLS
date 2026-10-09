/**
 * PolybiusSquare tool module - exports the lazy-loaded component plus its
 * metadata and composable so the tool can be registered in the registry
 * and routed dynamically.
 */
import { defineTool } from '@/tools/defineTool';

const { metadata, component } = defineTool(
  {
    slug: 'polybius-square',
    name: 'Polybius Square',
    description: 'Coordinate-based substitution cipher with configurable grid size (5×5 or 6×6).',
    category: 'cipher',
    icon: 'grid-3x3',
    keywords: ['polybius', 'square', 'grid', 'coordinate', 'cipher', 'substitution'],
    dependencies: [],
  },
  () => import('./PolybiusSquare.vue'),
);

export { metadata };

export {
  usePolybiusSquare,
  buildPolybiusGrid,
  polybiusEncrypt,
  polybiusDecrypt,
  DEFAULT_GRID_SIZE,
  DEFAULT_SEPARATOR,
} from './usePolybiusSquare';
export type {
  GridSize,
  PolybiusMode,
  UsePolybiusSquareReturn,
} from './usePolybiusSquare';

export default component;
