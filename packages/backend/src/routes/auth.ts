/**
 * Auth routes - register, login, refresh, me.
 *
 *   POST /api/auth/register  - create account, return access + refresh tokens
 *   POST /api/auth/login     - verify credentials, return access + refresh tokens
 *   POST /api/auth/refresh   - exchange a refresh token for a new token pair
 *   GET  /api/auth/me        - return the authenticated user's profile
 *
 * Passwords are hashed with bcrypt (12 rounds). Access tokens are
 * short-lived (15m default); refresh tokens are longer-lived (7d default)
 * and tracked by jti so they can be revoked.
 */
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcrypt';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import {
  LoginRequestSchema,
  RefreshRequestSchema,
  RegisterRequestSchema,
  type AccessTokenPayload,
  type UserProfile,
} from '@q-tools/shared';

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const BCRYPT_ROUNDS = 12;

/** Map a Mongoose user document to the public UserProfile shape. */
function toUserProfile(doc: {
  _id: { toString(): string };
  email: string;
  username: string;
  createdAt: Date;
  updatedAt: Date;
}): UserProfile {
  return {
    id: doc._id.toString(),
    email: doc.email,
    username: doc.username,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

/** Issue an access + refresh token pair for a user. */
async function issueTokenPair(
  app: FastifyInstance,
  user: { _id: { toString(): string }; email: string; username: string },
  persistRefresh = true,
): Promise<{ accessToken: string; refreshToken: string; jti: string }> {
  const sub = user._id.toString();
  const jti = randomUUID();

  const accessPayload: AccessTokenPayload = {
    sub,
    email: user.email,
    username: user.username,
    type: 'access',
  };
  const accessToken = app.jwt.sign(accessPayload);

  const refreshToken = app.signRefreshToken({ sub, jti });

  if (persistRefresh) {
    // Persist the refresh token jti so it can be validated/revoked.
    await app.models.User.updateOne({ _id: sub }, { $push: { refreshTokens: { jti } } });
  }

  return { accessToken, refreshToken, jti };
}

/* ------------------------------------------------------------------ */
/* Routes                                                              */
/* ------------------------------------------------------------------ */

export async function authRoutes(app: FastifyInstance): Promise<void> {
  /* ---- POST /api/auth/register ---- */
  app.post('/api/auth/register', async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = RegisterRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'ValidationError',
        message: parsed.error.issues[0]?.message ?? 'Invalid input',
        issues: parsed.error.issues,
      });
    }
    const { email, username, password } = parsed.data;

    // Check for existing email/username.
    const existing = await app.models.User.findOne({
      $or: [{ email: email.toLowerCase() }, { username }],
    });
    if (existing) {
      const field = existing.email === email.toLowerCase() ? 'email' : 'username';
      return reply.status(409).send({ error: 'Conflict', message: `${field} already in use` });
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const user = await app.models.User.create({ email, username, passwordHash });
    const { accessToken, refreshToken } = await issueTokenPair(app, user);

    return reply.status(201).send({
      user: toUserProfile(user),
      accessToken,
      refreshToken,
    });
  });

  /* ---- POST /api/auth/login ---- */
  app.post('/api/auth/login', async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = LoginRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'ValidationError',
        message: parsed.error.issues[0]?.message ?? 'Invalid input',
        issues: parsed.error.issues,
      });
    }
    const { email, password } = parsed.data;

    const user = await app.models.User.findByEmail(email);
    if (!user) {
      return reply.status(401).send({ error: 'Unauthorized', message: 'Invalid credentials' });
    }

    const ok = await user.verifyPassword(password);
    if (!ok) {
      return reply.status(401).send({ error: 'Unauthorized', message: 'Invalid credentials' });
    }

    const { accessToken, refreshToken } = await issueTokenPair(app, user);
    return reply.send({ user: toUserProfile(user), accessToken, refreshToken });
  });

  /* ---- POST /api/auth/refresh ---- */
  app.post('/api/auth/refresh', async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = RefreshRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'ValidationError',
        message: parsed.error.issues[0]?.message ?? 'Invalid input',
      });
    }
    const { refreshToken } = parsed.data;

    let decoded: { sub: string; jti?: string; type: string };
    try {
      decoded = app.verifyRefreshToken(refreshToken);
    } catch {
      return reply.status(401).send({ error: 'Unauthorized', message: 'Invalid refresh token' });
    }

    // Verify the jti is still registered for this user (not revoked).
    const user = await app.models.User.findById(decoded.sub);
    if (!user) {
      return reply.status(401).send({ error: 'Unauthorized', message: 'User not found' });
    }
    const stillValid = user.refreshTokens.some((rt: { jti: string }) => rt.jti === decoded.jti);
    if (!stillValid) {
      return reply.status(401).send({ error: 'Unauthorized', message: 'Refresh token revoked' });
    }

    // Rotate: remove the old jti, issue a new pair.
    await app.models.User.updateOne({ _id: user._id }, { $pull: { refreshTokens: { jti: decoded.jti } } });
    const tokens = await issueTokenPair(app, user);
    return reply.send({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken });
  });

  /* ---- GET /api/auth/me ---- */
  app.get(
    '/api/auth/me',
    { preHandler: app.requireAuth },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = await app.models.User.findById(request.user.sub);
      if (!user) {
        return reply.status(404).send({ error: 'NotFound', message: 'User not found' });
      }
      return reply.send({ user: toUserProfile(user) });
    },
  );
}
