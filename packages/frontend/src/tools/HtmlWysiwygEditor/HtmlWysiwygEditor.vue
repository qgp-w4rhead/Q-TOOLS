<script setup lang="ts">
/**
 * HtmlWysiwygEditor — Tiptap-based rich text editor producing HTML + Markdown.
 *
 * The Tiptap packages (`@tiptap/vue-3` + `@tiptap/starter-kit`) are
 * dynamically imported inside the composable so they land in a separate
 * Vite chunk loaded only when this tool is opened. The `EditorContent`
 * component is exposed via `editorContentComponent` and rendered through
 * `<component :is>` so it never touches the main bundle.
 *
 * Toolbar: bold, italic, underline, strikethrough, inline code, H1/H2/H3,
 * bullet list, ordered list, code block, blockquote, link, clear formatting.
 * Output panes: HTML (Tiptap's `getHTML()`) and Markdown (hand-rolled
 * `htmlToMarkdown`), each with a CopyButton.
 *
 * Works in embed mode: receives `input` PostMessages to set the editor
 * content (`{ html }` or `{ content }`), and sends `output` PostMessages
 * with `{ html, markdown }` whenever the editor updates. Embedding sites
 * should add `allow="clipboard-write"` to the iframe so the copy buttons
 * can use the async Clipboard API.
 */
import { computed, ref } from 'vue';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Code as CodeIcon,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Code2,
  Quote,
  Link as LinkIcon,
  RemoveFormatting,
  Eye,
  FileCode,
  Loader2,
  AlertCircle,
} from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import CopyButton from '@/components/CopyButton.vue';
import { useHtmlWysiwygEditor, type HeadingLevel, type OutputFormat } from './useHtmlWysiwygEditor';

const {
  html,
  markdown,
  loading,
  error,
  editorReady,
  editorContentComponent,
  isActive,
  isEmbed,
  toggleBold,
  toggleItalic,
  toggleUnderline,
  toggleStrike,
  toggleCode,
  toggleBulletList,
  toggleOrderedList,
  toggleCodeBlock,
  toggleBlockquote,
  setHeading,
  insertLink,
  clearFormatting,
} = useHtmlWysiwygEditor();

const outputMode = ref<OutputFormat>('html');

const description = computed(() =>
  'Rich text editor (Tiptap) with bold, italic, underline, headings, lists, links, and code blocks. Outputs clean HTML and Markdown.',
);

const htmlBytes = computed(() => new TextEncoder().encode(html.value).length);
const mdBytes = computed(() => new TextEncoder().encode(markdown.value).length);

const outputDescription = computed(() => {
  if (!editorReady.value) return 'Editor is loading…';
  if (outputMode.value === 'html') return `${htmlBytes.value} bytes`;
  return `${mdBytes.value} bytes`;
});

const copyText = computed(() => (outputMode.value === 'html' ? html.value : markdown.value));
const copyLabel = computed(() => (outputMode.value === 'html' ? 'Copy HTML' : 'Copy Markdown'));

function onHeading(level: HeadingLevel): void {
  // Toggle: if already active at this level, demote to paragraph.
  if (isActive.value.heading === level) {
    setHeading(false);
  } else {
    setHeading(level);
  }
}

function setOutput(mode: OutputFormat): void {
  outputMode.value = mode;
}
</script>

