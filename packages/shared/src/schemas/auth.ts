/**
 * Zod schemas for authentication requests and responses.
 *
 * Shared between the Fastify backend and the Vue frontend so request/response
 * shapes stay in sync. The backend uses these for input validation; the
 * frontend uses the inferred types for its API client.
 */
import { z } from 'zod';

/* ------------------------------------------------------------------ */
/* Register                                                            */
/* ------------------------------------------------------------------ */

export const RegisterRequestSchema = z.object({
  email: z.string().email().max(254),
  username: z
    .string()
    .min(3)
    .max(32)
    .regex(/^[a-zA-Z0-9_.-]+$/, {
      message: 'Username may only contain letters, numbers, _, . and -.',
    }),
  password: z.string().min(8).max(512),
});

export const RegisterResponseSchema = z.object({
  user: z.object({
    id: z.string(),
    email: z.string().email(),
    username: z.string(),
    createdAt: z.string(),
  }),
  accessToken: z.string(),
  refreshToken: z.string(),
});

/* ------------------------------------------------------------------ */
/* Login                                                               */
/* ------------------------------------------------------------------ */

export const LoginRequestSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(512),
});

export const LoginResponseSchema = RegisterResponseSchema;

/* ------------------------------------------------------------------ */
/* Refresh                                                             */
/* ------------------------------------------------------------------ */

export const RefreshRequestSchema = z.object({
  refreshToken: z.string().min(1),
});

export const RefreshResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
});

/* ------------------------------------------------------------------ */
/* Me                                                                  */
/* ------------------------------------------------------------------ */

export const UserProfileSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  username: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const MeResponseSchema = z.object({
  user: UserProfileSchema,
});

/* ------------------------------------------------------------------ */
/* JWT payload (internal - used by the backend jwt plugin)             */
/* ------------------------------------------------------------------ */

export const AccessTokenPayloadSchema = z.object({
  sub: z.string(),
  email: z.string().email(),
  username: z.string(),
  type: z.literal('access'),
});

export const RefreshTokenPayloadSchema = z.object({
  sub: z.string(),
  type: z.literal('refresh'),
  // jti (token id) is optional - present when rotation is used.
  jti: z.string().optional(),
});

/* ------------------------------------------------------------------ */
/* Inferred TypeScript types                                           */
/* ------------------------------------------------------------------ */

export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;
export type RegisterResponse = z.infer<typeof RegisterResponseSchema>;
export type LoginRequest = z.infer<typeof LoginRequestSchema>;
export type LoginResponse = z.infer<typeof LoginResponseSchema>;
export type RefreshRequest = z.infer<typeof RefreshRequestSchema>;
export type RefreshResponse = z.infer<typeof RefreshResponseSchema>;
export type UserProfile = z.infer<typeof UserProfileSchema>;
export type MeResponse = z.infer<typeof MeResponseSchema>;
export type AccessTokenPayload = z.infer<typeof AccessTokenPayloadSchema>;
export type RefreshTokenPayload = z.infer<typeof RefreshTokenPayloadSchema>;
