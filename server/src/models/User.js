import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

export const ROLES = ['student', 'instructor', 'admin'];

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, default: 'student', index: true },
    headline: { type: String, default: '', maxlength: 140 },
    bio: { type: String, default: '', maxlength: 2000 },
    disabled: { type: Boolean, default: false },
  },
  { timestamps: true }
);

userSchema.methods.setPassword = async function setPassword(password) {
  this.passwordHash = await bcrypt.hash(password, 10);
};
userSchema.methods.checkPassword = function checkPassword(password) {
  return bcrypt.compare(password, this.passwordHash);
};
userSchema.methods.toPublic = function toPublic() {
  return {
    id: this._id.toString(),
    name: this.name,
    email: this.email,
    role: this.role,
    headline: this.headline,
    bio: this.bio,
    createdAt: this.createdAt,
  };
};

export const User = mongoose.model('User', userSchema);