<template>
  <div class="hwe">
    <ToolInput title="Rich text editor" :description="description">
      <template #actions>
        <span v-if="isEmbed" class="hwe__embed-badge" title="Embed mode — add allow=&quot;clipboard-write&quot; to the iframe for copy support.">
          embed
        </span>
      </template>

      <!-- Toolbar -->
      <div class="hwe__toolbar" role="toolbar" aria-label="Formatting">
        <button
          class="hwe__btn"
          :class="{ 'hwe__btn--active': isActive.bold }"
          type="button"
          title="Bold (Ctrl+B)"
          :disabled="!editorReady"
          @click="toggleBold"
        >
          <Bold :size="16" />
        </button>
        <button
          class="hwe__btn"
          :class="{ 'hwe__btn--active': isActive.italic }"
          type="button"
          title="Italic (Ctrl+I)"
          :disabled="!editorReady"
          @click="toggleItalic"
        >
          <Italic :size="16" />
        </button>
        <button
          class="hwe__btn"
          :class="{ 'hwe__btn--active': isActive.underline }"
          type="button"
          title="Underline (Ctrl+U)"
          :disabled="!editorReady"
          @click="toggleUnderline"
        >
          <UnderlineIcon :size="16" />
        </button>
        <button
          class="hwe__btn"
          :class="{ 'hwe__btn--active': isActive.strike }"
          type="button"
          title="Strikethrough"
          :disabled="!editorReady"
          @click="toggleStrike"
        >
          <Strikethrough :size="16" />
        </button>
        <button
          class="hwe__btn"
          :class="{ 'hwe__btn--active': isActive.code }"
          type="button"
          title="Inline code"
          :disabled="!editorReady"
          @click="toggleCode"
        >
          <CodeIcon :size="16" />
        </button>

        <span class="hwe__sep" aria-hidden="true" />

        <button
          class="hwe__btn"
          :class="{ 'hwe__btn--active': isActive.heading === 1 }"
          type="button"
          title="Heading 1"
          :disabled="!editorReady"
          @click="onHeading(1)"
        >
          <Heading1 :size="16" />
        </button>
        <button
          class="hwe__btn"
          :class="{ 'hwe__btn--active': isActive.heading === 2 }"
          type="button"
          title="Heading 2"
          :disabled="!editorReady"
          @click="onHeading(2)"
        >
          <Heading2 :size="16" />
        </button>
        <button
          class="hwe__btn"
          :class="{ 'hwe__btn--active': isActive.heading === 3 }"
          type="button"
          title="Heading 3"
          :disabled="!editorReady"
          @click="onHeading(3)"
        >
          <Heading3 :size="16" />
        </button>

        <span class="hwe__sep" aria-hidden="true" />

        <button
          class="hwe__btn"
          :class="{ 'hwe__btn--active': isActive.bulletList }"
          type="button"
          title="Bullet list"
          :disabled="!editorReady"
          @click="toggleBulletList"
        >
          <List :size="16" />
        </button>
        <button
          class="hwe__btn"
          :class="{ 'hwe__btn--active': isActive.orderedList }"
          type="button"
          title="Ordered list"
          :disabled="!editorReady"
          @click="toggleOrderedList"
        >
          <ListOrdered :size="16" />
        </button>
        <button
          class="hwe__btn"
          :class="{ 'hwe__btn--active': isActive.codeBlock }"
          type="button"
          title="Code block"
          :disabled="!editorReady"
          @click="toggleCodeBlock"
        >
          <Code2 :size="16" />
        </button>
        <button
          class="hwe__btn"
          :class="{ 'hwe__btn--active': isActive.blockquote }"
          type="button"
          title="Blockquote"
          :disabled="!editorReady"
          @click="toggleBlockquote"
        >
          <Quote :size="16" />
        </button>
        <button
          class="hwe__btn"
          :class="{ 'hwe__btn--active': isActive.link }"
          type="button"
          title="Insert / edit link"
          :disabled="!editorReady"
          @click="insertLink"
        >
          <LinkIcon :size="16" />
        </button>

        <span class="hwe__sep" aria-hidden="true" />

        <button
          class="hwe__btn"
          type="button"
          title="Clear formatting"
          :disabled="!editorReady"
          @click="clearFormatting"
        >
          <RemoveFormatting :size="16" />
        </button>
      </div>

      <!-- Editor surface -->
      <div class="hwe__surface">
        <p v-if="error" class="hwe__error">
          <AlertCircle :size="14" />
          <span>{{ error.message }}</span>
        </p>
        <div v-if="loading" class="hwe__loading">
          <Loader2 :size="18" class="hwe__spin" />
          <span>Loading editor…</span>
        </div>
        <component
          v-else-if="editorContentComponent"
          :is="editorContentComponent"
          class="hwe__content"
        />
      </div>
    </ToolInput>

    <ToolOutput
      title="Output"
      :description="outputDescription"
      :copy-text="copyText"
      :copy-label="copyLabel"
    >
      <div class="hwe__result">
        <div class="hwe__result-head">
          <div class="hwe__tabs">
            <button
              class="hwe__tab"
              :class="{ 'hwe__tab--active': outputMode === 'html' }"
              type="button"
              @click="setOutput('html')"
            >
              <FileCode :size="14" />
              <span>HTML</span>
            </button>
            <button
              class="hwe__tab"
              :class="{ 'hwe__tab--active': outputMode === 'markdown' }"
              type="button"
              @click="setOutput('markdown')"
            >
              <Eye :size="14" />
              <span>Markdown</span>
            </button>
          </div>
          <CopyButton :text="copyText" :label="copyLabel" icon-only />
        </div>

        <pre v-if="outputMode === 'html'" class="hwe__code">{{ html }}</pre>
        <pre v-else class="hwe__code">{{ markdown }}</pre>
      </div>
    </ToolOutput>
  </div>
</template>

<style scoped>
.hwe {
  display: flex;
  flex-direction: column;
  gap: var(--qt-gap);
  max-width: var(--qt-max-content);
  margin: 0 auto;
}

/* Embed badge */
.hwe__embed-badge {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--qt-muted);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  padding: 2px 6px;
}

/* Toolbar */
.hwe__toolbar {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
  background: var(--qt-surface);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  padding: 6px 8px;
}
.hwe__btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 4px;
  color: var(--qt-text);
  cursor: pointer;
  transition:
    background-color 0.12s ease,
    border-color 0.12s ease,
    color 0.12s ease;
  will-change: background-color, color;
}
.hwe__btn:hover:not(:disabled) {
  background: var(--qt-bg);
  border-color: var(--qt-border);
}
.hwe__btn:active:not(:disabled) {
  transform: translateY(1px);
}
.hwe__btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.hwe__btn--active {
  background: oklch(from var(--qt-accent) 90% c h / 0.18);
  border-color: oklch(from var(--qt-accent) 80% c h / 0.5);
  color: var(--qt-accent);
}
.hwe__sep {
  display: inline-block;
  width: 1px;
  height: 20px;
  background: var(--qt-border);
  margin: 0 4px;
}

