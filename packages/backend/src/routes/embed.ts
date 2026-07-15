/**
 * Embed routes — chromeless iframe hosting with permissive framing headers.
 *
 *   GET /embed/*  →  serves the SPA shell (index.html) with headers that
 *                    allow embedding from any origin:
 *                      X-Frame-Options: ALLOWALL
 *                      Content-Security-Policy: frame-ancestors *
 *
 * In production the built SPA is served by @fastify/static, but static file
 * serving only returns files that physically exist — client-side routes like
 * `/embed/tools/hash-text` have no on-disk file. This route acts as the SPA
 * fallback for `/embed/*` paths: it serves `index.html` (from STATIC_ROOT)
 * with the permissive framing headers so the Vue router can take over and
 * render the chromeless tool view.
 *
 * In development Vite serves the SPA and a small middleware plugin in
 * `vite.config.ts` applies the same headers to `/embed/` paths.
 */
import fs from 'node:fs';
import path from 'node:path';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import { config } from '../config.js';

/** Headers that permit embedding from any origin. */
const EMBED_HEADERS: Record<string, string> = {
  'X-Frame-Options': 'ALLOWALL',
  'Content-Security-Policy': 'frame-ancestors *',
};

export async function embedRoutes(app: FastifyInstance): Promise<void> {
  // Only register the SPA fallback when STATIC_ROOT is configured (production).
  // In dev, Vite handles SPA serving + headers via a middleware plugin.
  if (!config.staticRoot) return;

  const staticRoot = path.resolve(config.staticRoot);
  const indexPath = path.join(staticRoot, 'index.html');

  // GET /embed/* — SPA fallback with permissive framing headers.
  app.get('/embed/*', async (_request: FastifyRequest, reply: FastifyReply) => {
    // Apply framing headers.
    for (const [key, value] of Object.entries(EMBED_HEADERS)) {
      reply.header(key, value);
    }
    try {
      const html = await fs.promises.readFile(indexPath, 'utf8');
      reply.type('text/html').send(html);
    } catch {
      reply
        .status(503)
        .send({ error: 'ServiceUnavailable', message: 'SPA shell not built' });
    }
  });
}
