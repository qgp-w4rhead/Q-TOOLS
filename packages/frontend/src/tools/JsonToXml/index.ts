/**
 * JsonToXml tool module — exports the lazy-loaded component plus its
 * metadata and composable so the tool can be registered in the registry
 * and routed dynamically.
 *
 * The `fast-xml-parser` package is part of the initial bundle (per
 * `tech-stack.md`), so it is statically imported inside the composable.
 * The component itself is still lazy-loaded so the JsonToXml UI lands in
 * its own Vite chunk.
 */
import { defineAsyncComponent } from 'vue';
import type { ToolMetadata } from '@q-tools/shared';

export const metadata: ToolMetadata = {
  slug: 'json-to-xml',
  name: 'JSON to XML',
  description: 'Convert JSON documents to XML.',
  category: 'converter',
  icon: 'code',
  keywords: ['json', 'xml', 'convert'],
  dependencies: ['fast-xml-parser'],
};

export {
  useJsonToXml,
  jsonToXml,
  parseJson,
  buildBuilder,
  enrichError,
  DEFAULT_ROOT_NAME,
  DEFAULT_ATTRIBUTE_PREFIX,
  DEFAULT_PRETTY,
  DEFAULT_INDENT,
  TEXT_NODE_NAME,
} from './useJsonToXml';
export type {
  XmlIndent,
  JsonToXmlOptions,
  JsonToXmlResult,
  JsonToXmlError,
  JsonToXmlOutputs,
  UseJsonToXmlReturn,
} from './useJsonToXml';

const JsonToXml = defineAsyncComponent(
  () => import('./JsonToXml.vue'),
);

export default JsonToXml;
