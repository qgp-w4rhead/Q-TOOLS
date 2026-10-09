/**
 * useXssPayloadSanitizer - composable + pure logic for testing HTML input
 * against XSS vectors with allowlist-based filtering.
 *
 * Uses DOMParser for parsing and an allowlist approach: only known-safe
 * tags and attributes are kept; everything else is stripped.
 *
 * No external dependencies.
 */
import { ref, watch, type Ref } from 'vue';
import { useToolEmbed } from '@/composables/useToolEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Types - pure logic (no Vue dependency)                                      */
/* -------------------------------------------------------------------------- */

export interface XssSanitizerOptions {
  allowedTags: string[];
  allowedAttributes: string[];
  stripComments: boolean;
  stripStyleAttributes: boolean;
  stripEventHandlers: boolean;
  stripScriptTags: boolean;
}

export interface XssFinding {
  severity: 'danger' | 'warning' | 'info';
  message: string;
  context: string;
}

export interface XssSanitizerResult {
  sanitized: string;
  findings: XssFinding[];
  removedCount: number;
  isSafe: boolean;
}

export interface UseXssPayloadSanitizerReturn {
  inputHtml: Ref<string>;
  options: Ref<XssSanitizerOptions>;
  result: Ref<XssSanitizerResult>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  reset: () => void;
}

/* -------------------------------------------------------------------------- */
/* Constants                                                                   */
/* -------------------------------------------------------------------------- */

export const DEFAULT_ALLOWED_TAGS = [
  'a', 'b', 'br', 'div', 'em', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'hr', 'i', 'img', 'li', 'ol', 'p', 'pre', 's', 'span', 'strong',
  'table', 'tbody', 'td', 'th', 'thead', 'tr', 'u', 'ul', 'code', 'blockquote',
];

export const DEFAULT_ALLOWED_ATTRIBUTES = [
  'href', 'title', 'alt', 'src', 'width', 'height', 'class', 'id',
  'colspan', 'rowspan', 'target', 'rel',
];

export const DEFAULT_OPTIONS: XssSanitizerOptions = {
  allowedTags: [...DEFAULT_ALLOWED_TAGS],
  allowedAttributes: [...DEFAULT_ALLOWED_ATTRIBUTES],
  stripComments: true,
  stripStyleAttributes: true,
  stripEventHandlers: true,
  stripScriptTags: true,
};

