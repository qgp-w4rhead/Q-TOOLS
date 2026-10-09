/**
 * GET /api/health - liveness/health check.
 *
 * Returns `{ status: 'ok', ... }` with build and uptime metadata. Does not
 * require a database connection - the health endpoint must succeed even
 * when MongoDB is starting up.
 */
import type { FastifyInstance } from 'fastify';

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/health', async (_request, reply) => {
    const mongooseState = app.mongoose?.readyState ?? 0;
    const mongooseStatus =
      mongooseState === 1 ? 'connected' : mongooseState === 2 ? 'connecting' : 'disconnected';

    return reply.send({
      status: 'ok',
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
      mongoose: mongooseStatus,
    });
  });
}
