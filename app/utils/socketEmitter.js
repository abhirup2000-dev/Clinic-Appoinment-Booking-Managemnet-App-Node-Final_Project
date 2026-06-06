const NotificationModel = require("../model/notification.model");

/**
 * Emit a live notification to a specific user via Socket.IO + persist to DB.
 * @param {Object} req - Express request object (to access app.get("io"))
 * @param {String} recipientId - MongoDB ObjectId string of the recipient user
 * @param {Object} opts - { title, message, type }
 */
async function emitNotification(req, recipientId, { title, message, type = "system" }) {
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

module.exports = { emitNotification, emitBroadcast };
