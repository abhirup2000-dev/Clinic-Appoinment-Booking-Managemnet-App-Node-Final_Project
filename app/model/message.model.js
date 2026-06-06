const mongoose = require("mongoose");

/**
 * Message Model — stores individual messages for live patient-doctor chat rooms.
 * Each chat room is scoped to an appointment (appointmentId).
 */
const messageSchema = new mongoose.Schema(
  {
    // Room identifier — one room per appointment
    appointmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Appointment",
      required: true,
      index: true,
    },

    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    receiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Message content
    content: {
      type: String,
      default: "",
    },

    // Type of message
    messageType: {
      type: String,
      enum: ["text", "image", "file"],
      default: "text",
    },

    // URL for image/file uploads (Cloudinary)
    fileUrl: {
      type: String,
      default: "",
    },

    fileName: {
      type: String,
      default: "",
    },

    // Read status
    isRead: {
      type: Boolean,
      default: false,
    },

    readAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true, versionKey: false }
);

// Compound index for fast room-based queries
messageSchema.index({ appointmentId: 1, createdAt: 1 });

const MessageModel = mongoose.model("Message", messageSchema);

module.exports = MessageModel;
