/**
 * useTabOrderVisualizer - composable + pure logic for the tab order visualizer.
 *
 * Parses HTML to extract focusable elements and their tab order, analyzing
 * tabindex values and identifying potential keyboard navigation issues.
 *
 * Pure helpers (`parseTabOrder`, `analyzeTabOrder`) have no Vue dependency.
 * The `useTabOrderVisualizer()` composable wraps them in reactive state and
 * wires up the embed PostMessage protocol.
 *
 * No external dependencies.
 */
import { ref, watch, type Ref } from 'vue';
import { useToolEmbed } from '@/composables/useToolEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Types - pure logic (no Vue dependency)                                     */
/* -------------------------------------------------------------------------- */

export interface TabElement {
  tag: string;
  tabindex: number | null;
  hasHref: boolean;
  isFocusable: boolean;
  isDisabled: boolean;
  hasNegativeTabindex: boolean;
  hasPositiveTabindex: boolean;
  label: string;
  index: number;
}

export interface TabOrderResult {
  elements: TabElement[];
  totalFocusable: number;
  hasPositiveTabindex: boolean;
  hasNegativeTabindex: boolean;
  warnings: string[];
}

export interface UseTabOrderVisualizerReturn {
  htmlInput: Ref<string>;
  result: Ref<TabOrderResult | null>;
  error: Ref<string | null>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
}

/* -------------------------------------------------------------------------- */
/* Pure logic - no Vue dependency below this point                            */
/* -------------------------------------------------------------------------- */

const NATURALLY_FOCUSABLE = new Set([
  'a', 'button', 'input', 'select', 'textarea', 'summary',
]);

/** Parse HTML to extract tab-ordered focusable elements. */
export function parseTabOrder(html: string): TabOrderResult {
  const warnings: string[] = [];
  if (!html.trim()) {
    return { elements: [], totalFocusable: 0, hasPositiveTabindex: false, hasNegativeTabindex: false, warnings };
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const allElements = doc.querySelectorAll('*');

  const elements: TabElement[] = [];
  let focusableCount = 0;
  let hasPositive = false;
  let hasNegative = false;

  allElements.forEach((el, i) => {
    const tag = el.tagName.toLowerCase();
    const tabindexAttr = el.getAttribute('tabindex');
    let tabindex: number | null = null;
    if (tabindexAttr !== null) {
      const parsed = parseInt(tabindexAttr, 10);
      if (!isNaN(parsed)) tabindex = parsed;
    }

    const hasHref = tag === 'a' && el.hasAttribute('href');
    const isDisabled = el.hasAttribute('disabled');
    const hasNegativeTabindex = tabindex !== null && tabindex < 0;
    const hasPositiveTabindex = tabindex !== null && tabindex > 0;

    // Determine if focusable
    let isFocusable = false;
    if (hasNegativeTabindex) {
      isFocusable = false; // removed from tab order
    } else if (isDisabled) {
      isFocusable = false;
    } else if (NATURALLY_FOCUSABLE.has(tag) || hasHref) {
      isFocusable = true;
    } else if (tabindex !== null && tabindex >= 0) {
      isFocusable = true;
    }

    if (hasPositiveTabindex) hasPositive = true;
    if (hasNegativeTabindex) hasNegative = true;

    if (isFocusable || hasNegativeTabindex || tabindex !== null) {
      let label = el.textContent?.trim().slice(0, 60) || '';
      if (!label) {
        label = el.getAttribute('aria-label') ||
          el.getAttribute('title') ||
          el.getAttribute('placeholder') ||
          el.getAttribute('alt') ||
          `<${tag}>`;
      }

      elements.push({
        tag,
        tabindex,
        hasHref,
        isFocusable,
        isDisabled,
        hasNegativeTabindex,
        hasPositiveTabindex,
        label,
        index: i,
      });

      if (isFocusable) focusableCount++;
    }
  });

  // Sort by tab order: positive tabindex first (1, 2, 3...), then natural order (tabindex=0 or null)
  const positiveTab = elements.filter(e => e.hasPositiveTabindex).sort((a, b) => (a.tabindex ?? 0) - (b.tabindex ?? 0));
  const naturalTab = elements.filter(e => !e.hasPositiveTabindex && e.isFocusable);
  const orderedElements = [...positiveTab, ...naturalTab];

  // Warnings
  if (hasPositive) {
    warnings.push('Positive tabindex values found. These elements are focused first, which can confuse keyboard users.');
  }
  if (hasNegative) {
    warnings.push('Negative tabindex values found. These elements are removed from tab navigation.');
  }

  const focusableWithPositive = elements.filter(e => e.hasPositiveTabindex && e.isFocusable);
  if (focusableWithPositive.length > 4) {
    warnings.push(`${focusableWithPositive.length} elements with positive tabindex. Consider restructuring the DOM order instead.`);
  }

  return {
    elements: orderedElements,
    totalFocusable: focusableCount,
    hasPositiveTabindex: hasPositive,
    hasNegativeTabindex: hasNegative,
    warnings,
  };
}

/* -------------------------------------------------------------------------- */
/* Composable - reactive state + embed integration                            */
/* -------------------------------------------------------------------------- */

export function useTabOrderVisualizer(): UseTabOrderVisualizerReturn {
  const htmlInput = ref<string>('');
  const result = ref<TabOrderResult | null>(null);
  const error = ref<string | null>(null);

  function recompute(): void {
    try {
      error.value = null;
      result.value = parseTabOrder(htmlInput.value);
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to parse HTML';
      result.value = null;
    }
  }

  watch(htmlInput, () => recompute());
  recompute();

  const { isEmbed, input: embedInput } = useToolEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.html === 'string') htmlInput.value = p.html;
      if (typeof p.input === 'string') htmlInput.value = p.input;
      if (typeof p.content === 'string') htmlInput.value = p.content;
    },
    output: result,
    toOutput: () => ({
      elements: result.value?.elements ?? [],
      totalFocusable: result.value?.totalFocusable ?? 0,
      warnings: result.value?.warnings ?? [],
    }),
  });

  return {
    htmlInput,
    result,
    error,
    isEmbed,
    embedInput,
  };
}
