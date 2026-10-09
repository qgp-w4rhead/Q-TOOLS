/**
 * Canonical ToolMetadata interface and ToolCategory type.
 *
 * These are the authoritative TypeScript types used by both the frontend and
 * the backend. The Zod schemas in `../schemas/tool.ts` provide runtime
 * validation for API request/response bodies; this interface is the
 * compile-time contract for tool metadata throughout the codebase.
 *
 * `apiAccessible` is optional - tools omit it when they are client-only. The
 * backend treats a missing/`false` value as "not API-accessible".
 */

/** The top-level tool categories. */
export type ToolCategory =
  | 'crypto'
  | 'converter'
  | 'web'
  | 'media'
  | 'dev'
  | 'network'
  | 'math'
  | 'measurement'
  | 'text'
  | 'data'
  | 'security'
  | 'cipher'
  | 'devops'
  | 'api'
  | 'i18n'
  | 'finance'
  | 'geo'
  | 'a11y'
  | 'av';

/** Metadata describing a single tool. */
export interface ToolMetadata {
  /** URL slug, also the route param (`/tools/:slug`). */
  slug: string;
  /** Human-readable name. */
  name: string;
  /** One-line description. */
  description: string;
  /** Category id. */
  category: ToolCategory;
  /** lucide-vue-next icon name (kebab-case, matched in the icon map). */
  icon: string;
  /** Search keywords. */
  keywords: string[];
  /** npm deps this tool lazy-loads (for code-splitting metadata). */
  dependencies: string[];
  /** Whether the tool can be invoked via POST /api/tools/:slug. */
  apiAccessible?: boolean;
  /** Iframe `allow` attributes required in embed mode (e.g. camera; clipboard). */
  iframeRequirements?: string[];
}
