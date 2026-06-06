const UserModel = require("../model/user.model");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const { emitBroadcast } = require("../utils/socketEmitter");
const { sendEmail } = require("../config/emailconfig");
const { doctorCredentialEmailTemplate } = require("../services/emailTemplates");

class apiDoctorController {
  async createDoctor(req, res) {
    try {
      const { name, email, phone, password, clinic, specialization, gender, age } = req.body;

      if (!name || !email || !password || !specialization) {
        return res.status(400).json({ success: false, message: "Missing required doctor fields" });
      }

      const exists = await UserModel.findOne({ email });
      if (exists) {
        return res.status(409).json({ success: false, message: "Email is already registered" });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const newDoctor = await UserModel.create({
        name,
        email,
        password: hashedPassword,
        phone: phone || "",
        role: "doctor",
        clinic: clinic ? new mongoose.Types.ObjectId(clinic) : null,
        specialization,
        gender: gender || "",
        age: age ? parseInt(age) : null,
        isFirstLogin: true, // Force password reset on first login
        profilePicture: req.file ? req.file.path : "https://placehold.co/150x150?text=Doctor",
        publicId: req.file ? req.file.filename : "",
      });

      // Send credential email to the newly created doctor
      const loginUrl = `${req.protocol}://${req.get("host")}/doctor/login-view`;
      sendEmail({
        to: newDoctor.email,
        subject: "🩺 Your CareConnect Doctor Portal Credentials",
        html: doctorCredentialEmailTemplate(newDoctor.name, newDoctor.email, password, loginUrl),
      });

      // Broadcast doctor availability change to all connected clients
      emitBroadcast(req, "doctor-availability", {
        action: "added",
        title: "New Doctor Available",
        message: `Dr. ${newDoctor.name} (${newDoctor.specialization}) is now available for consultations.`,
        doctorId: newDoctor._id,
        doctorName: newDoctor.name,
        specialization: newDoctor.specialization,
      });

      return res.status(201).json({
        success: true,
        message: "Doctor successfully registered",
        data: {
          id: newDoctor._id,
          name: newDoctor.name,
          email: newDoctor.email,
          specialization: newDoctor.specialization,
        },
      });
    } catch (error) {
      console.error("Create Doctor Error:", error);
      return res.status(500).json({ success: false, message: "Failed to register doctor", error: error.message });
    }
  }

  async getAllDoctors(req, res) {
    try {
      // Strictly use MongoDB Aggregation
      const doctors = await UserModel.aggregate([
        { $match: { role: "doctor" } },
        {
          $lookup: {
            from: "clinics",
            localField: "clinic",
            foreignField: "_id",
            as: "clinicDetails",
          },
        },
        {
          $unwind: {
            path: "$clinicDetails",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $project: {
            password: 0,
            refreshToken: 0,
          },
        },
        { $sort: { createdAt: -1 } },
      ]);

      return res.status(200).json({
        success: true,
        count: doctors.length,
        data: doctors,
      });
    } catch (error) {
      console.error("Get All Doctors Error:", error);
      return res.status(500).json({ success: false, message: "Failed to load doctors list", error: error.message });
    }
  }

  async getDoctorById(req, res) {
    try {
      const doctorId = new mongoose.Types.ObjectId(req.params.id);

      // Strictly use MongoDB Aggregation to join clinic and feedback ratings
      const doctorData = await UserModel.aggregate([
        { $match: { _id: doctorId, role: "doctor" } },
        {
          $lookup: {
            from: "clinics",
            localField: "clinic",
            foreignField: "_id",
            as: "clinicDetails",
          },
        },
        {
          $unwind: {
            path: "$clinicDetails",
            preserveNullAndEmptyArrays: true,
          },
        },
        // Lookup feedback ratings to calculate average rating
        {
          $lookup: {
            from: "feedbacks",
            localField: "_id",
            foreignField: "doctor",
            as: "feedbacks",
          },
        },
        {
          $addFields: {
            averageRating: { $ifNull: [{ $avg: "$feedbacks.rating" }, 0] },
            totalReviews: { $size: "$feedbacks" },
          },
        },
        {
          $project: {
            password: 0,
            refreshToken: 0,
            feedbacks: 0, // hide raw list
          },
        },
      ]);

      if (doctorData.length === 0) {
        return res.status(404).json({ success: false, message: "Doctor not found" });
      }

      return res.status(200).json({
        success: true,
        data: doctorData[0],
      });
    } catch (error) {
      console.error("Get Doctor By Id Error:", error);
      return res.status(500).json({ success: false, message: "Failed to retrieve doctor details", error: error.message });
    }
  }

  async updateDoctor(req, res) {
    try {
      const { id } = req.params;
      const { name, email, phone, clinic, specialization, gender, age } = req.body;

      const doctor = await UserModel.findById(id);
      if (!doctor || doctor.role !== "doctor") {
        return res.status(404).json({ success: false, message: "Doctor not found" });
      }

      doctor.name = name || doctor.name;
      doctor.email = email || doctor.email;
      doctor.phone = phone || doctor.phone;
      doctor.clinic = clinic ? new mongoose.Types.ObjectId(clinic) : doctor.clinic;
      doctor.specialization = specialization || doctor.specialization;
      doctor.gender = gender || doctor.gender;
      doctor.age = age ? parseInt(age) : doctor.age;

      if (req.file) {
        doctor.profilePicture = req.file.path;
        doctor.publicId = req.file.filename;
      }

      await doctor.save();

      // Broadcast doctor profile update to all connected clients
      emitBroadcast(req, "doctor-availability", {
        action: "updated",
        title: "Doctor Profile Updated",
        message: `Dr. ${doctor.name}'s profile has been updated.`,
        doctorId: doctor._id,
        doctorName: doctor.name,
        specialization: doctor.specialization,
      });

      return res.status(200).json({
        success: true,
        message: "Doctor details updated successfully",
        data: {
          id: doctor._id,
          name: doctor.name,
          email: doctor.email,
          specialization: doctor.specialization,
        },
      });
    } catch (error) {
      console.error("Update Doctor Error:", error);
      return res.status(500).json({ success: false, message: "Failed to update doctor details", error: error.message });
    }
  }

  async deleteDoctor(req, res) {
    try {
      const { id } = req.params;
      const doctor = await UserModel.findOneAndDelete({ _id: id, role: "doctor" });

      if (!doctor) {
        return res.status(404).json({ success: false, message: "Doctor not found" });
      }

      // Broadcast doctor removal to all connected clients
      emitBroadcast(req, "doctor-availability", {
        action: "removed",
        title: "Doctor Removed",
        message: `Dr. ${doctor.name} is no longer available.`,
        doctorId: doctor._id,
        doctorName: doctor.name,
      });

      return res.status(200).json({
        success: true,
        message: "Doctor successfully deleted",
      });
    } catch (error) {
      console.error("Delete Doctor Error:", error);
      return res.status(500).json({ success: false, message: "Failed to delete doctor", error: error.message });
    }
  }
}

module.exports = new apiDoctorController();
