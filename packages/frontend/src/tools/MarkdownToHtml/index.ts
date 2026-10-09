/**
 * MarkdownToHtml tool module - exports the lazy-loaded component plus its
 * metadata and composable so the tool can be registered in the registry
 * and routed dynamically.
 *
 * The `marked` package is part of the initial bundle (per `tech-stack.md`),
 * so it is statically imported inside the composable. The component itself
 * is still lazy-loaded so the MarkdownToHtml UI lands in its own Vite chunk.
 */
import { defineAsyncComponent } from 'vue';
import type { ToolMetadata } from '@q-tools/shared';

export const metadata: ToolMetadata = {
  slug: 'markdown-to-html',
  name: 'Markdown to HTML',
  description: 'Render Markdown to sanitized HTML.',
  category: 'converter',
  icon: 'file-text',
  keywords: ['markdown', 'html', 'render'],
  dependencies: ['marked'],
};

export {
  useMarkdownToHtml,
  renderMarkdown,
  sanitizeHtml,
  markdownToHtml,
  DEFAULT_GFM,
  DEFAULT_BREAKS,
  DEFAULT_SANITIZE,
} from './useMarkdownToHtml';
export type {
  MarkdownToHtmlOptions,
  MarkdownToHtmlResult,
  MarkdownToHtmlError,
  MarkdownToHtmlOutputs,
  UseMarkdownToHtmlReturn,
} from './useMarkdownToHtml';

const MarkdownToHtml = defineAsyncComponent(
  () => import('./MarkdownToHtml.vue'),
);

export default MarkdownToHtml;
