/**
 * CoordinateConverter tool module.
 *
 * No external dependencies - pure arithmetic only.
 */
import { defineTool } from '@/tools/defineTool';

const { metadata, component } = defineTool(
  {
    slug: 'coordinate-converter',
    name: 'Coordinate Converter',
    description: 'Convert coordinates between decimal, DMS (degrees/minutes/seconds), UTM, and MGRS formats.',
    category: 'geo',
    icon: 'map-pin',
    keywords: ['coordinate', 'convert', 'decimal', 'dms', 'utm', 'mgrs', 'latitude', 'longitude', 'wgs84'],
    dependencies: [],
  },
  () => import('./CoordinateConverter.vue'),
);

export { metadata };

export {
  useCoordinateConverter,
  convertCoordinates,
  decimalToDMS,
  dmsToDecimal,
  decimalToUTM,
  utmToDecimal,
  utmToMGRS,
  mgrsToUTM,
  parseDMS,
  parseUTM,
  parseMGRS,
  formatDMS,
  formatUTM,
  formatMGRS,
} from './useCoordinateConverter';
export type {
  CoordFormat,
  DMSComponent,
  DMSResult,
  UTMResult,
  MGRSResult,
  ConvertResult,
  UseCoordinateConverterReturn,
} from './useCoordinateConverter';

export default component;
