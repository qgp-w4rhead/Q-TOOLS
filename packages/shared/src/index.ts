/**
 * @q-tools/shared - Zod schemas, types, constants, and the tool registry.
 *
 * Imported by both `@q-tools/frontend` and `@q-tools/backend` so that request
 * and response shapes stay in sync. Sub-modules (schemas, types, constants)
 * are added as milestones land; this file re-exports them as a single barrel.
 */

export const SHARED_PACKAGE_VERSION = '0.0.0' as const;

/** Sentinel exported so the package has a usable surface before all modules land. */
export const SHARED_READY = true as const;

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export * from './types/tool.js';
export * from './types/embed.js';

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

export * from './constants/categories.js';

/* ------------------------------------------------------------------ */
/* Schemas (runtime validation)                                        */
/* ------------------------------------------------------------------ */

export * from './schemas/auth.js';
export * from './schemas/user.js';
export * from './schemas/tool.js';
