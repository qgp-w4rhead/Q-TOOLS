/**
 * useHeadingStructureAnalyzer - composable + pure logic for the heading
 * structure analyzer.
 *
 * Parses HTML to extract heading elements (h1-h6) and build a hierarchy
 * tree, detecting skipped heading levels.
 *
 * Pure helpers (`parseHeadings`, `buildHeadingTree`, `analyzeHeadings`)
 * have no Vue dependency. The `useHeadingStructureAnalyzer()` composable
 * wraps them in reactive state and wires up the embed PostMessage protocol.
 *
 * No external dependencies.
 */
import { ref, watch, type Ref } from 'vue';
import { useToolEmbed } from '@/composables/useToolEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Types - pure logic (no Vue dependency)                                     */
/* -------------------------------------------------------------------------- */

export interface HeadingNode {
  level: number;
  text: string;
  index: number;
  children: HeadingNode[];
  warning: string | null;
}

export interface HeadingAnalysis {
  tree: HeadingNode[];
  flatList: { level: number; text: string; index: number; warning: string | null }[];
  totalHeadings: number;
  hasH1: boolean;
  multipleH1: boolean;
  skippedLevels: number;
  warnings: string[];
}

export interface UseHeadingStructureAnalyzerReturn {
  htmlInput: Ref<string>;
  result: Ref<HeadingAnalysis | null>;
  error: Ref<string | null>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
}

/* -------------------------------------------------------------------------- */
/* Pure logic - no Vue dependency below this point                             */
/* -------------------------------------------------------------------------- */

/** Parse HTML to extract heading elements. */
export function parseHeadings(html: string): { level: number; text: string; index: number }[] {
  if (!html.trim()) return [];
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const headings = doc.querySelectorAll('h1, h2, h3, h4, h5, h6');
  const result: { level: number; text: string; index: number }[] = [];
  headings.forEach((h, i) => {
    const tag = h.tagName;
    const level = tag.length >= 2 ? parseInt(tag.charAt(1), 10) : 1;
    const text = h.textContent?.trim().slice(0, 100) || '';
    result.push({ level, text, index: i });
  });
  return result;
}

/** Build a heading tree from a flat list, detecting skipped levels. */
export function buildHeadingTree(
  flat: { level: number; text: string; index: number }[],
): { tree: HeadingNode[]; flatList: { level: number; text: string; index: number; warning: string | null }[]; warnings: string[]; skippedLevels: number } {
  const tree: HeadingNode[] = [];
  const flatList: { level: number; text: string; index: number; warning: string | null }[] = [];
  const warnings: string[] = [];
  let skippedLevels = 0;

  // Stack to track the current path in the tree
  const stack: HeadingNode[] = [];

  for (const h of flat) {
    let warning: string | null = null;

    // Check for skipped levels
    if (stack.length === 0) {
      if (h.level > 1) {
        warning = `First heading is h${h.level}, should start with h1`;
        warnings.push(warning);
        skippedLevels++;
      }
    } else {
      const top = stack[stack.length - 1];
      if (!top) continue;
      const parentLevel = top.level;
      if (h.level > parentLevel + 1) {
        warning = `Skipped from h${parentLevel} to h${h.level}`;
        warnings.push(warning);
        skippedLevels++;
      }
    }

    const node: HeadingNode = {
      level: h.level,
      text: h.text,
      index: h.index,
      children: [],
      warning,
    };

    flatList.push({ level: h.level, text: h.text, index: h.index, warning });

    // Pop stack until we find the parent
    while (stack.length > 0) {
      const top = stack[stack.length - 1];
      if (!top || top.level < h.level) break;
      stack.pop();
    }

    if (stack.length === 0) {
      tree.push(node);
    } else {
      const parent = stack[stack.length - 1];
      if (parent) parent.children.push(node);
    }

    stack.push(node);
  }

  return { tree, flatList, warnings, skippedLevels };
}

/** Full analysis: parse, build tree, and collect warnings. */
export function analyzeHeadings(html: string): HeadingAnalysis {
  const flat = parseHeadings(html);
  const { tree, flatList, warnings, skippedLevels } = buildHeadingTree(flat);

  const hasH1 = flat.some(h => h.level === 1);
  const h1Count = flat.filter(h => h.level === 1).length;
  const multipleH1 = h1Count > 1;

  if (multipleH1) {
    warnings.push(`Multiple h1 headings found (${h1Count}). Consider using a single h1 per page.`);
  }

  if (flat.length === 0) {
    warnings.push('No headings found in the provided HTML.');
  }

  return {
    tree,
    flatList,
    totalHeadings: flat.length,
    hasH1,
    multipleH1,
    skippedLevels,
    warnings,
  };
}

/* -------------------------------------------------------------------------- */
/* Composable - reactive state + embed integration                            */
/* -------------------------------------------------------------------------- */

export function useHeadingStructureAnalyzer(): UseHeadingStructureAnalyzerReturn {
  const htmlInput = ref<string>('');
  const result = ref<HeadingAnalysis | null>(null);
  const error = ref<string | null>(null);

  function recompute(): void {
    try {
      error.value = null;
      result.value = analyzeHeadings(htmlInput.value);
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
      totalHeadings: result.value?.totalHeadings ?? 0,
      hasH1: result.value?.hasH1 ?? false,
      multipleH1: result.value?.multipleH1 ?? false,
      skippedLevels: result.value?.skippedLevels ?? 0,
      warnings: result.value?.warnings ?? [],
      headings: result.value?.flatList ?? [],
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
