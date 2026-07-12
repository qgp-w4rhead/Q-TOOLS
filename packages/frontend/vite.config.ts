import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';

/**
 * Vite configuration for the Q-Tools frontend.
 *
 * - Vue 3 SFC compilation via @vitejs/plugin-vue
 * - Ionic Vue router integration (handled in app code; no Vite plugin needed)
 * - PWA via vite-plugin-pwa (minimal config here; full offline strategy is M11.3)
 * - Dev proxy: `/api/*` → Fastify backend on :3001
 * - Path alias `@` → src for ergonomic imports
 */
export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['manifest.json', 'favicon.svg'],
      manifest: {
        name: 'Q-Tools',
        short_name: 'Q-Tools',
        description:
          'Comprehensive developer & utility tools — offline-first PWA, iframe-embeddable.',
        theme_color: '#0d1117',
        background_color: '#0d1117',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: 'favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,wasm}'],
        // Tool chunks are code-split (dynamic import) and cached on demand.
        // Full CacheFirst strategy for tool chunks is configured in M11.3.
        navigateFallback: '/index.html',
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    strictPort: false,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  build: {
    target: 'es2022',
    sourcemap: true,
    rollupOptions: {
      output: {
        // Split heavy vendor chunks so tool dynamic imports stay small.
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('@ionic')) return 'ionic';
            if (
              id.includes('/vue/') ||
              id.includes('/vue-router/') ||
              id.includes('/pinia/') ||
              id.includes('/@vue/')
            ) {
              return 'vue';
            }
          }
          return undefined;
        },
      },
    },
  },
});
