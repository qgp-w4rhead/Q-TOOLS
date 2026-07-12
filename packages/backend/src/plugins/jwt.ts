/**
 * Fastify JWT auth plugin.
 *
 * Registers @fastify/jwt and adds a `requireAuth` preHandler that verifies
 * the access token from the Authorization header. Access and refresh tokens
 * share the same secret but are differentiated by the `type` claim
 * ('access' | 'refresh') so a refresh token cannot be used as an access
 * token and vice-versa.
 *
 * On successful verification the decoded payload is available at
 * `request.user`.
 */
import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import { config } from '../config.js';
import type { AccessTokenPayload, RefreshTokenPayload } from '@q-tools/shared';

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

declare module 'fastify' {
  interface FastifyInstance {
    /**
     * Verify the access token in the Authorization header. Sends 401 on
     * failure. On success `request.user` holds the decoded payload.
     */
    requireAuth: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    /**
     * Verify a refresh token and return its payload. Throws on invalid token
     * or if the token is not a refresh token.
     */
    verifyRefreshToken: (token: string) => RefreshTokenPayload;
    /** Sign a refresh token. */
    signRefreshToken: (payload: { sub: string; jti: string }) => string;
  }
}

declare module '@fastify/jwt' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface FastifyJWT {
    payload: AccessTokenPayload | RefreshTokenPayload;
  }
}

/* ------------------------------------------------------------------ */
/* Plugin                                                              */
/* ------------------------------------------------------------------ */

async function jwtPlugin(app: FastifyInstance) {
  await app.register(import('@fastify/jwt'), {
    secret: config.jwtSecret,
    sign: { expiresIn: config.accessTokenTtl },
  });

  app.decorate(
    'requireAuth',
    async function (this: FastifyInstance, request: FastifyRequest, reply: FastifyReply) {
      try {
        await request.jwtVerify();
        // Reject refresh tokens presented as access tokens.
        if (request.user.type !== 'access') {
          throw new Error('wrong token type');
        }
      } catch {
        await reply
          .status(401)
          .send({ error: 'Unauthorized', message: 'Invalid or missing access token' });
      }
    },
  );

  app.decorate(
    'signRefreshToken',
    function (this: FastifyInstance, payload: { sub: string; jti: string }) {
      return this.jwt.sign(
        { ...payload, type: 'refresh' } satisfies RefreshTokenPayload,
        { expiresIn: config.refreshTokenTtl },
      );
    },
  );

  app.decorate('verifyRefreshToken', function (this: FastifyInstance, token: string) {
    const decoded = this.jwt.verify<RefreshTokenPayload>(token);
    if (decoded.type !== 'refresh') {
      throw new Error('Not a refresh token');
    }
    return decoded;
  });
}

export default fp(jwtPlugin, { name: 'jwt', dependencies: [] });
