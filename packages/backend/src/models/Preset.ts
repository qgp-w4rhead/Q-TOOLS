/**
 * Mongoose Preset model.
 *
 * A preset is a saved configuration for a specific tool, owned by a user.
 * The `config` field is an arbitrary JSON object whose shape is defined
 * per-tool on the frontend. The (user, toolSlug, name) pair is unique so
 * preset names don't collide within a user's collection for a given tool.
 */
import { Schema, model, type Document, type Model, type InferSchemaType } from 'mongoose';

/* ------------------------------------------------------------------ */
/* Schema definition                                                   */
/* ------------------------------------------------------------------ */

const PresetSchema = new Schema(
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
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 64,
    },
    config: {
      type: Schema.Types.Mixed,
      required: true,
      default: {},
    },
  },
  { timestamps: true, collection: 'presets' },
);

PresetSchema.index({ userId: 1, toolSlug: 1, name: 1 }, { unique: true });

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type PresetDoc = InferSchemaType<typeof PresetSchema> & Document;

export interface PresetModel extends Model<PresetDoc> {}

/* ------------------------------------------------------------------ */
/* Export                                                              */
/* ------------------------------------------------------------------ */

export const Preset = model<PresetDoc, PresetModel>('Preset', PresetSchema);
export default Preset;
