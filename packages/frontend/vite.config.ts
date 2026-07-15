import { defineConfig, type Plugin } from 'vite';
import vue from '@vitejs/plugin-vue';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';

/**
 * Vite configuration for the Q-Tools frontend.
 *
 * - Vue 3 SFC compilation via @vitejs/plugin-vue
 * - Ionic Vue router integration (handled in app code; no Vite plugin needed)
 * - PWA via vite-plugin-pwa (full offline strategy — see M11.3):
 *     • App shell precached on install (index.html, manifest, icons, embed.js,
 *       registerSW.js). All Vite-emitted JS/CSS/WASM chunks are cached on
 *       first visit via CacheFirst runtime routes (NOT precached) so the SW
 *       stays small and tool chunks load on demand.
 *     • WASM assets cached with the correct `application/wasm` MIME type.
 *     • Backend API calls use NetworkFirst with a 3s timeout so the app
 *       degrades gracefully to LocalStorage when offline.
 * - Dev proxy: `/api/*` → Fastify backend on :3001
 * - Embed headers: dev middleware sets `X-Frame-Options: ALLOWALL` +
 *   `Content-Security-Policy: frame-ancestors *` on `/embed/` paths so
 *   iframe embedding works in dev (mirrors the backend `embedRoutes` in
 *   production).
 * - Path alias `@` → src for ergonomic imports
 */

/**
 * Vite dev plugin that sets permissive framing headers on `/embed/` paths so
 * the chromeless embed routes can be iframed during development. In
 * production the backend `embedRoutes` applies the same headers.
 */
function embedHeadersPlugin(): Plugin {
  return {
    name: 'q-tools-embed-headers',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url ?? '';
        if (url.startsWith('/embed/') || url === '/embed') {
          res.setHeader('X-Frame-Options', 'ALLOWALL');
          res.setHeader('Content-Security-Policy', 'frame-ancestors *');
        }
        next();
      });
    },
  };
}
export default defineConfig({
  plugins: [
    vue(),
    embedHeadersPlugin(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'favicon.svg',
        'manifest.json',
        'embed.js',
        'icon-192.png',
        'icon-512.png',
        'icon-192-maskable.png',
        'icon-512-maskable.png',
      ],
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
          {
            src: 'icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'icon-192-maskable.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: 'icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
        shortcuts: [
          {
            name: 'Home',
            short_name: 'Home',
            url: '/',
          },
        ],
      },
      workbox: {
        // Precache ONLY the static app shell (HTML + public/ assets +
        // registerSW.js). All Vite-emitted chunks under /assets/ (vendor +
        // tool chunks alike) are cached on first visit via the CacheFirst
        // runtime route below. This keeps the install footprint small and
        // matches the offline strategy:
        //   • App shell (index.html, manifest, icons, embed.js, registerSW.js)
        //     → precached on install.
        //   • JS/CSS/WASM chunks → CacheFirst on first fetch.
        //   • API calls → NetworkFirst with timeout (graceful offline fallback).
        // `includeAssets` lists public/ files; `globPatterns` scans dist for
        // index.html + the generated registerSW.js. The two sets do not
        // overlap, avoiding duplicate precache entries.
        globPatterns: ['*.html', 'registerSW.js'],
        globDirectory: 'dist',
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//, /^\/embed\//],
        runtimeCaching: [
          {
            // Tool + vendor JS/CSS chunks: CacheFirst so a tool visited once
            // is available offline thereafter.
            urlPattern: ({ url }) =>
              url.pathname.startsWith('/assets/') &&
              /\.(js|css)$/.test(url.pathname),
            handler: 'CacheFirst',
            options: {
              cacheName: 'q-tools-assets',
              expiration: {
                maxEntries: 400,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // WASM files: CacheFirst with correct MIME type.
            urlPattern: ({ url }) => /\.wasm$/i.test(url.pathname),
            handler: 'CacheFirst',
            options: {
              cacheName: 'q-tools-wasm',
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 90 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Images / SVG / fonts: CacheFirst.
            urlPattern: ({ request, url }) =>
              request.destination === 'image' ||
              /\.(png|jpe?g|gif|webp|avif|svg|woff2?|ttf|otf|eot)$/i.test(
                url.pathname,
              ),
            handler: 'CacheFirst',
            options: {
              cacheName: 'q-tools-images',
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Backend API: NetworkFirst with 3s timeout — falls back to cache
            // (and the app falls back to LocalStorage) when offline.
            urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
            method: 'GET',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'q-tools-api',
              networkTimeoutSeconds: 3,
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 5 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
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
