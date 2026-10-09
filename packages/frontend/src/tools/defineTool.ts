/**
 * defineTool - helper for tool `index.ts` modules.
 *
 * Every tool module exports the same three things: a `metadata` object, a
 * lazy-loaded default component, and re-exports of the composable. This
 * helper collapses the boilerplate:
 *
 *   const { metadata, component } = defineTool(
 *     {
 *       slug: 'my-tool',
 *       name: 'My tool',
 *       description: '…',
 *       category: 'math',
 *       icon: 'hash',
 *       keywords: ['…'],
 *       dependencies: [],
 *     },
 *     () => import('./MyTool.vue'),
 *   );
 *
 *   export { metadata };
 *   export default component;
 *
 * `ToolView` / `EmbedView` consume the default export; `metadata` feeds the
 * registry.
 */
import { defineAsyncComponent, type Component } from 'vue';
import type { ToolMetadata } from '@q-tools/shared';

export interface ToolModule {
  metadata: ToolMetadata;
  component: Component;
}

export function defineTool(
  metadata: ToolMetadata,
  loader: () => Promise<{ default: Component }>,
): ToolModule {
  return {
    metadata,
    component: defineAsyncComponent(loader),
  };
}
