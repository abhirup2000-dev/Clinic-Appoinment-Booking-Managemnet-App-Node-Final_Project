const UserModel = require("../model/user.model");
const AppointmentModel = require("../model/appointment.model");
const ChatHistoryModel = require("../model/chatHistory.model");
const geminiService = require("../services/geminiService");
const crypto = require("crypto");
const mongoose = require("mongoose");

class apiAIController {
  async recommendDoctor(req, res) {
    try {
      const { symptoms } = req.body;
      if (!symptoms) {
        return res.status(400).json({ success: false, message: "Symptoms description is required" });
      }

      const text = symptoms.toLowerCase();
      let matchedSpecialty = "General Medicine";

      // AI Clinical Keyword Mapper
      if (text.includes("heart") || text.includes("cardio") || text.includes("chest") || text.includes("ecg") || text.includes("pulse") || text.includes("bp")) {
        matchedSpecialty = "Cardiology";
      } else if (text.includes("child") || text.includes("pediatric") || text.includes("baby") || text.includes("toddler") || text.includes("kid") || text.includes("vaccine")) {
        matchedSpecialty = "Pediatrics";
      } else if (text.includes("tooth") || text.includes("teeth") || text.includes("dental") || text.includes("gum") || text.includes("dentist") || text.includes("mouth")) {
        matchedSpecialty = "Dental Care";
      } else if (text.includes("brain") || text.includes("nerve") || text.includes("headache") || text.includes("migraine") || text.includes("neuro")) {
        matchedSpecialty = "Neurology";
      } else if (text.includes("bone") || text.includes("joint") || text.includes("fracture") || text.includes("muscle") || text.includes("back pain") || text.includes("knee") || text.includes("ortho")) {
        matchedSpecialty = "Orthopedics";
      }

      // Strictly use MongoDB Aggregation to retrieve matches and sort by high average ratings
      const recommendedDoctors = await UserModel.aggregate([
        {
          $match: {
            role: "doctor",
            specialization: { $regex: matchedSpecialty, $options: "i" },
          },
        },
        {
          $lookup: {
            from: "clinics",
            localField: "clinic",
            foreignField: "_id",
            as: "clinicInfo",
          },
        },
        {
          $unwind: {
            path: "$clinicInfo",
            preserveNullAndEmptyArrays: true,
          },
        },
        // Feedbacks lookup to calculate performance index
        {
          $lookup: {
            from: "feedbacks",
            localField: "_id",
            foreignField: "doctor",
            as: "feedbacksList",
          },
        },
        {
          $addFields: {
            averageRating: { $ifNull: [{ $avg: "$feedbacksList.rating" }, 5] }, // Default high if fresh
            totalReviews: { $size: "$feedbacksList" },
          },
        },
        {
          $project: {
            password: 0,
            refreshToken: 0,
            feedbacksList: 0,
          },
        },
        { $sort: { averageRating: -1, totalReviews: -1 } },
      ]);

      return res.status(200).json({
        success: true,
        matchedSpecialty,
        count: recommendedDoctors.length,
        data: recommendedDoctors,
      });
    } catch (error) {
      console.error("AI Recommend Doctor Error:", error);
      return res.status(500).json({ success: false, message: "AI Doctor recommendation failed", error: error.message });
    }
  }

  async predictWaitingTime(req, res) {
    try {
      const { doctorId, appointmentDate } = req.body;

      if (!doctorId || !appointmentDate) {
        return res.status(400).json({ success: false, message: "Doctor ID and appointmentDate are required" });
      }

      const targetDoctorId = new mongoose.Types.ObjectId(doctorId);
      const parsedDate = new Date(appointmentDate);
      parsedDate.setUTCHours(0, 0, 0, 0);
      const nextDay = new Date(parsedDate);
      nextDay.setUTCDate(nextDay.getUTCDate() + 1);

      // Aggregation: count active queue bookings for this doctor on selected date
      const activeQueue = await AppointmentModel.aggregate([
        {
          $match: {
            doctor: targetDoctorId,
            appointmentDate: {
              $gte: parsedDate,
              $lt: nextDay,
            },
            status: { $in: ["pending", "confirmed"] },
          },
        },
        {
          $count: "queueLength",
        },
      ]);

      const queueLength = activeQueue[0]?.queueLength || 0;
      // Math: each consultation session takes approximately 15 minutes
      const predictedWaitingTimeMinutes = queueLength * 15;

      return res.status(200).json({
        success: true,
        queueLength,
        predictedWaitingTimeMinutes,
        message: `Current queue is ${queueLength} patients. Estimated wait time is ${predictedWaitingTimeMinutes} minutes.`,
      });
    } catch (error) {
      console.error("AI Predict Waiting Time Error:", error);
      return res.status(500).json({ success: false, message: "AI queue calculation failed", error: error.message });
    }
  }

