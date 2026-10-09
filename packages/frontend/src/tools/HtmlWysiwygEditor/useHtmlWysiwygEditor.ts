/**
 * useHtmlWysiwygEditor - composable + pure logic for the HTML WYSIWYG editor.
 *
 * Provides a Tiptap-based rich text editor (`@tiptap/vue-3` +
 * `@tiptap/starter-kit`, both lazy-loaded per `tech-stack.md` so Vite emits
 * them as separate chunks loaded only when the user opens this tool). The
 * editor supports bold, italic, underline, strikethrough, inline code, code
 * blocks, headings (H1–H3), bullet/ordered lists, blockquotes, links, and
 * horizontal rules - everything `StarterKit` ships.
 *
 * Outputs:
 *  - **HTML** - `editor.getHTML()` (Tiptap's canonical serialisation).
 *  - **Markdown** - a hand-rolled DOM-based HTML→Markdown converter
 *    (`htmlToMarkdown`) that handles the subset of tags Tiptap emits. No
 *    external Markdown library is needed (keeps the lazy chunk small and
 *    avoids an unlisted dependency).
 *
 * The `EditorContent` component from `@tiptap/vue-3` is exposed via a
 * `shallowRef` (`editorContentComponent`) that is populated after the dynamic
 * import resolves, so the template can render it through `<component :is>`
 * without statically importing the package (which would pull it into the
 * main bundle).
 *
 * Pure helpers (`htmlToMarkdown`, `escapeMarkdown`, `promptLinkUrl`) have no
 * Vue dependency and can be imported standalone for unit testing or reuse.
 * The `useHtmlWysiwygEditor()` composable wraps the editor lifecycle in
 * reactive state and wires up the embed PostMessage protocol.
 *
 * Dependencies: `@tiptap/vue-3`, `@tiptap/starter-kit` (both lazy-loaded).
 */
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch, type Ref } from 'vue';
import type { Editor } from '@tiptap/vue-3';
import { useEmbed } from '@/composables/useEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Pure logic - no Vue dependency below this point                             */
/* -------------------------------------------------------------------------- */

/** Heading levels supported by the toolbar. */
export type HeadingLevel = 1 | 2 | 3;

/** Output formats produced by the editor. */
export type OutputFormat = 'html' | 'markdown';

/** Normalised error from editor initialisation or conversion. */
export interface HtmlWysiwygEditorError {
  message: string;
}

/**
 * Escape a run of text for safe inclusion in Markdown. Escapes the ASCII
 * punctuation that has special meaning in CommonMark when it would otherwise
 * be interpreted as markup. We escape conservatively (only the characters
 * that commonly trigger unwanted formatting) so the output stays readable.
 */
