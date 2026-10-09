/**
 * TorqueConverter tool module - exports the lazy-loaded component plus its
 * metadata and composable so the tool can be registered in the registry
 * and routed dynamically.
 *
 * Convert between torque units: newton-metre, pound-foot, pound-inch,
 * ounce-inch, kilogram-force metre, and dyne-centimetre.
 *
 * No external dependencies - pure arithmetic only.
 */
import { defineTool } from '@/tools/defineTool';

const { metadata, component } = defineTool(
  {
    slug: 'torque-converter',
    name: 'Torque converter',
    description: 'Convert between torque units (N·m, kN·m, lb·ft, lb·in, oz·in, kgf·m, dyn·cm).',
    category: 'measurement',
    icon: 'rotate-cw',
    keywords: ['torque', 'newton metre', 'pound foot', 'pound inch', 'lbft', 'nm', 'kgf', 'dyne centimetre', 'moment'],
    dependencies: [],
  },
  () => import('./TorqueConverter.vue'),
);

export { metadata };

export { useTorqueConverter, TORQUE_UNITS, convertTorque, formatTorque } from './useTorqueConverter';
export type { UseTorqueConverterReturn } from './useTorqueConverter';

export default component;
