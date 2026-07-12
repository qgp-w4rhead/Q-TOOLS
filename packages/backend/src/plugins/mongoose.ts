/**
 * Fastify Mongoose plugin.
 *
 * Connects to MongoDB on plugin registration and decorates the Fastify
 * instance with `mongoose` (the default connection) and the registered
 * models. The connection is cached across hot reloads in dev so tsx watch
 * doesn't open a new connection on every restart.
 *
 * Uses `mongoose.connect()` (the default connection) so models registered
 * via `mongoose.model()` share the same connection.
 */
import fp from 'fastify-plugin';
import mongoose, { type Connection } from 'mongoose';

import { User } from '../models/User.js';
import { Favorite } from '../models/Favorite.js';
import { Preset } from '../models/Preset.js';
import { config } from '../config.js';

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

declare module 'fastify' {
  interface FastifyInstance {
    mongoose: Connection;
    models: {
      User: typeof User;
      Favorite: typeof Favorite;
      Preset: typeof Preset;
    };
  }
}

/* ------------------------------------------------------------------ */
/* Plugin                                                              */
/* ------------------------------------------------------------------ */

async function mongoosePlugin(app: import('fastify').FastifyInstance) {
  // Reuse an existing connection across dev hot reloads.
  const existing = (global as unknown as { __mongooseConn?: Connection }).__mongooseConn;
  if (existing && existing.readyState === mongoose.ConnectionStates.connected) {
    app.decorate('mongoose', existing);
    app.decorate('models', { User, Favorite, Preset });
    app.log.info('mongoose: reusing existing connection');
    return;
  }

  app.log.info({ uri: config.mongodbUri }, 'mongoose: connecting');
  // `mongoose.connect` establishes the default connection that all
  // `mongoose.model()` calls use. We set a buffer timeout so queries
  // fail fast (instead of hanging indefinitely) if the DB is unreachable.
  mongoose.set('bufferCommands', true);
  const conn = await mongoose.connect(config.mongodbUri, {
    bufferCommands: true,
    serverSelectionTimeoutMS: 5000,
  });
  const connection = conn.connection;
  (global as unknown as { __mongooseConn?: Connection }).__mongooseConn = connection;

  app.decorate('mongoose', connection);
  app.decorate('models', { User, Favorite, Preset });

  app.addHook('onClose', async (instance) => {
    instance.log.info('mongoose: closing connection');
    await mongoose.disconnect();
    (global as unknown as { __mongooseConn?: Connection }).__mongooseConn = undefined;
  });
}

export default fp(mongoosePlugin, { name: 'mongoose', dependencies: [] });
