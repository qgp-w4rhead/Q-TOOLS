/**
 * Zod schemas for user profile, favorites, and presets.
 *
 * Shared between the Fastify backend and the Vue frontend. Favorites and
 * presets are per-user collections stored in MongoDB and synced to
 * LocalStorage when offline.
 */
import { z } from 'zod';

/* ------------------------------------------------------------------ */
/* User profile                                                        */
/* ------------------------------------------------------------------ */

export const UserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  username: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

/* ------------------------------------------------------------------ */
/* Favorites                                                           */
/* ------------------------------------------------------------------ */

export const FavoriteSchema = z.object({
  id: z.string(),
  toolSlug: z.string().min(1),
  // Optional user-set label/alias for the favorite.
  label: z.string().max(64).optional(),
  createdAt: z.string(),
});

export const ListFavoritesResponseSchema = z.array(FavoriteSchema);

export const CreateFavoriteRequestSchema = z.object({
  toolSlug: z.string().min(1),
  label: z.string().max(64).optional(),
});

export const CreateFavoriteResponseSchema = FavoriteSchema;

/* ------------------------------------------------------------------ */
/* Presets (saved tool configurations)                                */
/* ------------------------------------------------------------------ */

export const PresetSchema = z.object({
  id: z.string(),
  toolSlug: z.string().min(1),
  name: z.string().min(1).max(64),
  // Arbitrary JSON-serialisable configuration blob for the tool.
  config: z.record(z.string(), z.unknown()),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const ListPresetsResponseSchema = z.array(PresetSchema);

export const CreatePresetRequestSchema = z.object({
  toolSlug: z.string().min(1),
  name: z.string().min(1).max(64),
  config: z.record(z.string(), z.unknown()),
});

export const CreatePresetResponseSchema = PresetSchema;

export const UpdatePresetRequestSchema = z.object({
  name: z.string().min(1).max(64).optional(),
  config: z.record(z.string(), z.unknown()).optional(),
});

export const UpdatePresetResponseSchema = PresetSchema;

/* ------------------------------------------------------------------ */
/* Inferred TypeScript types                                           */
/* ------------------------------------------------------------------ */

export type User = z.infer<typeof UserSchema>;
export type Favorite = z.infer<typeof FavoriteSchema>;
export type ListFavoritesResponse = z.infer<typeof ListFavoritesResponseSchema>;
export type CreateFavoriteRequest = z.infer<typeof CreateFavoriteRequestSchema>;
export type CreateFavoriteResponse = z.infer<typeof CreateFavoriteResponseSchema>;
export type Preset = z.infer<typeof PresetSchema>;
export type ListPresetsResponse = z.infer<typeof ListPresetsResponseSchema>;
export type CreatePresetRequest = z.infer<typeof CreatePresetRequestSchema>;
export type CreatePresetResponse = z.infer<typeof CreatePresetResponseSchema>;
export type UpdatePresetRequest = z.infer<typeof UpdatePresetRequestSchema>;
export type UpdatePresetResponse = z.infer<typeof UpdatePresetResponseSchema>;
