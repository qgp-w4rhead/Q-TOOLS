/**
 * XmlToJson tool module - exports the lazy-loaded component plus its
 * metadata and composable so the tool can be registered in the registry
 * and routed dynamically.
 *
 * The `fast-xml-parser` package is part of the initial bundle (per
 * `tech-stack.md`), so it is statically imported inside the composable.
 * The component itself is still lazy-loaded so the XmlToJson UI lands in
 * its own Vite chunk.
 */
import { defineAsyncComponent } from 'vue';
import type { ToolMetadata } from '@q-tools/shared';

export const metadata: ToolMetadata = {
  slug: 'xml-to-json',
  name: 'XML to JSON',
  description: 'Convert XML documents to JSON.',
  category: 'converter',
  icon: 'code',
  keywords: ['xml', 'json', 'convert'],
  dependencies: ['fast-xml-parser'],
};

export {
  useXmlToJson,
  xmlToJson,
  parseXml,
  validateXml,
  buildParser,
  DEFAULT_ATTRIBUTE_PREFIX,
  DEFAULT_ARRAY_MODE,
  DEFAULT_TRIM,
  DEFAULT_INDENT,
} from './useXmlToJson';
export type {
  JsonIndent,
  ArrayMode,
  XmlToJsonOptions,
  XmlToJsonResult,
  XmlParseError,
  XmlToJsonOutputs,
  UseXmlToJsonReturn,
} from './useXmlToJson';

const XmlToJson = defineAsyncComponent(
  () => import('./XmlToJson.vue'),
);

export default XmlToJson;
