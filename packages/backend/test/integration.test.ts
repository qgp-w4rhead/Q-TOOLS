/**
 * Integration tests for the Q-Tools backend.
 *
 * Verifies the M0.3 acceptance criteria:
 *   - GET /api/health returns { status: 'ok' }
 *   - POST /api/auth/register creates a user
 *   - POST /api/auth/login returns a JWT
 *   - GET /api/auth/me with a valid JWT returns the user profile
 *   - GET /api/tools returns the tool list from the registry
 *
 * Uses a dedicated test database (qtools_test) so dev data is never touched.
 * MongoDB must be running on 127.0.0.1:27017 (the default dev URI).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import supertest from 'supertest';
import type { FastifyInstance } from 'fastify';

import { buildServer } from '../src/server.js';

/* ------------------------------------------------------------------ */
/* Setup / teardown                                                    */
/* ------------------------------------------------------------------ */

let app: FastifyInstance;

beforeAll(async () => {
  process.env['NODE_ENV'] = 'test';
  process.env['MONGODB_URI'] = 'mongodb://127.0.0.1:27017/qtools_test';
  app = await buildServer();
  await app.ready();
  // Clean any leftover data from a previous run.
  await app.models.User.deleteMany({});
  await app.models.Favorite.deleteMany({});
  await app.models.Preset.deleteMany({});
});

afterAll(async () => {
  if (app) {
    await app.models.User.deleteMany({});
    await app.models.Favorite.deleteMany({});
    await app.models.Preset.deleteMany({});
    await app.close();
  }
});

/* ------------------------------------------------------------------ */
/* Tests                                                               */
/* ------------------------------------------------------------------ */

describe('GET /api/health', () => {
  it('returns { status: "ok" }', async () => {
    const res = await supertest(app.server).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(typeof res.body.uptime).toBe('number');
    expect(res.body.mongoose).toBe('connected');
  });
});

