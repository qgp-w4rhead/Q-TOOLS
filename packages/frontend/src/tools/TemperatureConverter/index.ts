/**
 * TemperatureConverter tool module — exports the lazy-loaded component plus
 * its metadata and composable so the tool can be registered in the registry
 * and routed dynamically.
 *
 * Converts between eight temperature scales (Celsius, Fahrenheit, Kelvin,
 * Rankine, Delisle, Newton, Réaumur, Rømer) via a Kelvin canonical
 * intermediate.
 *
 * No external dependencies — pure arithmetic only.
 */
import { defineAsyncComponent } from 'vue';
import type { ToolMetadata } from '@q-tools/shared';

export const metadata: ToolMetadata = {
  slug: 'temperature-converter',
  name: 'Temperature converter',
  description: 'Convert between Celsius, Fahrenheit, Kelvin, Rankine, Delisle, Newton, Réaumur, and Rømer.',
  category: 'measurement',
  icon: 'thermometer',
  keywords: ['temperature', 'celsius', 'fahrenheit', 'kelvin', 'rankine', 'delisle', 'newton', 'reaumur', 'romer'],
  dependencies: [],
};

export {
  useTemperatureConverter,
  parseNumber,
  parseUnit,
  toKelvin,
  fromKelvin,
  convertTemperature,
  formatNumber,
  UNIT_ORDER,
  UNIT_META,
} from './useTemperatureConverter';
export type {
  TemperatureUnit,
  UnitMeta,
  ConvertResult,
  UseTemperatureConverterReturn,
} from './useTemperatureConverter';

const TemperatureConverter = defineAsyncComponent(
  () => import('./TemperatureConverter.vue'),
);

export default TemperatureConverter;
