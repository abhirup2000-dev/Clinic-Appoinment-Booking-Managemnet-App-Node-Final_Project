const mongoose = require("mongoose");

const clinicSchema = new mongoose.Schema({
  clinicName: {
    type: String,
    required: true,
  },

  email: {
    type: String,
    required: true,
  },

  phone: {
    type: String,
    required: true
  },

  address: {
    type: String,
    required: true
  },

  logo: {
    type: String,
    default: ""
  },

  publicId: {
    type: String,
    default: ""
  },

  departments: [
    {
      type: String,
    },
  ],

  clinicAdmin: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },

  subscriptionPlan: {
    type: String,
    enum: ["free", "pro", "enterprise"],
    default: "free",
  },

  averageRating: {
    type: Number,
    default: 0,
  },

  isVerified: {
    type: Boolean,
    default: false,
  },

  // GeoJSON Point for geospatial queries (nearby clinics)
  location: {
    type: {
      type: String,
      enum: ["Point"],
      default: "Point",
    },
    // [longitude, latitude] — MongoDB GeoJSON standard
    coordinates: {
      type: [Number],
      default: [0, 0],
    },
  },
}, { timestamps: true });

// 2dsphere index for $near / $geoNear geospatial queries
clinicSchema.index({ location: "2dsphere" });

const ClinicModel = mongoose.model("Clinic", clinicSchema);

module.exports = ClinicModel;