<script setup lang="ts">
/**
 * ToolView — dynamic tool loader for the `/tools/:slug` child route.
 *
 * Mirrors `EmbedView.vue` but renders inside the full app shell (ToolLayout).
 * Tool modules are lazy-loaded by slug so each tool lands in its own Vite
 * chunk. Until a tool is implemented, the placeholder is shown so the route
 * never 404s.
 */
import { computed, defineAsyncComponent } from 'vue';
import { useRoute } from 'vue-router';
import { getToolBySlug } from '@/data/tools';
import ToolPlaceholder from './ToolPlaceholder.vue';

const props = defineProps<{ slug?: string }>();
const route = useRoute();

const resolvedSlug = computed(
  () => props.slug ?? (route.params.slug as string | undefined) ?? '',
);
const tool = computed(() => getToolBySlug(resolvedSlug.value));

const ToolComponent = defineAsyncComponent({
  loader: async () => {
    try {
      const mod = await loadToolModule(resolvedSlug.value);
      return mod.default ?? mod;
    } catch {
      return ToolPlaceholder;
    }
  },
  errorComponent: ToolPlaceholder,
  delay: 0,
});

async function loadToolModule(slug: string): Promise<{ default: unknown }> {
  // Vite needs literal specifiers to analyse dynamic imports. We enumerate
  // every tool module explicitly so code-splitting works per tool. Tools not
  // yet implemented are absent from this map → the catch above renders the
  // placeholder. Implemented tools are added here as they land.
  const modules: Record<string, () => Promise<{ default: unknown }>> = {
    'token-generator': () => import('@/tools/TokenGenerator/index'),
    'hash-text': () => import('@/tools/HashText/index'),
    'bcrypt': () => import('@/tools/Bcrypt/index'),
    'uuid-generator': () => import('@/tools/UuidGenerator/index'),
    'ulid-generator': () => import('@/tools/UlidGenerator/index'),
    // ...added in M1+ milestones
  };
  const loader = modules[slug];
  if (!loader) throw new Error(`tool not implemented: ${slug}`);
  return loader();
}
</script>

<template>
  <component :is="ToolComponent" v-if="tool" :slug="resolvedSlug" />
  <ToolPlaceholder v-else :slug="resolvedSlug" />
</template>
