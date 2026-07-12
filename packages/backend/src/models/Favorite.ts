/**
 * Mongoose Favorite model.
 *
 * A favorite is a user's bookmark on a tool. Each user may have many
 * favorites; the (user, toolSlug) pair is unique so a tool can only be
 * favourited once per user.
 */
import { Schema, model, type Document, type Model, type InferSchemaType } from 'mongoose';

/* ------------------------------------------------------------------ */
/* Schema definition                                                   */
/* ------------------------------------------------------------------ */

const FavoriteSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    toolSlug: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
    },
    label: {
      type: String,
      trim: true,
      maxlength: 64,
    },
  },
  { timestamps: true, collection: 'favorites' },
);

// A user can only favourite a given tool once.
FavoriteSchema.index({ userId: 1, toolSlug: 1 }, { unique: true });

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type FavoriteDoc = InferSchemaType<typeof FavoriteSchema> & Document;

export interface FavoriteModel extends Model<FavoriteDoc> {}

/* ------------------------------------------------------------------ */
/* Export                                                              */
/* ------------------------------------------------------------------ */

export const Favorite = model<FavoriteDoc, FavoriteModel>('Favorite', FavoriteSchema);
export default Favorite;
