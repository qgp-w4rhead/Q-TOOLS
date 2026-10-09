import { createRouter, createWebHistory } from 'vue-router';
import type { RouteRecordRaw } from 'vue-router';
import { getToolBySlug } from '@/data/tools';

/**
 * Vue Router setup for Q-Tools.
 *
 * Routes:
 *   /                         - home (category grid + search)
 *   /tools/:slug              - full app shell + tool
 *   /embed/tools/:slug        - chromeless tool (iframe embed)
 *   ?embed=1 on /tools/:slug  - alias handled in ToolLayout via useEmbed
 *
 * Tool components are lazy-loaded via dynamic import so Vite produces a
 * separate chunk per tool. Until a tool is implemented (M1+), the route
 * resolves to a placeholder component so navigation never 404s.
 */

const HomePage = () => import('@/views/HomePage.vue');
const ToolLayout = () => import('@/views/ToolLayout.vue');
const EmbedView = () => import('@/views/EmbedView.vue');
const ToolView = () => import('@/views/ToolView.vue');

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'home',
    component: HomePage,
  },
  {
    path: '/tools/:slug',
    name: 'tool',
    component: ToolLayout,
    props: true,
    children: [
      {
        path: '',
        name: 'tool-view',
        component: ToolView,
        props: true,
      },
    ],
  },
  {
    path: '/embed/tools/:slug',
    name: 'embed-tool',
    component: EmbedView,
    props: true,
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    redirect: '/',
  },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(to, _from, saved) {
    if (saved) return saved;
    if (to.hash) {
      return { el: to.hash, top: 80 };
    }
    return { top: 0 };
  },
});

/** Guard: redirect unknown tool slugs back to home. */
router.beforeEach((to) => {
  const slug = (to.params.slug as string | undefined) ?? '';
  if ((to.name === 'tool' || to.name === 'embed-tool' || to.name === 'tool-view') && slug) {
    if (!getToolBySlug(slug)) {
      return { name: 'home' };
    }
  }
  return true;
});

export default router;
