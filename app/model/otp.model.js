const mongoose = require("mongoose");

/**
 * OTP Model — stores hashed OTPs for email verification.
 * Auto-expires via TTL index on `expiresAt`.
 */
const otpSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Stored as bcrypt hash for security
    otpHash: {
      type: String,
      required: true,
    },

    // Expires in 5 minutes
    expiresAt: {
      type: Date,
      required: true,
      default: () => new Date(Date.now() + 5 * 60 * 1000),
    },

    // Track resend/attempt count to prevent abuse
    attempts: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true, versionKey: false }
);

// MongoDB TTL index — document auto-deleted after expiresAt
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Also index on userId for fast lookup & cleanup
otpSchema.index({ userId: 1 });

const OtpModel = mongoose.model("Otp", otpSchema);

module.exports = OtpModel;
