const NotificationModel = require("../model/notification.model");
const mongoose = require("mongoose");

class apiNotificationController {
  async sendNotification(req, res) {
    try {
      const { recipient, title, message, type } = req.body;

      if (!recipient || !title || !message) {
        return res.status(400).json({ success: false, message: "Recipient, title, and message are required" });
      }

      const notification = await NotificationModel.create({
        recipient: new mongoose.Types.ObjectId(recipient),
        title,
        message,
        type: type || "system",
      });

      // Push live notification via Socket.IO
      const io = req.app.get("io");
      if (io) {
        io.to(`user_${recipient}`).emit("notification", {
          title,
          message,
          type: type || "system",
          timestamp: new Date().toISOString(),
        });
      }

      return res.status(201).json({
        success: true,
        message: "Notification successfully created and dispatched live",
        data: notification,
      });
    } catch (error) {
      console.error("Send Notification Error:", error);
      return res.status(500).json({ success: false, message: "Failed to dispatch notification", error: error.message });
    }
  }

  async getMyNotifications(req, res) {
    try {
      const recipientId = new mongoose.Types.ObjectId(req.user.userId);

      // Fetch all notifications for logged in user strictly using aggregations
      const notifications = await NotificationModel.aggregate([
        { $match: { recipient: recipientId } },
        { $sort: { createdAt: -1 } },
        { $limit: 50 },
      ]);

      return res.status(200).json({
        success: true,
        count: notifications.length,
        data: notifications,
      });
    } catch (error) {
      console.error("Get My Notifications Error:", error);
      return res.status(500).json({ success: false, message: "Failed to load notifications", error: error.message });
    }
  }

  async markAsRead(req, res) {
    try {
      const { id } = req.params;

      const notification = await NotificationModel.findOneAndUpdate(
        { _id: id, recipient: req.user.userId },
        { isRead: true },
        { new: true }
      );

      if (!notification) {
        return res.status(404).json({ success: false, message: "Notification not found or unauthorized access" });
      }

      return res.status(200).json({
        success: true,
        message: "Notification successfully marked as read",
        data: notification,
      });
    } catch (error) {
      console.error("Mark As Read Error:", error);
      return res.status(500).json({ success: false, message: "Failed to update notification state", error: error.message });
    }
  }

  async markAllAsRead(req, res) {
    try {
      const recipientId = new mongoose.Types.ObjectId(req.user.userId);

      await NotificationModel.updateMany(
        { recipient: recipientId, isRead: false },
        { $set: { isRead: true } }
      );

      return res.status(200).json({
        success: true,
        message: "All notifications marked as read",
      });
    } catch (error) {
      console.error("Mark All As Read Error:", error);
      return res.status(500).json({ success: false, message: "Failed to mark all as read", error: error.message });
    }
  }

  async getUnreadCount(req, res) {
    try {
      const recipientId = new mongoose.Types.ObjectId(req.user.userId);

      const result = await NotificationModel.aggregate([
        { $match: { recipient: recipientId, isRead: false } },
        { $count: "unreadCount" },
      ]);

      const unreadCount = result.length > 0 ? result[0].unreadCount : 0;

      return res.status(200).json({
        success: true,
        unreadCount,
      });
    } catch (error) {
      console.error("Get Unread Count Error:", error);
      return res.status(500).json({ success: false, message: "Failed to get unread count", error: error.message });
    }
  }
}

module.exports = new apiNotificationController();