export function escapeMarkdown(text: string): string {
  if (typeof text !== 'string' || text.length === 0) return '';
  return text.replace(/([\\`*_{\}\[\]()#+\-.!~|>])/g, '\\$1');
}

/** Default initial content shown in the editor on first load. */
export const DEFAULT_INITIAL_HTML =
  '<h2>Welcome to the WYSIWYG editor</h2>' +
  '<p>This is a <strong>rich text</strong> editor built with ' +
  '<em>Tiptap</em>. Try the <u>underline</u> button, make a ' +
  '<a href="https://tiptap.dev">link</a>, or insert a code block:</p>' +
  '<pre><code>const hello = "world";</code></pre>' +
  '<ul><li><p>Bullet item one</p></li><li><p>Bullet item two</p></li></ul>';

/**
 * Prompt the user for a URL via `window.prompt`. Returns the trimmed URL or
 * an empty string when cancelled. Pure-ish helper (uses `window.prompt`) -
 * extracted so it can be mocked in tests and so the composable stays thin.
 * When `currentUrl` is provided, it is pre-filled so the user can edit an
 * existing link.
 */
export function promptLinkUrl(currentUrl: string = ''): string {
  if (typeof window === 'undefined' || typeof window.prompt !== 'function') {
    return '';
  }
  const input = window.prompt('Link URL:', currentUrl);
  if (input === null) return '';
  return input.trim();
}

/**
 * Convert an HTML string to Markdown. Uses the browser DOM API (`DOMParser`)
 * to walk the parsed tree and emit CommonMark-flavoured Markdown. Handles the
 * subset of tags that Tiptap's StarterKit produces:
 *
 *   h1–h6, p, strong/b, em/i, u, s/del/strike, code (inline),
 *   pre>code (block), ul>li, ol>li, blockquote, a, hr, br, img.
 *
 * Unknown tags are unwrapped (their children are still converted). Text
 * outside any block is wrapped in paragraphs. Returns an empty string for
 * empty/whitespace-only input.
 *
 * When `DOMParser` is unavailable (SSR / non-DOM env), falls back to a
 * tag-stripping regex pass that preserves basic structure (headings, lists,
 * emphasis, links, code blocks).
 */
export function htmlToMarkdown(html: string): string {
  if (typeof html !== 'string' || html.trim().length === 0) return '';

  if (typeof DOMParser === 'undefined') {
    return htmlToMarkdownFallback(html);
  }

  const doc = new DOMParser().parseFromString(html, 'text/html');
  const out = convertNode(doc.body, { inList: false, ordered: false, depth: 0 });
  // Collapse 3+ consecutive newlines down to 2 (paragraph break).
  return out.replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

/** Internal conversion context passed through the recursive walker. */
interface ConvertContext {
  /** True when inside a list item (suppresses trailing paragraph breaks). */
  inList: boolean;
  /** True for ordered lists, false for bullet lists. */
  ordered: boolean;
  /** Blockquote nesting depth (0 = not in a blockquote). */
  depth: number;
}

/** Prefix for blockquote lines at a given depth. */
function quotePrefix(depth: number): string {
  return depth > 0 ? '> '.repeat(depth) : '';
}

/**
 * Recursively convert a DOM node to a Markdown string. Block-level elements
 * are followed by a blank line; inline elements are concatenated into the
 * current line. The `ctx` controls list/blockquote prefixes.
 */
function convertNode(node: Node, ctx: ConvertContext): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return escapeMarkdown(node.textContent ?? '');
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return '';

  const el = node as Element;
  const tag = el.tagName.toLowerCase();
  const prefix = quotePrefix(ctx.depth);

  switch (tag) {
    case 'h1':
    case 'h2':
    case 'h3':
    case 'h4':
    case 'h5':
    case 'h6': {
      const level = Number(tag.charAt(1));
      const hashes = '#'.repeat(level);
      const text = inlineChildren(el, ctx).trim();
      if (!text) return '';
      return `\n\n${prefix}${hashes} ${text}\n\n`;
    }
    case 'p': {
      const text = inlineChildren(el, ctx).trim();
      if (!text) return '';
      // Inside list items, paragraphs are joined with a soft line break.
      if (ctx.inList) return `${text}\n`;
      return `\n\n${prefix}${text}\n\n`;
    }
    case 'br': {
      // Two trailing spaces + newline = hard line break in CommonMark.
      return '  \n';
    }
    case 'hr': {
      return `\n\n${prefix}---\n\n`;
    }
    case 'blockquote': {
      const inner = convertChildren(el, {
        inList: ctx.inList,
        ordered: ctx.ordered,
        depth: ctx.depth + 1,
      }).trim();
      if (!inner) return '';
      return `\n\n${inner}\n\n`;
    }
    case 'pre': {
      // <pre><code>...</code></pre> → fenced code block. Prefer the code
      // child's text content; fall back to the pre's own text.
      const codeEl = el.querySelector('code');
      const raw = (codeEl ?? el).textContent ?? '';
      const lang = codeEl ? inferCodeLang(codeEl) : '';
      const fence = '`'.repeat(longestFence(raw) + 1);
      const body = raw.replace(/\n$/, '');
      return `\n\n${prefix}${fence}${lang}\n${body}\n${fence}\n\n`;
    }
    case 'ul':
    case 'ol': {
      const ordered = tag === 'ol';
      const items = Array.from(el.children).filter((c) =>
        c.tagName.toLowerCase() === 'li',
      );
      if (items.length === 0) return '';
      const lines: string[] = [];
      items.forEach((li, i) => {
        const marker = ordered ? `${i + 1}.` : '-';
        const body = convertChildren(li, {
          inList: true,
          ordered,
          depth: ctx.depth,
        }).trim();
        // Indent continuation lines by the marker width so nested content
        // aligns under the first character of the item text.
        const indent = ' '.repeat(marker.length + 1);
        const indented = body.replace(/\n/g, '\n' + indent);
        lines.push(`${prefix}${marker} ${indented}`);
      });
      return `\n\n${lines.join('\n')}\n\n`;
    }
    case 'img': {
      const src = el.getAttribute('src') ?? '';
      const alt = el.getAttribute('alt') ?? '';
      if (!src) return '';
      return `![${alt}](${src})`;
    }
    case 'script':
    case 'style':
    case 'template':
      return '';
    default: {
      // Unknown / inline-only container - unwrap and recurse.
      return convertChildren(el, ctx);
    }
  }
}

/** Convert all child nodes of `el` and concatenate the results. */
function convertChildren(el: Element, ctx: ConvertContext): string {
  let out = '';
  for (const child of Array.from(el.childNodes)) {
    out += convertNode(child, ctx);
  }
  return out;
}

/**
 * Convert the inline children of `el` (text + inline marks). Block-level
 * children are still handled by `convertNode` (e.g. a `<p>` inside a list
 * item), but the common case is a run of text/strong/em/a/code.
 */
function inlineChildren(el: Element, ctx: ConvertContext): string {
  let out = '';
  for (const child of Array.from(el.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      out += escapeMarkdown(child.textContent ?? '');
      continue;
    }
    if (child.nodeType !== Node.ELEMENT_NODE) continue;
    const childEl = child as Element;
    const tag = childEl.tagName.toLowerCase();
    const inner = inlineChildren(childEl, ctx);
    switch (tag) {
      case 'strong':
      case 'b':
        out += inner.trim().length ? `**${inner}**` : '';
        break;
      case 'em':
      case 'i':
        out += inner.trim().length ? `*${inner}*` : '';
        break;
      case 'u':
        // Markdown has no underline syntax - preserve the HTML tag.
        out += inner.trim().length ? `<u>${inner}</u>` : '';
        break;
      case 's':
      case 'del':
      case 'strike':
        out += inner.trim().length ? `~~${inner}~~` : '';
        break;
      case 'code':
        // Inline code - use enough backticks to avoid conflicts.
        const fence = '`'.repeat(longestFence(inner) + 1);
        out += inner ? `${fence}${inner}${fence}` : '';
        break;
      case 'a': {
        const href = childEl.getAttribute('href') ?? '';
        if (!href) {
          out += inner;
        } else {
          out += `[${inner}](${href})`;
        }
        break;
      }
      case 'br':
        out += '  \n';
        break;
      case 'img': {
        out += convertNode(childEl, ctx);
        break;
      }
      default:
        // Unknown inline element - unwrap.
        out += inner;
    }
  }
  return out;
}

/** Return the length of the longest run of backticks in `text` (min 0). */
function longestFence(text: string): number {
  if (!text) return 0;
  let max = 0;
  let cur = 0;
  for (const ch of text) {
    if (ch === '`') {
      cur += 1;
      if (cur > max) max = cur;
    } else {
      cur = 0;
    }
  }
  return max;
}

/** Extract a language hint from a `<code class="language-xxx">` element. */
function inferCodeLang(codeEl: Element): string {
  const cls = codeEl.getAttribute('class') ?? '';
  const m = /language-(\S+)/.exec(cls);
  return m ? m[1]! : '';
}

/**
 * Regex-based fallback used when `DOMParser` is unavailable. Handles the
 * common Tiptap tags; less precise than the DOM walker but produces
 * readable Markdown for headings, emphasis, links, lists, and code blocks.
 */
function htmlToMarkdownFallback(html: string): string {
  let out = html;
  out = out.replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi, (_m, lvl, body) => {
    return `\n\n${'#'.repeat(Number(lvl))} ${stripTags(body).trim()}\n\n`;
  });
  out = out.replace(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, (_m, body) => {
    return `\n\n\`\`\`\n${decodeEntities(body).replace(/\n$/, '')}\n\`\`\`\n\n`;
  });
  out = out.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, (_m, body) => '`' + stripTags(body) + '`');
  out = out.replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, '**$1**');
  out = out.replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, '**$1**');
  out = out.replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, '*$1*');
  out = out.replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, '*$1*');
  out = out.replace(/<u[^>]*>([\s\S]*?)<\/u>/gi, '<u>$1</u>');
  out = out.replace(/<s[^>]*>([\s\S]*?)<\/s>/gi, '~~$1~~');
  out = out.replace(/<del[^>]*>([\s\S]*?)<\/del>/gi, '~~$1~~');
  out = out.replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)');
  out = out.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '- $1\n');
  out = out.replace(/<\/?(ul|ol)[^>]*>/gi, '\n');
  out = out.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_m, body) =>
    '> ' + stripTags(body).trim().replace(/\n/g, '\n> '),
  );
  out = out.replace(/<hr[^>]*>/gi, '\n\n---\n\n');
  out = out.replace(/<br\s*\/?>/gi, '  \n');
  out = out.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '$1\n\n');
  out = stripTags(out);
  out = decodeEntities(out);
  return out.replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

