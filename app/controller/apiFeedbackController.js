const FeedbackModel = require("../model/feedback.model");
const SurveyResponseModel = require("../model/surveyResponse.model");
const ClinicModel = require("../model/clinic.model");
const AppointmentModel = require("../model/appointment.model");
const mongoose = require("mongoose");

class apiFeedbackController {
  async submitFeedback(req, res) {
    try {
      const { appointment, rating, comments, waitingTimeRating, cleanlinessRating, staffBehaviorRating } = req.body;
      const patientId = req.user.userId;

      if (!appointment || !rating || !comments) {
        return res.status(400).json({ success: false, message: "Missing required feedback rating details" });
      }

      // Check if appointment exists
      const appt = await AppointmentModel.findById(appointment);
      if (!appt) {
        return res.status(404).json({ success: false, message: "Appointment not found" });
      }

      // Prevent duplicate feedback
      const exists = await FeedbackModel.findOne({ appointment });
      if (exists) {
        return res.status(409).json({ success: false, message: "Feedback has already been submitted for this consultation" });
      }

      const feedback = await FeedbackModel.create({
        appointment,
        patient: patientId,
        doctor: appt.doctor,
        clinic: appt.clinic,
        rating: parseInt(rating),
        comments,
      });

      // If they provided custom survey responses (cleanliness, waiting time, staff behavior), store them in SurveyResponse
      if (waitingTimeRating || cleanlinessRating || staffBehaviorRating) {
        await SurveyResponseModel.create({
          feedback: feedback._id,
          patient: patientId,
          doctor: appt.doctor,
          clinic: appt.clinic,
          waitingTimeRating: parseInt(waitingTimeRating || 5),
          cleanlinessRating: parseInt(cleanlinessRating || 5),
          staffBehaviorRating: parseInt(staffBehaviorRating || 5),
        });
      }

      // STRICTLY use MongoDB Aggregation to calculate clinic average rating
      const stats = await FeedbackModel.aggregate([
        { $match: { clinic: appt.clinic } },
        {
          $group: {
            _id: "$clinic",
            averageRating: { $avg: "$rating" },
            totalReviews: { $sum: 1 },
          },
        },
      ]);

      if (stats.length > 0) {
        const roundedRating = Math.round(stats[0].averageRating * 10) / 10;
        await ClinicModel.findByIdAndUpdate(appt.clinic, {
          averageRating: roundedRating,
          totalReviews: stats[0].totalReviews,
        });
      }

      return res.status(201).json({
        success: true,
        message: "Consultation feedback successfully submitted",
        data: feedback,
      });
    } catch (error) {
      console.error("Submit Feedback Error:", error);
      return res.status(500).json({ success: false, message: "Failed to submit feedback", error: error.message });
    }
  }

  async getAllFeedbacks(req, res) {
    try {
      // Strictly use MongoDB Aggregation instead of populate
      const feedbacks = await FeedbackModel.aggregate([
        { $lookup: { from: "users", localField: "patient", foreignField: "_id", as: "patient" } },
        { $unwind: "$patient" },
        { $lookup: { from: "users", localField: "doctor", foreignField: "_id", as: "doctor" } },
        { $unwind: "$doctor" },
        { $lookup: { from: "clinics", localField: "clinic", foreignField: "_id", as: "clinic" } },
        { $unwind: "$clinic" },
        {
          $project: {
            rating: 1,
            comments: 1,
            createdAt: 1,
            patient: { _id: "$patient._id", name: "$patient.name", email: "$patient.email" },
            doctor: { _id: "$doctor._id", name: "$doctor.name", specialization: "$doctor.specialization" },
            clinic: { _id: "$clinic._id", clinicName: "$clinic.clinicName", address: "$clinic.address" },
          },
        },
        { $sort: { createdAt: -1 } },
      ]);

      return res.status(200).json({
        success: true,
        count: feedbacks.length,
        data: feedbacks,
      });
    } catch (error) {
      console.error("Get All Feedbacks Error:", error);
      return res.status(500).json({ success: false, message: "Failed to retrieve feedbacks ledger", error: error.message });
    }
  }

  async getFeedbackById(req, res) {
    try {
      const feedbackId = new mongoose.Types.ObjectId(req.params.id);

      const feedback = await FeedbackModel.aggregate([
        { $match: { _id: feedbackId } },
        { $lookup: { from: "users", localField: "patient", foreignField: "_id", as: "patient" } },
        { $unwind: "$patient" },
        { $lookup: { from: "users", localField: "doctor", foreignField: "_id", as: "doctor" } },
        { $unwind: "$doctor" },
        { $lookup: { from: "clinics", localField: "clinic", foreignField: "_id", as: "clinic" } },
        { $unwind: "$clinic" },
        // Lookup optional survey answers
        {
          $lookup: {
            from: "surveyresponses",
            localField: "_id",
            foreignField: "feedback",
            as: "surveyDetails",
          },
        },
        {
          $unwind: {
            path: "$surveyDetails",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $project: {
            rating: 1,
            comments: 1,
            createdAt: 1,
            patient: { _id: "$patient._id", name: "$patient.name" },
            doctor: { _id: "$doctor._id", name: "$doctor.name", specialization: "$doctor.specialization" },
            clinic: { _id: "$clinic._id", clinicName: "$clinic.clinicName" },
            surveyDetails: 1,
          },
        },
      ]);

      if (feedback.length === 0) {
        return res.status(404).json({ success: false, message: "Feedback record not found" });
      }

      return res.status(200).json({
        success: true,
        data: feedback[0],
      });
    } catch (error) {
      console.error("Get Feedback By Id Error:", error);
      return res.status(500).json({ success: false, message: "Failed to retrieve feedback details", error: error.message });
    }
  }

  async deleteFeedback(req, res) {
    try {
      const { id } = req.params;
      const feedback = await FeedbackModel.findByIdAndDelete(id);

      if (!feedback) {
        return res.status(404).json({ success: false, message: "Feedback not found" });
      }

      // Also clean up any associated SurveyResponse
      await SurveyResponseModel.findOneAndDelete({ feedback: id });

      return res.status(200).json({
        success: true,
        message: "Feedback record successfully deleted",
      });
    } catch (error) {
      console.error("Delete Feedback Error:", error);
      return res.status(500).json({ success: false, message: "Failed to delete feedback", error: error.message });
    }
  }
}

module.exports = new apiFeedbackController();
