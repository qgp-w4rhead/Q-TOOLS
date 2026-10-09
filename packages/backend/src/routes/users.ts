/**
 * User routes - profile, favorites, presets.
 *
 *   GET    /api/users/me                  - current user's profile
 *   GET    /api/users/favorites           - list the user's favorites
 *   POST   /api/users/favorites           - add a favorite
 *   DELETE /api/users/favorites/:id       - remove a favorite
 *   GET    /api/users/presets             - list the user's presets
 *   POST   /api/users/presets             - create a preset
 *   PATCH  /api/users/presets/:id         - update a preset
 *   DELETE /api/users/presets/:id         - delete a preset
 *
 * All routes require a valid access token.
 */
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import {
  CreateFavoriteRequestSchema,
  CreatePresetRequestSchema,
  UpdatePresetRequestSchema,
  type Favorite,
  type Preset,
} from '@q-tools/shared';

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function toFavorite(doc: {
  _id: { toString(): string };
  userId: { toString(): string };
  toolSlug: string;
  label?: string | null;
  createdAt: Date;
}): Favorite {
  return {
    id: doc._id.toString(),
    toolSlug: doc.toolSlug,
    label: doc.label ?? undefined,
    createdAt: doc.createdAt.toISOString(),
  };
}

function toPreset(doc: {
  _id: { toString(): string };
  userId: { toString(): string };
  toolSlug: string;
  name: string;
  config: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}): Preset {
  return {
    id: doc._id.toString(),
    toolSlug: doc.toolSlug,
    name: doc.name,
    config: doc.config,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

/* ------------------------------------------------------------------ */
/* Routes                                                              */
/* ------------------------------------------------------------------ */

export async function userRoutes(app: FastifyInstance): Promise<void> {
  // All user routes require auth.
  app.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    if (request.url.startsWith('/api/users')) {
      await app.requireAuth(request, reply);
    }
  });

  /* ---- GET /api/users/me ---- */
  app.get('/api/users/me', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = await app.models.User.findById(request.user.sub);
    if (!user) {
      return reply.status(404).send({ error: 'NotFound', message: 'User not found' });
    }
    return reply.send({
      user: {
        id: user._id.toString(),
        email: user.email,
        username: user.username,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
      },
    });
  });

  /* ---- Favorites ---- */

  app.get('/api/users/favorites', async (request: FastifyRequest, reply: FastifyReply) => {
    const docs = await app.models.Favorite.find({ userId: request.user.sub }).sort({ createdAt: -1 });
    return reply.send(docs.map(toFavorite));
  });

  app.post('/api/users/favorites', async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = CreateFavoriteRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'ValidationError',
        message: parsed.error.issues[0]?.message ?? 'Invalid input',
      });
    }
    const { toolSlug, label } = parsed.data;
    try {
      const doc = await app.models.Favorite.create({
        userId: request.user.sub,
        toolSlug,
        label,
      });
      return reply.status(201).send(toFavorite(doc));
    } catch (err) {
      if (err && typeof err === 'object' && 'code' in err && err.code === 11000) {
        return reply.status(409).send({ error: 'Conflict', message: 'Already favourited' });
      }
      throw err;
    }
  });

  app.delete('/api/users/favorites/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const result = await app.models.Favorite.deleteOne({ _id: id, userId: request.user.sub });
    if (result.deletedCount === 0) {
      return reply.status(404).send({ error: 'NotFound', message: 'Favorite not found' });
    }
    return reply.status(204).send();
  });

  /* ---- Presets ---- */

  app.get('/api/users/presets', async (request: FastifyRequest, reply: FastifyReply) => {
    const docs = await app.models.Preset.find({ userId: request.user.sub }).sort({ updatedAt: -1 });
    return reply.send(docs.map(toPreset));
  });

  app.post('/api/users/presets', async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = CreatePresetRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'ValidationError',
        message: parsed.error.issues[0]?.message ?? 'Invalid input',
      });
    }
    const { toolSlug, name, config } = parsed.data;
    try {
      const doc = await app.models.Preset.create({
        userId: request.user.sub,
        toolSlug,
        name,
        config,
      });
      return reply.status(201).send(toPreset(doc));
    } catch (err) {
      if (err && typeof err === 'object' && 'code' in err && err.code === 11000) {
        return reply
          .status(409)
          .send({ error: 'Conflict', message: 'Preset with that name already exists for this tool' });
      }
      throw err;
    }
  });

  app.patch('/api/users/presets/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const parsed = UpdatePresetRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'ValidationError',
        message: parsed.error.issues[0]?.message ?? 'Invalid input',
      });
    }
    const update: Record<string, unknown> = {};
    if (parsed.data.name !== undefined) update['name'] = parsed.data.name;
    if (parsed.data.config !== undefined) update['config'] = parsed.data.config;

    const doc = await app.models.Preset.findOneAndUpdate(
      { _id: id, userId: request.user.sub },
      { $set: update },
      { returnDocument: 'after' },
    );
    if (!doc) {
      return reply.status(404).send({ error: 'NotFound', message: 'Preset not found' });
    }
    return reply.send(toPreset(doc));
  });

  app.delete('/api/users/presets/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const result = await app.models.Preset.deleteOne({ _id: id, userId: request.user.sub });
    if (result.deletedCount === 0) {
      return reply.status(404).send({ error: 'NotFound', message: 'Preset not found' });
    }
    return reply.status(204).send();
  });
}
