/**
 * HtmlWysiwygEditor tool module - exports the lazy-loaded component plus its
 * metadata and composable so the tool can be registered in the registry and
 * routed dynamically.
 *
 * The Tiptap packages (`@tiptap/vue-3` + `@tiptap/starter-kit`) are
 * lazy-loaded inside the composable (per `tech-stack.md`) so they land in a
 * separate Vite chunk loaded only when this tool is opened. The component
 * itself is also lazy-loaded so the UI lands in its own chunk.
 */
import { defineAsyncComponent } from 'vue';
import type { ToolMetadata } from '@q-tools/shared';

export const metadata: ToolMetadata = {
  slug: 'html-wysiwyg-editor',
  name: 'HTML WYSIWYG editor',
  description: 'Rich text editor producing clean HTML and Markdown.',
  category: 'web',
  icon: 'edit',
  keywords: ['html', 'wysiwyg', 'rich', 'editor', 'tiptap', 'markdown'],
  dependencies: ['@tiptap/vue-3', '@tiptap/starter-kit'],
  // Embed mode copy buttons need the async Clipboard API.
  iframeRequirements: ['clipboard-write'],
};

export {
  useHtmlWysiwygEditor,
  ensureTiptapModule,
  htmlToMarkdown,
  escapeMarkdown,
  promptLinkUrl,
  DEFAULT_INITIAL_HTML,
} from './useHtmlWysiwygEditor';
export type {
  HeadingLevel,
  OutputFormat,
  HtmlWysiwygEditorError,
  UseHtmlWysiwygEditorReturn,
} from './useHtmlWysiwygEditor';

const HtmlWysiwygEditor = defineAsyncComponent(
  () => import('./HtmlWysiwygEditor.vue'),
);

export default HtmlWysiwygEditor;
