const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    type: {
      type: String,
      enum: ["appointment", "payment", "system", "feedback", "doctor", "clinic"],
      default: "system",
    },
  },
  { timestamps: true, versionKey: false }
);

const NotificationModel = mongoose.model("Notification", notificationSchema);

module.exports = NotificationModel;