/* Editor surface */
.hwe__surface {
  position: relative;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  min-height: 280px;
  overflow: hidden;
}
.hwe__content {
  /* The EditorContent root — let Tiptap's ProseMirror fill the surface. */
  min-height: 280px;
}
.hwe__content :deep(.ProseMirror) {
  outline: none;
  padding: 12px 14px;
  min-height: 280px;
  color: var(--qt-text);
  font-size: 14px;
  line-height: 1.6;
  word-wrap: break-word;
}
.hwe__content :deep(.ProseMirror:focus) {
  outline: none;
}
.hwe__content :deep(.ProseMirror p) {
  margin: 0.6em 0;
}
.hwe__content :deep(.ProseMirror h1),
.hwe__content :deep(.ProseMirror h2),
.hwe__content :deep(.ProseMirror h3) {
  margin: 1em 0 0.5em;
  line-height: 1.25;
  font-weight: 700;
  color: var(--qt-text);
}
.hwe__content :deep(.ProseMirror h1) { font-size: 1.7em; }
.hwe__content :deep(.ProseMirror h2) { font-size: 1.5em; }
.hwe__content :deep(.ProseMirror h3) { font-size: 1.3em; }
.hwe__content :deep(.ProseMirror ul),
.hwe__content :deep(.ProseMirror ol) {
  margin: 0.6em 0;
  padding-left: 1.6em;
}
.hwe__content :deep(.ProseMirror li) {
  margin: 0.25em 0;
}
.hwe__content :deep(.ProseMirror li p) {
  margin: 0;
}
.hwe__content :deep(.ProseMirror blockquote) {
  margin: 0.8em 0;
  padding: 0.2em 1em;
  border-left: 3px solid var(--qt-accent);
  color: var(--qt-muted);
  background: oklch(from var(--qt-surface) 95% c h / 0.5);
}
.hwe__content :deep(.ProseMirror blockquote p) {
  margin: 0.4em 0;
}
.hwe__content :deep(.ProseMirror code) {
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
  font-size: 0.9em;
  background: var(--qt-surface);
  border: 1px solid var(--qt-border);
  border-radius: 4px;
  padding: 0.1em 0.35em;
}
.hwe__content :deep(.ProseMirror pre) {
  margin: 0.8em 0;
  padding: 0.8em 1em;
  background: var(--qt-surface);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  overflow: auto;
}
.hwe__content :deep(.ProseMirror pre code) {
  background: transparent;
  border: none;
  padding: 0;
  font-size: 13px;
  line-height: 1.5;
  color: var(--qt-text);
}
.hwe__content :deep(.ProseMirror a) {
  color: var(--qt-accent);
  text-decoration: underline;
  text-underline-offset: 2px;
  cursor: pointer;
}
.hwe__content :deep(.ProseMirror hr) {
  border: none;
  border-top: 1px solid var(--qt-border);
  margin: 1.2em 0;
}
.hwe__content :deep(.ProseMirror strong) { font-weight: 700; }
.hwe__content :deep(.ProseMirror em) { font-style: italic; }
.hwe__content :deep(.ProseMirror u) { text-decoration: underline; }
.hwe__content :deep(.ProseMirror s) { text-decoration: line-through; color: var(--qt-muted); }

/* Loading + error */
.hwe__loading {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--qt-muted);
  font-size: 13.5px;
  padding: 20px 14px;
}
.hwe__spin {
  animation: hwe-spin 0.9s linear infinite;
}
@keyframes hwe-spin {
  to { transform: rotate(360deg); }
}
.hwe__error {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 0;
  padding: 10px 14px;
  color: var(--qt-danger);
  font-size: 13.5px;
  line-height: 1.4;
  background: oklch(from var(--qt-danger) 90% c h / 0.1);
}

/* Output */
.hwe__result {
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.hwe__result-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.hwe__tabs {
  display: flex;
  gap: 4px;
  flex: 1;
}
.hwe__tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--qt-radius-sm);
  color: var(--qt-muted);
  font: inherit;
  font-size: 12.5px;
  font-weight: 600;
  padding: 5px 10px;
  cursor: pointer;
  transition:
    color 0.15s ease,
    background-color 0.15s ease,
    border-color 0.15s ease;
  will-change: color, background-color;
}
.hwe__tab:hover {
  color: var(--qt-text);
}
.hwe__tab--active {
  color: var(--qt-text);
  background: var(--qt-surface);
  border-color: var(--qt-border);
}
.hwe__code {
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
  font-size: 13.5px;
  color: var(--qt-text);
  white-space: pre-wrap;
  word-break: break-word;
  margin: 0;
  max-height: 50vh;
  overflow: auto;
}
</style>
