/**
 * FrequencyConverter tool module - exports the lazy-loaded component plus its
 * metadata and composable so the tool can be registered in the registry
 * and routed dynamically.
 *
 * Convert between frequency units: hertz, kilohertz, megahertz, gigahertz,
 * terahertz, revolutions per minute.
 *
 * No external dependencies - pure arithmetic only.
 */
import { defineTool } from '@/tools/defineTool';

const { metadata, component } = defineTool(
  {
    slug: 'frequency-converter',
    name: 'Frequency converter',
    description: 'Convert between Hz, kHz, MHz, GHz, THz, and rpm.',
    category: 'measurement',
    icon: 'radio',
    keywords: ['frequency', 'hertz', 'kilohertz', 'megahertz', 'gigahertz', 'terahertz', 'rpm', 'revolutions per minute'],
    dependencies: [],
  },
  () => import('./FrequencyConverter.vue'),
);

export { metadata };

export {
  useFrequencyConverter,
  convertFrequency,
  FREQUENCY_UNITS,
  formatFrequency,
} from './useFrequencyConverter';
export type { UseFrequencyConverterReturn } from './useFrequencyConverter';

export default component;
