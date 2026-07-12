/**
 * @q-tools/backend entry point.
 *
 * Builds the Fastify server and starts listening on the configured port.
 * Handles graceful shutdown on SIGINT/SIGTERM.
 */
import { buildServer } from './server.js';
import { config } from './config.js';

async function main(): Promise<void> {
  const app = await buildServer();

  const start = Date.now();
  try {
    await app.listen({ port: config.port, host: config.host });
    app.log.info(
      { port: config.port, env: config.nodeEnv, startupMs: Date.now() - start },
      'Q-Tools backend listening',
    );
  } catch (err) {
    app.log.error({ err }, 'failed to start server');
    process.exit(1);
  }

  // Graceful shutdown.
  const shutdown = async (signal: string) => {
    app.log.info({ signal }, 'shutting down');
    await app.close();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

// Run only when executed directly (not when imported by tests).
if (import.meta.url === `file://${process.argv[1]}`) {
  void main();
}

export { buildServer } from './server.js';