describe('POST /api/auth/register', () => {
  it('creates a user and returns access + refresh tokens', async () => {
    const res = await supertest(app.server).post('/api/auth/register').send({
      email: 'alice@example.com',
      username: 'alice',
      password: 'super-secret-123',
    });
    expect(res.status).toBe(201);
    expect(res.body.user).toBeDefined();
    expect(res.body.user.email).toBe('alice@example.com');
    expect(res.body.user.username).toBe('alice');
    expect(typeof res.body.accessToken).toBe('string');
    expect(typeof res.body.refreshToken).toBe('string');
  });

  it('rejects duplicate emails with 409', async () => {
    const res = await supertest(app.server).post('/api/auth/register').send({
      email: 'alice@example.com',
      username: 'alice2',
      password: 'super-secret-123',
    });
    expect(res.status).toBe(409);
  });

  it('rejects invalid input with 400', async () => {
    const res = await supertest(app.server).post('/api/auth/register').send({
      email: 'not-an-email',
      username: 'x',
      password: 'short',
    });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/login', () => {
  it('returns a JWT for valid credentials', async () => {
    const res = await supertest(app.server).post('/api/auth/login').send({
      email: 'alice@example.com',
      password: 'super-secret-123',
    });
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('alice@example.com');
    expect(typeof res.body.accessToken).toBe('string');
    expect(typeof res.body.refreshToken).toBe('string');
  });

  it('returns 401 for wrong password', async () => {
    const res = await supertest(app.server).post('/api/auth/login').send({
      email: 'alice@example.com',
      password: 'wrong-password',
    });
    expect(res.status).toBe(401);
  });

  it('returns 401 for unknown user', async () => {
    const res = await supertest(app.server).post('/api/auth/login').send({
      email: 'nobody@example.com',
      password: 'whatever',
    });
    expect(res.status).toBe(401);
  });
});

describe('GET /api/auth/me', () => {
  it('returns the user profile with a valid JWT', async () => {
    const login = await supertest(app.server).post('/api/auth/login').send({
      email: 'alice@example.com',
      password: 'super-secret-123',
    });
    const token = login.body.accessToken as string;

    const res = await supertest(app.server)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('alice@example.com');
    expect(res.body.user.username).toBe('alice');
  });

  it('returns 401 without a token', async () => {
    const res = await supertest(app.server).get('/api/auth/me');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/auth/refresh', () => {
  it('issues a new token pair for a valid refresh token', async () => {
    const login = await supertest(app.server).post('/api/auth/login').send({
      email: 'alice@example.com',
      password: 'super-secret-123',
    });
    const refreshToken = login.body.refreshToken as string;

    const res = await supertest(app.server).post('/api/auth/refresh').send({ refreshToken });
    expect(res.status).toBe(200);
    expect(typeof res.body.accessToken).toBe('string');
    expect(typeof res.body.refreshToken).toBe('string');
  });

  it('rejects an already-rotated refresh token', async () => {
    const login = await supertest(app.server).post('/api/auth/login').send({
      email: 'alice@example.com',
      password: 'super-secret-123',
    });
    const refreshToken = login.body.refreshToken as string;

    const first = await supertest(app.server).post('/api/auth/refresh').send({ refreshToken });
    expect(first.status).toBe(200);

    // The old refresh token should now be invalid (rotation).
    const second = await supertest(app.server).post('/api/auth/refresh').send({ refreshToken });
    expect(second.status).toBe(401);
  });
});

describe('GET /api/tools', () => {
  it('returns the tool list from the registry', async () => {
    const res = await supertest(app.server).get('/api/tools');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    // Every entry has the required metadata fields.
    for (const tool of res.body) {
      expect(tool.slug).toBeDefined();
      expect(tool.name).toBeDefined();
      expect(tool.category).toBeDefined();
      expect(tool.apiAccessible).toBeDefined();
    }
  });

  it('GET /api/tools/:toolName returns a single tool', async () => {
    const res = await supertest(app.server).get('/api/tools/hash-text');
    expect(res.status).toBe(200);
    expect(res.body.slug).toBe('hash-text');
  });

  it('returns 404 for an unknown tool', async () => {
    const res = await supertest(app.server).get('/api/tools/does-not-exist');
    expect(res.status).toBe(404);
  });
});

describe('Favorites + presets (auth-protected user routes)', () => {
  let token: string;

  beforeAll(async () => {
    const login = await supertest(app.server).post('/api/auth/login').send({
      email: 'alice@example.com',
      password: 'super-secret-123',
    });
    token = login.body.accessToken as string;
  });

  it('creates and lists a favorite', async () => {
    const create = await supertest(app.server)
      .post('/api/users/favorites')
      .set('Authorization', `Bearer ${token}`)
      .send({ toolSlug: 'hash-text' });
    expect(create.status).toBe(201);
    expect(create.body.toolSlug).toBe('hash-text');

    const list = await supertest(app.server)
      .get('/api/users/favorites')
      .set('Authorization', `Bearer ${token}`);
    expect(list.status).toBe(200);
    expect(Array.isArray(list.body)).toBe(true);
    expect(list.body.some((f: { toolSlug: string }) => f.toolSlug === 'hash-text')).toBe(true);
  });

  it('creates, updates, and deletes a preset', async () => {
    const create = await supertest(app.server)
      .post('/api/users/presets')
      .set('Authorization', `Bearer ${token}`)
      .send({ toolSlug: 'hash-text', name: 'My preset', config: { algo: 'sha256' } });
    expect(create.status).toBe(201);
    expect(create.body.name).toBe('My preset');
    const id = create.body.id as string;

    const update = await supertest(app.server)
      .patch(`/api/users/presets/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Renamed preset' });
    expect(update.status).toBe(200);
    expect(update.body.name).toBe('Renamed preset');

    const del = await supertest(app.server)
      .delete(`/api/users/presets/${id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(del.status).toBe(204);
  });

  it('rejects unauthenticated requests', async () => {
    const res = await supertest(app.server).get('/api/users/favorites');
    expect(res.status).toBe(401);
  });
});
