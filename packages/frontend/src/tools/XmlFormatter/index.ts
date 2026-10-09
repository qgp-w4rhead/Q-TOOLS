/**
 * XmlFormatter tool module - exports the lazy-loaded component plus its
 * metadata and composable so the tool can be registered in the registry
 * and routed dynamically.
 *
 * The `fast-xml-parser` package is part of the initial bundle (per
 * `tech-stack.md`), so it is statically imported inside the composable.
 * The component itself is still lazy-loaded so the XmlFormatter UI lands in
 * its own Vite chunk.
 */
import { defineAsyncComponent } from 'vue';
import type { ToolMetadata } from '@q-tools/shared';

export const metadata: ToolMetadata = {
  slug: 'xml-formatter',
  name: 'XML formatter',
  description: 'Pretty-print and format XML with syntax highlighting.',
  category: 'dev',
  icon: 'code',
  keywords: ['xml', 'format', 'prettify', 'beautify', 'highlight'],
  dependencies: ['fast-xml-parser'],
};

export {
  useXmlFormatter,
  formatXml,
  buildParser,
  buildBuilder,
  validateXml,
  highlightXml,
  DEFAULT_INDENT,
  DEFAULT_TRIM,
  DEFAULT_PRESERVE_COMMENTS,
  DEFAULT_PRESERVE_CDATA,
  DEFAULT_COLLAPSE_EMPTY,
  COMMENT_PROP,
  CDATA_PROP,
  TEXT_PROP,
  ATTR_PREFIX,
} from './useXmlFormatter';
export type {
  XmlIndent,
  XmlFormatterOptions,
  XmlFormatterResult,
  XmlFormatterError,
  XmlFormatterOutputs,
  XmlTokenClass,
  UseXmlFormatterReturn,
} from './useXmlFormatter';

const XmlFormatter = defineAsyncComponent(
  () => import('./XmlFormatter.vue'),
);

export default XmlFormatter;