/** Remove all remaining HTML tags from a string. */
function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, '');
}

/** Decode the common HTML entities. */
function decodeEntities(html: string): string {
  return html
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

/* -------------------------------------------------------------------------- */
/* Composable - reactive state + editor lifecycle + embed integration         */
/* -------------------------------------------------------------------------- */

/** Lazy-loaded Tiptap bundle (cached after first load). */
interface TiptapBundle {
  Editor: typeof import('@tiptap/vue-3').Editor;
  EditorContent: typeof import('@tiptap/vue-3').EditorContent;
  StarterKit: typeof import('@tiptap/starter-kit').StarterKit;
}

let cachedBundle: TiptapBundle | null = null;

/**
 * Dynamically import + cache the Tiptap packages. Both `@tiptap/vue-3` and
 * `@tiptap/starter-kit` are imported together (they share a chunk graph) so
 * the editor's ~100KB lands in a single lazy chunk. Safe to call repeatedly.
 */
export async function ensureTiptapModule(): Promise<TiptapBundle> {
  if (cachedBundle) return cachedBundle;
  const [vuePkg, starterPkg] = await Promise.all([
    import('@tiptap/vue-3'),
    import('@tiptap/starter-kit'),
  ]);
  cachedBundle = {
    Editor: vuePkg.Editor,
    EditorContent: vuePkg.EditorContent,
    StarterKit: starterPkg.StarterKit,
  };
  return cachedBundle;
}

export interface UseHtmlWysiwygEditorReturn {
  /** Latest HTML output (empty until the editor fires its first update). */
  html: Ref<string>;
  /** Latest Markdown output derived from `html`. */
  markdown: Ref<string>;
  /** True while the Tiptap chunk is loading on first mount. */
  loading: Ref<boolean>;
  /** Error from editor initialisation, if any. */
  error: Ref<HtmlWysiwygEditorError | null>;
  /** True once the editor is mounted and ready to accept commands. */
  editorReady: Ref<boolean>;
  /** The `EditorContent` component (set after dynamic import). Render via `<component :is>`. */
  editorContentComponent: Ref<unknown>;
  /** Active formatting states for toolbar highlighting. */
  isActive: Ref<{
    bold: boolean;
    italic: boolean;
    underline: boolean;
    strike: boolean;
    code: boolean;
    bulletList: boolean;
    orderedList: boolean;
    codeBlock: boolean;
    blockquote: boolean;
    heading: false | HeadingLevel;
    link: boolean;
  }>;
  /** Whether the current selection can apply text marks (not at a node boundary). */
  canToggleMark: Ref<boolean>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  /** Initialise the editor (called on mount). Idempotent. */
  initEditor: (initialHtml?: string) => Promise<void>;
  /** Destroy the editor (called on unmount). */
  destroyEditor: () => void;
  /** Toolbar actions. */
  toggleBold: () => void;
  toggleItalic: () => void;
  toggleUnderline: () => void;
  toggleStrike: () => void;
  toggleCode: () => void;
  toggleBulletList: () => void;
  toggleOrderedList: () => void;
  toggleCodeBlock: () => void;
  toggleBlockquote: () => void;
  setHeading: (level: HeadingLevel | false) => void;
  setLink: (url: string) => void;
  unsetLink: () => void;
  insertLink: () => void;
  clearFormatting: () => void;
  /** Replace the editor's entire content. */
  setContent: (html: string) => void;
  /** Force a re-derivation of the Markdown output from the current HTML. */
  recomputeMarkdown: () => void;
}

export function useHtmlWysiwygEditor(): UseHtmlWysiwygEditorReturn {
  const html = ref<string>('');
  const markdown = ref<string>('');
  const loading = ref<boolean>(false);
  const error = ref<HtmlWysiwygEditorError | null>(null);
  const editorReady = ref<boolean>(false);
  const editorContentComponent = shallowRef<unknown>(null);
  const isActive = ref({
    bold: false,
    italic: false,
    underline: false,
    strike: false,
    code: false,
    bulletList: false,
    orderedList: false,
    codeBlock: false,
    blockquote: false,
    heading: false as false | HeadingLevel,
    link: false,
  });
  const canToggleMark = ref<boolean>(false);

  // Editor instance is kept in a non-reactive closure variable - Vue should
  // not traverse Tiptap's internal ProseMirror state.
  let editor: Editor | null = null;

  function toError(err: unknown): HtmlWysiwygEditorError {
    if (err instanceof Error) return { message: err.message };
    return { message: String(err) };
  }

  /** Read all active-formatting states from the editor into the reactive ref. */
  function syncActiveState(): void {
    if (!editor) return;
    isActive.value = {
      bold: editor.isActive('bold'),
      italic: editor.isActive('italic'),
      underline: editor.isActive('underline'),
      strike: editor.isActive('strike'),
      code: editor.isActive('code'),
      bulletList: editor.isActive('bulletList'),
      orderedList: editor.isActive('orderedList'),
      codeBlock: editor.isActive('codeBlock'),
      blockquote: editor.isActive('blockquote'),
      heading: resolveActiveHeading(editor),
      link: editor.isActive('link'),
    };
    canToggleMark.value = editor.can().toggleBold() || editor.can().toggleItalic();
  }

  /** Re-derive html + markdown from the editor and sync toolbar state. */
  function syncOutput(): void {
    if (!editor) return;
    const raw = editor.getHTML();
    html.value = raw;
    try {
      markdown.value = htmlToMarkdown(raw);
    } catch (e) {
      // Markdown conversion should never break the editor; surface a
      // best-effort fallback instead.
      markdown.value = raw;
      error.value = toError(e);
    }
    syncActiveState();
  }

  async function initEditor(initialHtml: string = DEFAULT_INITIAL_HTML): Promise<void> {
    if (editor) return;
    loading.value = true;
    error.value = null;
    try {
      const bundle = await ensureTiptapModule();
      editorContentComponent.value = bundle.EditorContent;
      const Editor = bundle.Editor;
      const StarterKit = bundle.StarterKit;
      editor = new Editor({
        extensions: [
          StarterKit.configure({
            // Sensible defaults: keep link, underline, code block all enabled.
            link: { openOnClick: false, HTMLAttributes: { rel: 'noopener noreferrer' } },
            heading: { levels: [1, 2, 3] },
          }),
        ],
        content: initialHtml,
        onUpdate: () => syncOutput(),
        onSelectionUpdate: () => syncActiveState(),
        onTransaction: () => syncActiveState(),
        onCreate: () => {
          editorReady.value = true;
          syncOutput();
        },
      });
    } catch (e) {
      error.value = toError(e);
    } finally {
      loading.value = false;
    }
  }

  function destroyEditor(): void {
    if (!editor) return;
    try {
      editor.destroy();
    } catch {
      /* ignore - best effort cleanup */
    }
    editor = null;
    editorReady.value = false;
    editorContentComponent.value = null;
  }

  /* ----------------------------- toolbar actions -------------------------- */

  function withEditor(fn: (ed: Editor) => void): void {
    if (!editor) return;
    try {
      // Each action calls `ed.chain().focus().<cmd>.run()` itself, so we only
      // invoke the callback and then sync the resulting output/state.
      fn(editor);
      syncOutput();
    } catch (e) {
      error.value = toError(e);
    }
  }

  function toggleBold(): void {
    withEditor((ed) => ed.chain().focus().toggleBold().run());
  }
  function toggleItalic(): void {
    withEditor((ed) => ed.chain().focus().toggleItalic().run());
  }
  function toggleUnderline(): void {
    withEditor((ed) => ed.chain().focus().toggleUnderline().run());
  }
  function toggleStrike(): void {
    withEditor((ed) => ed.chain().focus().toggleStrike().run());
  }
  function toggleCode(): void {
    withEditor((ed) => ed.chain().focus().toggleCode().run());
  }
  function toggleBulletList(): void {
    withEditor((ed) => ed.chain().focus().toggleBulletList().run());
  }
  function toggleOrderedList(): void {
    withEditor((ed) => ed.chain().focus().toggleOrderedList().run());
  }
  function toggleCodeBlock(): void {
    withEditor((ed) => ed.chain().focus().toggleCodeBlock().run());
  }
  function toggleBlockquote(): void {
    withEditor((ed) => ed.chain().focus().toggleBlockquote().run());
  }
  function setHeading(level: HeadingLevel | false): void {
    withEditor((ed) => {
      if (level === false) {
        ed.chain().focus().setParagraph().run();
      } else {
        ed.chain().focus().toggleHeading({ level }).run();
      }
    });
  }
  function setLink(url: string): void {
    withEditor((ed) => {
      const trimmed = url.trim();
      if (!trimmed) {
        ed.chain().focus().extendMarkRange('link').unsetLink().run();
        return;
      }
      ed.chain()
        .focus()
        .extendMarkRange('link')
        .setLink({ href: trimmed })
        .run();
    });
  }
  function unsetLink(): void {
    withEditor((ed) => ed.chain().focus().unsetLink().run());
  }
  function insertLink(): void {
    if (!editor) return;
    const current = editor.getAttributes('link').href as string | undefined;
    const url = promptLinkUrl(typeof current === 'string' ? current : '');
    if (url === '' && !current) return; // user cancelled with empty input
    setLink(url);
  }
  function clearFormatting(): void {
    withEditor((ed) => {
      ed.chain()
        .focus()
        .unsetAllMarks()
        .clearNodes()
        .setParagraph()
        .run();
    });
  }
  function setContent(newHtml: string): void {
    withEditor((ed) => ed.commands.setContent(newHtml, { emitUpdate: false }));
  }
  function recomputeMarkdown(): void {
    if (!editor) return;
    const raw = editor.getHTML();
    html.value = raw;
    markdown.value = htmlToMarkdown(raw);
  }

  /* ------------------------------- embed wiring --------------------------- */

  const { isEmbed, input: embedInput, sendOutput } = useEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.html === 'string') {
        setContent(p.html);
      } else if (typeof p.content === 'string') {
        setContent(p.content);
      }
    },
  });

  // Forward output to the parent whenever html/markdown change in embed mode.
  const outputPayload = computed(() => ({
    html: html.value,
    markdown: markdown.value,
  }));
  watch(outputPayload, (p) => {
    if (isEmbed.value) sendOutput(p);
  });

  /* ------------------------------- lifecycle ------------------------------ */

  onMounted(() => {
    void initEditor();
  });
  onBeforeUnmount(() => {
    destroyEditor();
  });

  return {
    html,
    markdown,
    loading,
    error,
    editorReady,
    editorContentComponent,
    isActive,
    canToggleMark,
    isEmbed,
    embedInput,
    initEditor,
    destroyEditor,
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
    setLink,
    unsetLink,
    insertLink,
    clearFormatting,
    setContent,
    recomputeMarkdown,
  };
}

/**
 * Determine the active heading level (1/2/3) of the current selection, or
 * `false` when no heading is active. Tiptap reports heading activity per
 * level, so we probe each configured level.
 */
function resolveActiveHeading(
  ed: Editor,
): false | HeadingLevel {
  for (const lvl of [1, 2, 3] as HeadingLevel[]) {
    if (ed.isActive('heading', { level: lvl })) return lvl;
  }
  return false;
}
