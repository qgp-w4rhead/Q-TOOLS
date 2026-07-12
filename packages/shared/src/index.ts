/**
 * @q-tools/shared — Zod schemas, types, constants, and the tool registry.
 *
 * Imported by both `@q-tools/frontend` and `@q-tools/backend` so that request
 * and response shapes stay in sync. Sub-modules (schemas, types, constants)
 * are added in later milestones; this file re-exports them as they land.
 */

export const SHARED_PACKAGE_VERSION = '0.0.0' as const;

/** Sentinel exported so the package has a usable surface before M0.4 lands. */
export const SHARED_READY = true as const;
