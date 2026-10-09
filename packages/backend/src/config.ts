/**
 * Backend configuration - loaded from environment variables with safe
 * defaults for local development. `.env` is loaded via `dotenv` when
 * present; in production the environment provides the values directly.
 */
import dotenv from 'dotenv';
import { z } from 'zod';

// Load .env if present (dev only - no-op in production where env is set).
dotenv.config();

/* ------------------------------------------------------------------ */
/* Schema                                                              */
/* ------------------------------------------------------------------ */

const ConfigSchema = z.object({
  nodeEnv: z.enum(['development', 'test', 'production']).default('development'),
  port: z.coerce.number().int().positive().max(65535).default(3001),
  host: z.string().default('0.0.0.0'),

  mongodbUri: z
    .string()
    .min(1)
    .default('mongodb://127.0.0.1:27017/qtools'),

  // JWT secrets - in dev a fixed non-secret default is used so the server
  // starts without .env. Production MUST override these.
  jwtSecret: z.string().min(16).default('dev-insecure-jwt-secret-change-me'),
  jwtRefreshSecret: z.string().min(16).default('dev-insecure-refresh-secret-change-me'),

  // Token lifetimes (human-readable strings accepted by @fastify/jwt).
  accessTokenTtl: z.string().default('15m'),
  refreshTokenTtl: z.string().default('7d'),

  // CORS - comma-separated list of allowed origins, or '*' for any.
  corsOrigins: z.string().default('*'),

  // Rate limiting - max requests per time window per IP.
  rateLimitMax: z.coerce.number().int().positive().default(100),
  rateLimitWindow: z.string().default('1 minute'),

  // Path to the built frontend SPA served by @fastify/static in production.
  // Empty string disables static serving (dev mode - Vite serves the SPA).
  staticRoot: z.string().default(''),
});

/* ------------------------------------------------------------------ */
/* Parse + export                                                      */
/* ------------------------------------------------------------------ */

const parsed = ConfigSchema.safeParse({
  nodeEnv: process.env['NODE_ENV'],
  port: process.env['PORT'],
  host: process.env['HOST'],
  mongodbUri: process.env['MONGODB_URI'],
  jwtSecret: process.env['JWT_SECRET'],
  jwtRefreshSecret: process.env['JWT_REFRESH_SECRET'],
  accessTokenTtl: process.env['ACCESS_TOKEN_TTL'],
  refreshTokenTtl: process.env['REFRESH_TOKEN_TTL'],
  corsOrigins: process.env['CORS_ORIGINS'],
  rateLimitMax: process.env['RATE_LIMIT_MAX'],
  rateLimitWindow: process.env['RATE_LIMIT_WINDOW'],
  staticRoot: process.env['STATIC_ROOT'],
});

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('[config] Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  throw new Error('Invalid environment configuration');
}

export const config = parsed.data;
export type Config = typeof config;
