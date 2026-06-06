const NotificationModel = require("../model/notification.model");
const MessageModel = require("../model/message.model");

/**
 * Socket.IO Handler - Extracts all real-time logic from app.js.
 * Handles notifications, doctor availability, and live chat features.
 */

// Store online users: mapping of userId -> socketId
const onlineUsers = new Map();

function initSocketIO(io) {
  io.on("connection", (socket) => {
    console.log("🟢 Live client connected:", socket.id);

    // Extract userId from auth data on connection
    const userId = socket.handshake.auth?.userId;
    if (userId) {
      onlineUsers.set(userId.toString(), socket.id);
      console.log(`✅ User ${userId} mapped to socket ${socket.id}`);
    }

    // --- Authentication & User Presence ---
    socket.on("join", (userId) => {
      // 1. Join personal room for targeted notifications
      socket.join(`user_${userId}`);
      console.log(`👤 Socket ${socket.id} joined personal room user_${userId}`);

      // 2. Track online status
      onlineUsers.set(userId.toString(), socket.id);

      // Broadcast online status to others
      io.emit("user-status-changed", { userId, status: "online" });

      // Broadcast updated online users to all rooms
      const onlineUserIds = Array.from(onlineUsers.keys());
      io.emit("presence-update", onlineUserIds);
    });

    // --- Live Chat (Appointment Scoped) ---
    // Join a specific appointment chat room
    socket.on("join-chat-room", (appointmentId) => {
      const roomName = `chat_appt_${appointmentId}`;
      socket.join(roomName);
      console.log(`💬 Socket ${socket.id} joined chat room ${roomName}`);

      // Send list of all online users (global, not room-specific)
      const onlineUserIds = Array.from(onlineUsers.keys());
      console.log(`📊 Online users for presence: ${onlineUserIds.join(", ")}`);
      
      socket.emit("presence-update", onlineUserIds);
      socket.to(roomName).emit("presence-update", onlineUserIds);
    });

    // Leave a specific appointment chat room
    socket.on("leave-chat-room", (appointmentId) => {
      const roomName = `chat_appt_${appointmentId}`;
      socket.leave(roomName);
      console.log(`👋 Socket ${socket.id} left chat room ${roomName}`);
    });

    // Handle typing indicators in chat rooms
    socket.on("typing", ({ appointmentId, senderId, senderName }) => {
      socket
        .to(`chat_appt_${appointmentId}`)
        .emit("user-typing", { senderId, senderName });
    });

    socket.on("stop-typing", ({ appointmentId, senderId }) => {
      socket
        .to(`chat_appt_${appointmentId}`)
        .emit("user-stop-typing", { senderId });
    });

    // Handle sending a message (Note: Persistence is handled in the controller, this is just for real-time delivery if clients are connected)
    socket.on("send-chat-message", async (messageData) => {
      // messageData should contain: appointmentId, senderId, sender, receiverId, content, messageType, fileUrl, timestamp
      const roomName = `chat_appt_${messageData.appointmentId}`;

      // Create complete message object with timestamp if not provided
      // Normalize sender/senderId field
      const senderId = messageData.sender || messageData.senderId;
      const completeMessage = {
        ...messageData,
        sender: senderId,
        senderId: senderId,
        createdAt: messageData.createdAt || new Date().toISOString(),
        messageType: messageData.messageType || 'text',
      };

      // Broadcast to everyone in the room INCLUDING the sender for consistency
      io.to(roomName).emit("receive-chat-message", completeMessage);

      // Also send a notification to the receiver if they are not in the room
      // We check if the receiver has an active socket connection. If not, they'll see it when they login.
      // (The actual DB persistence is done via API call before this event is emitted)
      io.to(`user_${messageData.receiverId}`).emit("notification", {
        title: "New Message",
        message: "You have received a new message regarding your appointment.",
        type: "chat",
      });
    });

    // Handle read receipts
    socket.on("mark-messages-read", ({ appointmentId, readerId, senderId }) => {
      // Notify the original sender that their messages were read
      socket.to(`chat_appt_${appointmentId}`).emit("messages-read-receipt", {
        appointmentId,
        readerId,
        readAt: new Date(),
      });
    });

    // --- Disconnection ---
    socket.on("disconnect", () => {
      console.log("🔴 Live client disconnected:", socket.id);

      // Remove from online users map
      let disconnectedUserId = null;
      for (const [userId, sockId] of onlineUsers.entries()) {
        if (sockId === socket.id) {
          disconnectedUserId = userId;
          onlineUsers.delete(userId);
          break;
        }
      }

      if (disconnectedUserId) {
        io.emit("user-status-changed", {
          userId: disconnectedUserId,
          status: "offline",
        });
        // Broadcast updated online users to all chat rooms
        const onlineUserIds = Array.from(onlineUsers.keys());
        io.emit("presence-update", onlineUserIds);
      }
    });
  });
}

/**
 * Emit a live notification to a specific user via Socket.IO + persist to DB.
 * @param {Object} req - Express request object (to access app.get("io"))
 * @param {String} recipientId - MongoDB ObjectId string of the recipient user
 * @param {Object} opts - { title, message, type }
 */
async function emitNotification(
  req,
  recipientId,
  { title, message, type = "system" },
) {
  try {
    // 1. Save notification to database
    await NotificationModel.create({
      recipient: recipientId,
      title,
      message,
      type,
    });

    // 2. Push via Socket.IO
    const io = req.app.get("io");
    if (io) {
      io.to(`user_${recipientId}`).emit("notification", {
        title,
        message,
        type,
        timestamp: new Date().toISOString(),
      });
    }
  } catch (err) {
    console.error("Socket Emit Notification Error:", err.message);
  }
}

/**
 * Broadcast a live event to ALL connected Socket.IO clients.
 * Used for global updates like doctor availability or clinic changes.
 * @param {Object} req - Express request object
 * @param {String} event - Socket event name (e.g. "doctor-availability", "clinic-update")
 * @param {Object} data - { title, message, ...any extra payload }
 */
function emitBroadcast(req, event, data) {
  try {
    const io = req.app.get("io");
    if (io) {
      io.emit(event, {
        ...data,
        timestamp: new Date().toISOString(),
      });
    }
  } catch (err) {
    console.error("Socket Broadcast Error:", err.message);
  }
}

// Export the init function and helper methods (overriding the old socketEmitter.js)
module.exports = {
  initSocketIO,
  emitNotification,
  emitBroadcast,
  onlineUsers,
};
