/**
 * Mongoose User model.
 *
 * Stores account credentials (bcrypt-hashed passwords) and profile data.
 * Email and username are unique indexed. Passwords are never stored in
 * plaintext - only the bcrypt hash is persisted.
 */
import bcrypt from 'bcrypt';
import { Schema, model, type Document, type Model, type Types } from 'mongoose';

/* ------------------------------------------------------------------ */
/* Types (declared before the schema so the schema can reference them) */
/* ------------------------------------------------------------------ */

/** Shape of a User document as returned by Mongoose queries. */
export interface UserDoc extends Document {
  email: string;
  username: string;
  passwordHash: string;
  refreshTokens: Types.DocumentArray<{ jti: string; createdAt: Date }>;
  createdAt: Date;
  updatedAt: Date;

  /** Verify a plaintext password against the stored hash. */
  verifyPassword(password: string): Promise<boolean>;
}

export interface UserModel extends Model<UserDoc> {
  /** Find a user by email (case-insensitive). */
  findByEmail(email: string): Promise<UserDoc | null>;
}

/* ------------------------------------------------------------------ */
/* Schema definition                                                   */
/* ------------------------------------------------------------------ */

const UserSchema = new Schema<UserDoc, UserModel>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
      index: true,
    },
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 3,
      maxlength: 32,
      index: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    // Refresh token jti allow-list for rotation/revocation. Empty means
    // no active refresh sessions (user must log in again).
    refreshTokens: {
      type: [
        {
          jti: { type: String, required: true },
          createdAt: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },
  },
  { timestamps: true, collection: 'users' },
);

/* ------------------------------------------------------------------ */
/* Instance / static methods                                           */
/* ------------------------------------------------------------------ */

UserSchema.methods.verifyPassword = function (this: UserDoc, password: string): Promise<boolean> {
  return bcrypt.compare(password, this.passwordHash);
};

UserSchema.statics.findByEmail = function (this: UserModel, email: string): Promise<UserDoc | null> {
  return this.findOne({ email: email.toLowerCase() }).exec();
};

/* ------------------------------------------------------------------ */
/* Export                                                              */
/* ------------------------------------------------------------------ */

export const User = model<UserDoc, UserModel>('User', UserSchema);
export default User;
