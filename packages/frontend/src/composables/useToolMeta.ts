/**
 * useToolMeta — read the active tool's metadata from the current route.
 *
 * Returns reactive computed refs for the slug (from `route.params.slug`) and
 * the resolved `ToolMetadata` (looked up in the registry). Useful inside tool
 * components and the tool layout to access metadata without repeating the
 * `getToolBySlug` lookup.
 */
import { computed, type ComputedRef } from 'vue';
import { useRoute } from 'vue-router';
import { getToolBySlug } from '@/data/tools';
import type { ToolMetadata, ToolCategory } from '@q-tools/shared';

export interface UseToolMetaReturn {
  /** The slug from the current route params (or empty string). */
  slug: ComputedRef<string>;
  /** The resolved tool metadata, or `undefined` if the slug is unknown. */
  tool: ComputedRef<ToolMetadata | undefined>;
  /** The tool's category id, or `undefined`. */
  category: ComputedRef<ToolCategory | undefined>;
}

export function useToolMeta(): UseToolMetaReturn {
  const route = useRoute();

  const slug = computed(() => (route.params.slug as string | undefined) ?? '');
  const tool = computed(() => getToolBySlug(slug.value));
  const category = computed(() => tool.value?.category);

  return { slug, tool, category };
}