  async recommendSlot(req, res) {
    try {
      const { doctorId, appointmentDate } = req.body;

      if (!doctorId || !appointmentDate) {
        return res.status(400).json({ success: false, message: "Doctor ID and appointmentDate are required" });
      }

      const targetDoctorId = new mongoose.Types.ObjectId(doctorId);
      const parsedDate = new Date(appointmentDate);
      parsedDate.setUTCHours(0, 0, 0, 0);
      const nextDay = new Date(parsedDate);
      nextDay.setUTCDate(nextDay.getUTCDate() + 1);

      // Standard active timeslots
      const standardSlots = [
        "09:00 AM - 10:00 AM",
        "10:00 AM - 11:00 AM",
        "11:00 AM - 12:00 PM",
        "02:00 PM - 03:00 PM",
        "03:00 PM - 04:00 PM",
        "04:00 PM - 05:00 PM",
      ];

      // Retrieve all booked timeslots on that date strictly using aggregations
      const bookedAppointments = await AppointmentModel.aggregate([
        {
          $match: {
            doctor: targetDoctorId,
            appointmentDate: {
              $gte: parsedDate,
              $lt: nextDay,
            },
            status: { $nin: ["cancelled", "completed"] },
          },
        },
        {
          $project: {
            appointmentTimeSlot: 1,
          },
        },
      ]);

      const bookedSlots = bookedAppointments.map((appt) => appt.appointmentTimeSlot);
      // Filter available timeslots
      const availableSlots = standardSlots.filter((slot) => !bookedSlots.includes(slot));

      return res.status(200).json({
        success: true,
        totalSlots: standardSlots.length,
        bookedCount: bookedSlots.length,
        availableSlots,
      });
    } catch (error) {
      console.error("AI Recommend Slot Error:", error);
      return res.status(500).json({ success: false, message: "AI slot recommendation failed", error: error.message });
    }
  }

  async chatWithBot(req, res) {
    try {
      const { message, sessionId } = req.body;
      const userId = req.user ? req.user.userId : null;

      if (!message) {
        return res.status(400).json({ success: false, message: "Message is required" });
      }

      // Generate a sessionId if client didn't provide one
      const activeSessionId = sessionId || crypto.randomUUID();

      // Fetch existing history for this session
      let chatHistory = await ChatHistoryModel.findOne({ sessionId: activeSessionId });
      let historyArray = [];

      if (chatHistory) {
        historyArray = chatHistory.messages.map(m => ({
          role: m.role,
          content: m.content
        }));
      }

      // Get AI response
      const reply = await geminiService.chatWithGemini(message, historyArray);

      // Save to database
      const newMessages = [
        { role: "user", content: message },
        { role: "model", content: reply }
      ];

      if (chatHistory) {
        chatHistory.messages.push(...newMessages);
        chatHistory.lastActivityAt = new Date();
        await chatHistory.save();
      } else {
        await ChatHistoryModel.create({
          userId,
          sessionId: activeSessionId,
          messages: newMessages
        });
      }

      return res.status(200).json({
        success: true,
        reply,
        sessionId: activeSessionId
      });
    } catch (error) {
      console.error("ChatBot Error:", error);
      return res.status(500).json({ success: false, message: "Failed to process chat" });
    }
  }

  async getChatHistory(req, res) {
    try {
      const userId = req.user.userId;

      // Get the most recent active session for this user
      const chatHistory = await ChatHistoryModel.findOne({ userId })
        .sort({ lastActivityAt: -1 })
        .lean();

      if (!chatHistory) {
        return res.status(200).json({ success: true, data: [] });
      }

      return res.status(200).json({
        success: true,
        sessionId: chatHistory.sessionId,
        data: chatHistory.messages
      });
    } catch (error) {
      console.error("Get Chat History Error:", error);
      return res.status(500).json({ success: false, message: "Failed to fetch chat history" });
    }
  }
}

module.exports = new apiAIController();
