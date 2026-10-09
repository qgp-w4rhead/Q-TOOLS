/**
 * Fastify server factory.
 *
 * Builds and returns a configured Fastify instance without starting it.
 * Separating creation from listening lets tests inject a test port and
 * the entry point (`index.ts`) handle startup logging + shutdown.
 */
import path from 'node:path';
import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import staticPlugin from '@fastify/static';

import { config } from './config.js';
import mongoosePlugin from './plugins/mongoose.js';
import jwtPlugin from './plugins/jwt.js';
import { healthRoutes } from './routes/health.js';
import { authRoutes } from './routes/auth.js';
import { userRoutes } from './routes/users.js';
import { toolRoutes } from './routes/tools.js';
import { pdfVerifyRoutes } from './routes/pdf-verify.js';
import { embedRoutes } from './routes/embed.js';

/* ------------------------------------------------------------------ */
/* Factory                                                             */
/* ------------------------------------------------------------------ */

export async function buildServer(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: config.nodeEnv === 'test' ? 'silent' : 'info',
      transport:
        config.nodeEnv === 'development'
          ? { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss', singleLine: true } }
          : undefined,
    },
    trustProxy: true,
    bodyLimit: 4 * 1024 * 1024, // 4 MiB
  });

  /* ---- Plugins ---- */

  await app.register(cors, {
    origin: config.corsOrigins === '*' ? true : config.corsOrigins.split(',').map((o) => o.trim()),
    credentials: true,
  });

  await app.register(rateLimit, {
    max: config.rateLimitMax,
    timeWindow: config.rateLimitWindow,
  });

  // Mongoose - connection failures are logged but do not crash the server
  // so the health endpoint stays reachable during DB outages.
  try {
    await app.register(mongoosePlugin);
  } catch (err) {
    app.log.error({ err }, 'mongoose: failed to connect - starting without DB');
  }

  await app.register(jwtPlugin);

  // Content-type parser for raw PDF uploads - returns the body as a Buffer so
  // the /api/pdf/verify route can scan the raw bytes. Fastify only parses
  // application/json and text/plain by default; without this parser a
  // application/pdf request would be rejected with FST_ERR_CTP_INVALID_MEDIA.
  app.addContentTypeParser(
    'application/pdf',
    { parseAs: 'buffer' },
    (_req, body, done) => {
      done(null, body);
    },
  );

  // Serve the built SPA in production when STATIC_ROOT is set.
  if (config.staticRoot) {
    await app.register(staticPlugin, {
      root: path.resolve(config.staticRoot),
      prefix: '/',
      decorateReply: false,
    });
  }

  /* ---- Routes ---- */

  await app.register(healthRoutes);
  await app.register(authRoutes);
  await app.register(userRoutes);
  await app.register(toolRoutes);
  await app.register(pdfVerifyRoutes);
  await app.register(embedRoutes);

  /* ---- 404 fallback (JSON, not HTML) ---- */

  app.setNotFoundHandler((request, reply) => {
    reply.status(404).send({ error: 'NotFound', message: `Route ${request.method} ${request.url} not found` });
  });

  /* ---- Global error handler ---- */

  app.setErrorHandler((err, request, reply) => {
    app.log.error({ err, url: request.url }, 'unhandled error');
    const status =
      err && typeof err === 'object' && 'statusCode' in err && typeof err.statusCode === 'number' &&
      err.statusCode >= 400 && err.statusCode < 600
        ? err.statusCode
        : 500;
    const message =
      status < 500 && err && typeof err === 'object' && 'message' in err && typeof err.message === 'string'
        ? err.message
        : 'Something went wrong';
    reply.status(status).send({
      error: status >= 500 ? 'InternalServerError' : 'Error',
      message,
    });
  });

  return app;
}
