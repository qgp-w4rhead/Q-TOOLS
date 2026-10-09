/**
 * useWebhookPayloadInspector — composable + pure logic for inspecting JSON
 * webhook payloads with JSONPath/jq-style filtering.
 *
 * No external dependencies.
 */
import { ref, computed, type ComputedRef, type Ref } from 'vue';
import { useToolEmbed } from '@/composables/useToolEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Types                                                                       */
/* -------------------------------------------------------------------------- */

export interface TreeNode {
  key: string;
  value: unknown;
  type: string;
  path: string;
  children: TreeNode[];
  expanded: boolean;
}

export interface InspectionResult {
  valid: boolean;
  error: string;
  tree: TreeNode[];
  flattened: { path: string; value: string; type: string }[];
  filtered: { path: string; value: string; type: string }[];
  keyCount: number;
  sizeBytes: number;
}

/* -------------------------------------------------------------------------- */
/* Pure logic                                                                  */
/* -------------------------------------------------------------------------- */

function getType(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

function buildTree(data: unknown, key = '$', path = '$'): TreeNode {
  const type = getType(data);
  const children: TreeNode[] = [];

  if (type === 'object' && data !== null) {
    const obj = data as Record<string, unknown>;
    for (const k of Object.keys(obj)) {
      children.push(buildTree(obj[k], k, `${path}.${k}`));
    }
  } else if (type === 'array') {
    const arr = data as unknown[];
    for (let i = 0; i < arr.length; i++) {
      children.push(buildTree(arr[i], String(i), `${path}[${i}]`));
    }
  }

  return {
    key,
    value: type === 'object' || type === 'array' ? null : data,
    type,
    path,
    children,
    expanded: false,
  };
}

function flattenTree(node: TreeNode, acc: { path: string; value: string; type: string }[]): void {
  if (node.type !== 'object' && node.type !== 'array') {
    acc.push({
      path: node.path,
      value: String(node.value),
      type: node.type,
    });
  }
  for (const child of node.children) {
    flattenTree(child, acc);
  }
}

function matchPath(path: string, filter: string): boolean {
  if (!filter.trim()) return true;
  // Simple jq-style: .key.subkey or $.key.subkey or just "keyword"
  const f = filter.trim().toLowerCase();

  // If it looks like a path expression
  if (f.startsWith('.') || f.startsWith('$')) {
    const normalized = f.replace(/^\$?\./, '').toLowerCase();
    const pathLower = path.toLowerCase().replace(/^\$?\./, '');
    return pathLower.includes(normalized);
  }

  // Otherwise, match as substring in path or value
  return path.toLowerCase().includes(f);
}

export function inspectPayload(input: string, filter: string): InspectionResult {
  if (!input.trim()) {
    return { valid: false, error: 'Empty input.', tree: [], flattened: [], filtered: [], keyCount: 0, sizeBytes: 0 };
  }

  let data: unknown;
  try {
    data = JSON.parse(input);
  } catch (e) {
    return { valid: false, error: e instanceof Error ? e.message : String(e), tree: [], flattened: [], filtered: [], keyCount: 0, sizeBytes: 0 };
  }

  const tree = [buildTree(data)];
  const flattened: { path: string; value: string; type: string }[] = [];
  for (const node of tree) {
    flattenTree(node, flattened);
  }

  const filtered = flattened.filter((item) => matchPath(item.path, filter));

  return {
    valid: true,
    error: '',
    tree,
    flattened,
    filtered,
    keyCount: flattened.length,
    sizeBytes: new Blob([input]).size,
  };
}

/* -------------------------------------------------------------------------- */
/* Composable                                                                  */
/* -------------------------------------------------------------------------- */

export interface UseWebhookPayloadInspectorReturn {
  input: Ref<string>;
  filter: Ref<string>;
  result: ComputedRef<InspectionResult>;
  reset: () => void;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
}

export function useWebhookPayloadInspector(): UseWebhookPayloadInspectorReturn {
  const input = ref('');
  const filter = ref('');

  const result = computed(() => inspectPayload(input.value, filter.value));

  function reset(): void {
    input.value = '';
    filter.value = '';
  }

  const { isEmbed, input: embedInput } = useToolEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.input === 'string') input.value = p.input;
    },
    output: result,
    toOutput: () => ({ valid: result.value.valid, keyCount: result.value.keyCount }),
  });

  return { input, filter, result, reset, isEmbed, embedInput };
}
