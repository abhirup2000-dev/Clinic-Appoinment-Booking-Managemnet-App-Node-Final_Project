const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },

    password: {
      type: String,
      required: true,
    },

    phone: { type: String, default: "" },

    profilePicture: { type: String, default: "" },

    publicId: { type: String, default: "" },

    role: {
      type: String,
      enum: ["super_admin", "clinic_admin", "doctor", "patient"],
      required: true,
    },

    isVerified: {
      type: Boolean,
      default: false,
    },

    refreshToken: {
      type: String,
      default: null,
    },

    status: {
      type: String,
      enum: ["active", "blocked"],
      default: "active",
    },

    // Doctor specific fields
    clinic: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Clinic",
    },
    specialization: {
      type: String,
      default: "",
    },

    // Patient/Doctor details
    gender: {
      type: String,
      default: "",
    },
    age: {
      type: Number,
      default: null,
    },
    resetPasswordToken: {
      type: String,
      default: null,
    },
    resetPasswordExpires: {
      type: Date,
      default: null,
    },

    // Doctor first-login flag — forces password reset after admin creates account
    isFirstLogin: {
      type: Boolean,
      default: false,
    },

    // Patient appointment tracking for payment
    appointmentCount: {
      type: Number,
      default: 0,
    },
    freeAppointmentsUsed: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true, versionKey: false },
);

const UserModel = mongoose.model("User", userSchema);

module.exports = UserModel;