const DANGEROUS_TAGS = ['script', 'iframe', 'object', 'embed', 'applet', 'meta', 'link', 'base', 'form', 'input', 'svg'];
const EVENT_HANDLER_RE = /^on/i;
const XSS_VECTORS = [
  /javascript:/i,
  /vbscript:/i,
  /data:text\/html/i,
  /<script/i,
  /on\w+\s*=/i,
  /expression\s*\(/i,
  /url\s*\(/i,
];

/* -------------------------------------------------------------------------- */
/* Pure logic - no Vue dependency below this point                             */
/* -------------------------------------------------------------------------- */

/**
 * Sanitize HTML using DOMParser and an allowlist approach.
 * Detects XSS vectors and reports findings.
 */
export function sanitizeHtml(html: string, options: XssSanitizerOptions): XssSanitizerResult {
  const findings: XssFinding[] = [];
  let removedCount = 0;

  if (!html.trim()) {
    return { sanitized: '', findings, removedCount: 0, isSafe: true };
  }

  // Detect XSS vectors in the raw input first
  for (const vector of XSS_VECTORS) {
    const matches = html.match(new RegExp(vector.source, vector.flags + 'g'));
    if (matches) {
      for (const match of matches) {
        findings.push({
          severity: 'danger',
          message: `XSS vector detected: ${match.slice(0, 80)}`,
          context: match,
        });
      }
    }
  }

  // Use DOMParser for safe parsing
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // Walk all nodes and sanitize
  function walk(node: Node): void {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as Element;
      const tag = el.tagName.toLowerCase();

      // Check for dangerous tags
      if (options.stripScriptTags && DANGEROUS_TAGS.includes(tag)) {
        findings.push({
          severity: 'danger',
          message: `Removed dangerous tag: <${tag}>`,
          context: `<${tag}>`,
        });
        removedCount++;
        el.remove();
        return;
      }

      // Check if tag is in allowlist
      if (!options.allowedTags.includes(tag)) {
        findings.push({
          severity: 'warning',
          message: `Removed non-allowlisted tag: <${tag}>`,
          context: `<${tag}>`,
        });
        removedCount++;
        // Keep children but unwrap the element
        while (el.firstChild) {
          el.parentNode?.insertBefore(el.firstChild, el);
        }
        el.remove();
        return;
      }

      // Sanitize attributes
      const attrs = Array.from(el.attributes);
      for (const attr of attrs) {
        const attrName = attr.name.toLowerCase();
        const attrValue = attr.value;

        // Remove event handlers
        if (options.stripEventHandlers && EVENT_HANDLER_RE.test(attrName)) {
          findings.push({
            severity: 'danger',
            message: `Removed event handler: ${attrName} on <${tag}>`,
            context: `${attrName}="${attrValue.slice(0, 60)}"`,
          });
          el.removeAttribute(attr.name);
          removedCount++;
          continue;
        }

        // Remove style attributes
        if (options.stripStyleAttributes && (attrName === 'style' || attrName === 'class' && false)) {
          if (attrName === 'style') {
            findings.push({
              severity: 'warning',
              message: `Removed style attribute on <${tag}>`,
              context: `style="${attrValue.slice(0, 60)}"`,
            });
            el.removeAttribute(attr.name);
            removedCount++;
            continue;
          }
        }

        // Check for dangerous URIs in href/src
        if ((attrName === 'href' || attrName === 'src') && XSS_VECTORS.some((v) => v.test(attrValue))) {
          findings.push({
            severity: 'danger',
            message: `Removed dangerous URI in ${attrName} on <${tag}>`,
            context: `${attrName}="${attrValue.slice(0, 60)}"`,
          });
          el.removeAttribute(attr.name);
          removedCount++;
          continue;
        }

        // Check if attribute is in allowlist
        if (!options.allowedAttributes.includes(attrName)) {
          findings.push({
            severity: 'warning',
            message: `Removed non-allowlisted attribute: ${attrName} on <${tag}>`,
            context: `${attrName}="${attrValue.slice(0, 60)}"`,
          });
          el.removeAttribute(attr.name);
          removedCount++;
        }
      }
    }

    if (node.nodeType === Node.COMMENT_NODE) {
      if (options.stripComments) {
        findings.push({
          severity: 'info',
          message: 'Removed HTML comment',
          context: '<!-- ... -->',
        });
        removedCount++;
        node.parentNode?.removeChild(node);
        return;
      }
    }

    // Walk children (copy array since we modify during iteration)
    const children = Array.from(node.childNodes);
    for (const child of children) {
      walk(child);
    }
  }

  walk(doc.body);

  const sanitized = doc.body.innerHTML;
  const isSafe = findings.filter((f) => f.severity === 'danger').length === 0;

  return { sanitized, findings, removedCount, isSafe };
}

/* -------------------------------------------------------------------------- */
/* Composable - reactive state + embed integration                             */
/* -------------------------------------------------------------------------- */

export function useXssPayloadSanitizer(): UseXssPayloadSanitizerReturn {
  const inputHtml = ref<string>('');
  const options = ref<XssSanitizerOptions>({ ...DEFAULT_OPTIONS });
  const result = ref<XssSanitizerResult>({
    sanitized: '',
    findings: [],
    removedCount: 0,
    isSafe: true,
  });

  function recompute(): void {
    result.value = sanitizeHtml(inputHtml.value, options.value);
  }

  function reset(): void {
    inputHtml.value = '';
    options.value = { ...DEFAULT_OPTIONS };
    recompute();
  }

  watch([inputHtml, options], recompute, { deep: true });

  recompute();

  const { isEmbed, input: embedInput } = useToolEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.html === 'string') inputHtml.value = p.html;
      if (typeof p.input === 'string') inputHtml.value = p.input;
      if (typeof p.value === 'string') inputHtml.value = p.value;
    },
    output: result,
    toOutput: () => ({
      sanitized: result.value.sanitized,
      findings: result.value.findings,
      removedCount: result.value.removedCount,
      isSafe: result.value.isSafe,
    }),
  });

  return {
    inputHtml,
    options,
    result,
    isEmbed,
    embedInput,
    reset,
  };
}
