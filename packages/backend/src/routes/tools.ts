/**
 * Tool routes - list and invoke.
 *
 *   GET  /api/tools             - list all available tools (metadata)
 *   GET  /api/tools/:toolName   - get a single tool's metadata
 *   POST /api/tools/:toolName   - invoke an API-accessible tool
 *
 * Only tools flagged `apiAccessible: true` in the registry can be invoked
 * via POST. The actual per-tool execution handlers are registered in later
 * milestones; for M0.3 the POST endpoint validates the request and returns
 * a 501 for tools that don't yet have a server-side handler.
 */
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import { InvokeToolRequestSchema } from '@q-tools/shared';

import { TOOLS, findTool } from '../data/tools.js';

/* ------------------------------------------------------------------ */
/* Server-side tool handlers                                           */
/* ------------------------------------------------------------------ */
// Registered by later milestones. Keyed by tool slug. Each handler takes
// the parsed `input` object and returns a JSON-serialisable result.
type ToolHandler = (input: Record<string, unknown>) => Promise<unknown> | unknown;
const handlers = new Map<string, ToolHandler>();

/** Register a server-side handler for a tool slug. */
export function registerToolHandler(slug: string, handler: ToolHandler): void {
  handlers.set(slug, handler);
}

/* ------------------------------------------------------------------ */
/* Routes                                                              */
/* ------------------------------------------------------------------ */

export async function toolRoutes(app: FastifyInstance): Promise<void> {
  /* ---- GET /api/tools ---- */
  app.get('/api/tools', async (_request, reply) => {
    return reply.send(TOOLS);
  });

  /* ---- GET /api/tools/:toolName ---- */
  app.get('/api/tools/:toolName', async (request: FastifyRequest, reply: FastifyReply) => {
    const { toolName } = request.params as { toolName: string };
    const tool = findTool(toolName);
    if (!tool) {
      return reply.status(404).send({ error: 'NotFound', message: `Tool '${toolName}' not found` });
    }
    return reply.send(tool);
  });

  /* ---- POST /api/tools/:toolName ---- */
  app.post('/api/tools/:toolName', async (request: FastifyRequest, reply: FastifyReply) => {
    const { toolName } = request.params as { toolName: string };
    const tool = findTool(toolName);
    if (!tool) {
      return reply.status(404).send({ error: 'NotFound', message: `Tool '${toolName}' not found` });
    }
    if (!tool.apiAccessible) {
      return reply
        .status(403)
        .send({ error: 'Forbidden', message: `Tool '${toolName}' is not API-accessible` });
    }

    const parsed = InvokeToolRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'ValidationError',
        message: parsed.error.issues[0]?.message ?? 'Invalid input',
      });
    }

    const handler = handlers.get(toolName);
    if (!handler) {
      return reply.status(501).send({
        error: 'NotImplemented',
        message: `Tool '${toolName}' has no server-side handler yet`,
      });
    }

    const started = Date.now();
    const output = await handler(parsed.data.input);
    const durationMs = Date.now() - started;
    return reply.send({ tool: toolName, output, durationMs });
  });
}
