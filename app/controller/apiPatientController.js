const UserModel = require("../model/user.model");
const AppointmentModel = require("../model/appointment.model");
const mongoose = require("mongoose");

class apiPatientController {
  async getPatientProfile(req, res) {
    try {
      const patient = await UserModel.findById(req.user.userId).select("-password -refreshToken");
      if (!patient) {
        return res.status(404).json({ success: false, message: "Patient profile not found" });
      }

      return res.status(200).json({
        success: true,
        data: patient,
      });
    } catch (error) {
      console.error("Get Patient Profile Error:", error);
      return res.status(500).json({ success: false, message: "Failed to load profile details", error: error.message });
    }
  }

  async updatePatientProfile(req, res) {
    try {
      const { name, phone, gender, age } = req.body;
      const patient = await UserModel.findById(req.user.userId);

      if (!patient) {
        return res.status(404).json({ success: false, message: "Patient profile not found" });
      }

      patient.name = name || patient.name;
      patient.phone = phone || patient.phone;
      patient.gender = gender || patient.gender;
      patient.age = age ? parseInt(age) : patient.age;

      if (req.file) {
        patient.profilePicture = req.file.path;
        patient.publicId = req.file.filename;
      }

      await patient.save();

      return res.status(200).json({
        success: true,
        message: "Profile details updated successfully",
        data: patient,
      });
    } catch (error) {
      console.error("Update Patient Profile Error:", error);
      return res.status(500).json({ success: false, message: "Failed to update profile details", error: error.message });
    }
  }

  async uploadReport(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: "No document file was selected for upload" });
      }

      // Return the Cloudinary secure URL for local view/record
      return res.status(200).json({
        success: true,
        message: "Medical report document successfully uploaded",
        url: req.file.path,
        filename: req.file.filename,
      });
    } catch (error) {
      console.error("Upload Report Error:", error);
      return res.status(500).json({ success: false, message: "File upload failure", error: error.message });
    }
  }

  async getPatientAppointments(req, res) {
    try {
      const patientId = new mongoose.Types.ObjectId(req.user.userId);

      // Strictly use MongoDB Aggregation instead of populate
      const appointments = await AppointmentModel.aggregate([
        { $match: { patient: patientId } },
        {
          $lookup: {
            from: "users",
            localField: "doctor",
            foreignField: "_id",
            as: "doctorDetails",
          },
        },
        {
          $unwind: {
            path: "$doctorDetails",
            preserveNullAndEmptyArrays: true,
          },
        },
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
            appointmentDate: 1,
            appointmentTimeSlot: 1,
            department: 1,
            status: 1,
            symptoms: 1,
            prescription: 1,
            createdAt: 1,
            doctorDetails: {
              _id: "$doctorDetails._id",
              name: "$doctorDetails.name",
              specialization: "$doctorDetails.specialization",
              profilePicture: "$doctorDetails.profilePicture",
            },
            clinicDetails: {
              _id: "$clinicDetails._id",
              clinicName: "$clinicDetails.clinicName",
              address: "$clinicDetails.address",
            },
          },
        },
        { $sort: { appointmentDate: -1 } },
      ]);

      return res.status(200).json({
        success: true,
        count: appointments.length,
        data: appointments,
      });
    } catch (error) {
      console.error("Get Patient Appointments Error:", error);
      return res.status(500).json({ success: false, message: "Failed to load patient appointments", error: error.message });
    }
  }
}

module.exports = new apiPatientController();
