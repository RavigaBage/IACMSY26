const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const mobileUserProfileSchema = new mongoose.Schema(
  {
    mobileUserId: {
      type: String,
      required: true,
      unique: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
      default: 'Mobile Visitor',
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    phoneNumber: {
      type: String,
      default: '',
      trim: true,
    },

    studentId: {
      type: String,
      default: '',
      trim: true,
    },

    password: {
      type: String,
      select: false,
    },

    refreshToken: {
      type: String,
      select: false,
    },

    streak: {
      type: Number,
      default: 0,
    },

    longestStreak: {
      type: Number,
      default: 0,
    },

    totalCheckins: {
      type: Number,
      default: 0,
    },

    lastCheckinDate: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

/**
 * Hash password before saving.
 *
 * IMPORTANT:
 * This uses async middleware without `next`.
 * Mongoose waits for the returned Promise to resolve.
 */
mobileUserProfileSchema.pre('save', async function () {
  // Don't hash if there is no password or the password
  // hasn't been modified.
  if (!this.isModified('password') || !this.password) {
    return;
  }

  this.password = await bcrypt.hash(this.password, 12);
});

/**
 * Compare a plain-text password with the stored hash.
 */
mobileUserProfileSchema.methods.comparePassword = async function (userPassword) {
  if (!this.password) {
    return false;
  }

  return bcrypt.compare(userPassword, this.password);
};

module.exports = mongoose.model(
  'MobileUserProfile',
  mobileUserProfileSchema
);
