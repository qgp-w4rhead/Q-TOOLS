/**
 * Zod schemas for the public tool API.
 *
 * `GET /api/tools` returns the list of available tools (metadata only).
 * `POST /api/tools/:toolName` accepts an arbitrary JSON body and returns
 * a result — only certain tools are API-accessible (the rest are
 * client-only). The backend decides which tools it exposes via the API.
 */
import { z } from 'zod';

/* ------------------------------------------------------------------ */
/* Tool metadata (public list response)                               */
/* ------------------------------------------------------------------ */

export const ToolCategoryEnum = z.enum([
  'crypto',
  'converter',
  'web',
  'media',
  'dev',
  'network',
  'math',
  'measurement',
  'text',
  'data',
]);

export const ToolMetadataSchema = z.object({
  slug: z.string(),
  name: z.string(),
  description: z.string(),
  category: ToolCategoryEnum,
  icon: z.string(),
  keywords: z.array(z.string()),
  dependencies: z.array(z.string()),
  // Whether the tool can be invoked via POST /api/tools/:slug.
  apiAccessible: z.boolean().default(false),
  iframeRequirements: z.array(z.string()).optional(),
});

export const ListToolsResponseSchema = z.array(ToolMetadataSchema);

/* ------------------------------------------------------------------ */
/* Tool invocation (POST /api/tools/:toolName)                        */
/* ------------------------------------------------------------------ */

export const InvokeToolRequestSchema = z.object({
  // Arbitrary JSON input for the tool — validated per-tool on the backend.
  input: z.record(z.string(), z.unknown()),
});

export const InvokeToolResponseSchema = z.object({
  tool: z.string(),
  output: z.unknown(),
  durationMs: z.number().nonnegative(),
});

/* ------------------------------------------------------------------ */
/* Inferred TypeScript types                                           */
/* ------------------------------------------------------------------ */
/*
 * `ToolCategory` and `ToolMetadata` are exported from `../types/tool.ts` as
 * hand-written interfaces (the canonical compile-time contract). The Zod
 * inferred types below are kept only for the request/response DTOs that are
 * not part of the tool registry contract.
 */

export type ListToolsResponse = z.infer<typeof ListToolsResponseSchema>;
export type InvokeToolRequest = z.infer<typeof InvokeToolRequestSchema>;
export type InvokeToolResponse = z.infer<typeof InvokeToolResponseSchema>;
