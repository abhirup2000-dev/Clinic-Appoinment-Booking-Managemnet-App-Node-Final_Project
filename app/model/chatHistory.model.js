const mongoose = require("mongoose");

/**
 * Chat History Model — stores full conversation sessions for the AI chatbot.
 * Supports both guest (no userId) and authenticated users.
 */
const chatMessageSchema = new mongoose.Schema({
  role: {
    type: String,
    enum: ["user", "model"],
    required: true,
  },
  content: {
    type: String,
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

const chatHistorySchema = new mongoose.Schema(
  {
    // Nullable for guest users
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // Client-side session identifier for continuity
    sessionId: {
      type: String,
      required: true,
      index: true,
    },

    messages: [chatMessageSchema],

    // Metadata
    lastActivityAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true, versionKey: false }
);

// Auto-cleanup sessions older than 30 days
chatHistorySchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

const ChatHistoryModel = mongoose.model("ChatHistory", chatHistorySchema);

module.exports = ChatHistoryModel;
