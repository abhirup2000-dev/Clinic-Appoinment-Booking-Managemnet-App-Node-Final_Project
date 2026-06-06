const MessageModel = require("../model/message.model");
const AppointmentModel = require("../model/appointment.model");

class apiChatController {
  /**
   * Fetch all messages for a specific appointment chat room.
   * Marks them as read if the receiver is fetching them.
   */
  async getChatMessages(req, res) {
    try {
      const { appointmentId } = req.params;
      const userId = req.user.userId;

      // Ensure appointment exists and user is part of it
      const appointment = await AppointmentModel.findById(appointmentId);
      if (!appointment) {
        return res.status(404).json({ success: false, message: "Appointment not found" });
      }

      if (
        appointment.patient.toString() !== userId &&
        appointment.doctor.toString() !== userId
      ) {
        return res.status(403).json({ success: false, message: "Not authorized to view this chat" });
      }

      // Mark unread messages sent TO this user as read
      await MessageModel.updateMany(
        { appointmentId, receiver: userId, isRead: false },
        { $set: { isRead: true, readAt: new Date() } }
      );

      // Fetch messages sorted by time
      const messages = await MessageModel.find({ appointmentId })
        .sort({ createdAt: 1 })
        .lean();

      return res.status(200).json({
        success: true,
        data: messages,
      });
    } catch (error) {
      console.error("Get Chat Messages Error:", error);
      return res.status(500).json({ success: false, message: "Failed to load chat messages" });
    }
  }

  /**
   * Send a new message in an appointment chat room.
   */
  async sendMessage(req, res) {
    try {
      const { appointmentId } = req.params;
      const { content, messageType, fileUrl, fileName } = req.body;
      const senderId = req.user.userId;

      if (!content && messageType === "text") {
        return res.status(400).json({ success: false, message: "Message content is required" });
      }

      const appointment = await AppointmentModel.findById(appointmentId);
      if (!appointment) {
        return res.status(404).json({ success: false, message: "Appointment not found" });
      }

      // Determine receiver based on sender
      let receiverId;
      if (appointment.patient.toString() === senderId) {
        receiverId = appointment.doctor;
      } else if (appointment.doctor.toString() === senderId) {
        receiverId = appointment.patient;
      } else {
        return res.status(403).json({ success: false, message: "Not authorized to send messages in this chat" });
      }

      // Save message to DB
      const message = await MessageModel.create({
        appointmentId,
        sender: senderId,
        receiver: receiverId,
        content: content || "",
        messageType: messageType || "text",
        fileUrl: fileUrl || "",
        fileName: fileName || "",
      });

      // We don't emit Socket.IO here directly because the client typically emits the send-chat-message 
      // event itself to the room for instant feedback. The DB record serves as the source of truth.

      return res.status(201).json({
        success: true,
        data: message,
      });
    } catch (error) {
      console.error("Send Message Error:", error);
      return res.status(500).json({ success: false, message: "Failed to send message" });
    }
  }

  /**
   * Upload an image/file for the chat.
   * Handled by multer + cloudinary middleware on the route.
   */
  async uploadFile(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: "No file uploaded" });
      }

      return res.status(200).json({
        success: true,
        fileUrl: req.file.path,
        fileName: req.file.originalname,
      });
    } catch (error) {
      console.error("Upload Chat File Error:", error);
      return res.status(500).json({ success: false, message: "Failed to upload file" });
    }
  }
}

module.exports = new apiChatController();
