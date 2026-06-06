const mongoose = require("mongoose");

const surveyResponseSchema = new mongoose.Schema(
  {
    feedback: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Feedback",
      required: true,
    },
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    clinic: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Clinic",
      required: true,
    },
    waitingTimeRating: {
      type: Number,
      min: 1,
      max: 5,
      required: true,
    },
    cleanlinessRating: {
      type: Number,
      min: 1,
      max: 5,
      required: true,
    },
    staffBehaviorRating: {
      type: Number,
      min: 1,
      max: 5,
      required: true,
    },
    recommendToFriends: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true, versionKey: false }
);

const SurveyResponseModel = mongoose.model("SurveyResponse", surveyResponseSchema);

module.exports = SurveyResponseModel;
