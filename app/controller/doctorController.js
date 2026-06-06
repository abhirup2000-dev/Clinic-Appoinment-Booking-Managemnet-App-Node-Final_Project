const UserModel = require("../model/user.model");
const AppointmentModel = require("../model/appointment.model");
const NotificationModel = require("../model/notification.model");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const { emitNotification } = require("../utils/socketEmitter");
const createRedisClient = require("../config/redisConfig");
const redis = createRedisClient()

class doctorController {
  viewLoginPage(req, res) {
    res.render("doctor/login");
  }
  // Render change password page for first login
  viewChangePassword(req, res) {
    res.render("doctor/change-password");
  }

  // Render live chat page for a specific appointment
  viewLiveChat(req, res) {
    const { appointmentId } = req.params;
    res.render("doctor/live-chat", { appointmentId });
  }

  async doctorLogin(req, res) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        req.flash('error', 'Please enter email and password.');
        return res.redirect("/doctor/login-view");
      }

      const user = await UserModel.findOne({ email });

      if (!user || user.role !== "doctor") {
        req.flash('error', 'Invalid email or password.');
        return res.redirect("/doctor/login-view");
      }

      if (user.status === "blocked") {
        req.flash('error', 'Your doctor account has been blocked by the administrator.');
        return res.redirect("/doctor/login-view");
      }

      const isMatch = await bcrypt.compare(password, user.password);

      if (!isMatch) {
        req.flash('error', 'Invalid email or password.');
        return res.redirect("/doctor/login-view");
      }

      const doctorAccessToken = jwt.sign(
        {
          doctorName: user.name,
          userId: user._id,
          email: user.email,
          phone: user.phone,
          role: user.role,
          profilePicture: user.profilePicture,
        },
        process.env.JWT_SECRET_KEY,
        { expiresIn: "1h" }
      );

      const doctorRefreshToken = jwt.sign(
        {
          userId: user._id,
        },
        process.env.JWT_REFRESH_SECRET_KEY,
        {
          expiresIn: "7d",
        }
      );

      user.refreshToken = doctorRefreshToken;
      await user.save();

      res.cookie("doctorAccessToken", doctorAccessToken, {
        httpOnly: false,
        secure: process.env.NODE_ENV === "production",
        sameSite: "Strict",
        maxAge: 60 * 60 * 1000,
      });

      res.cookie("doctorRefreshToken", doctorRefreshToken, {
        httpOnly: false,
        secure: process.env.NODE_ENV === "production",
        sameSite: "Strict",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      req.flash('success', 'Logged in successfully.');
      res.redirect("/doctor/dashboard");
    } catch (err) {
      req.flash('error', 'An error occurred during login.');
      res.redirect("/doctor/login-view");
    }
  }

  async doctorLogout(req, res) {
    try {
      const refreshToken = req.cookies.doctorRefreshToken;

      if (refreshToken) {
        const user = await UserModel.findOne({ refreshToken });

        if (user) {
          user.refreshToken = null;
          await user.save();
        }
      }

      res.clearCookie("doctorAccessToken");
      res.clearCookie("doctorRefreshToken");

      req.flash('success', 'Logged out successfully.');
      res.redirect("/doctor/login-view");
    } catch (err) {
      req.flash('error', 'An error occurred during logout.');
      res.redirect("/doctor/login-view");
    }
  }

  async viewDashboard(req, res) {
    try {
      const doctorId = new mongoose.Types.ObjectId(req.doctor.userId);

      // Doctor Details + Clinic
      const doctorData = await UserModel.aggregate([
        {
          $match: {
            _id: doctorId,
          },
        },

        {
          $lookup: {
            from: "clinics",
            localField: "clinic",
            foreignField: "_id",
            as: "clinic",
          },
        },

        {
          $unwind: {
            path: "$clinic",
            preserveNullAndEmptyArrays: true,
          },
        },

        {
          $project: {
            password: 0,
            refreshToken: 0,
          },
        },
      ]);

      const doctor = doctorData[0];

      // Appointments + Patient Details
      const appointments = await AppointmentModel.aggregate([
        {
          $match: {
            doctor: doctorId,
          },
        },

        {
          $lookup: {
            from: "users",
            localField: "patient",
            foreignField: "_id",
            as: "patient",
          },
        },

        {
          $unwind: "$patient",
        },

        {
          $project: {
            appointmentDate: 1,
            appointmentTimeSlot: 1,
            status: 1,
            symptoms: 1,
            prescription: 1,
            department: 1,
            medicalReport: 1,
            createdAt: 1,

            patient: {
              _id: "$patient._id",
              name: "$patient.name",
              email: "$patient.email",
              phone: "$patient.phone",
              gender: "$patient.gender",
              age: "$patient.age",
            },
          },
        },

        {
          $sort: {
            appointmentDate: 1,
          },
        },
      ]);

      // Active Appointments
      const activeAppointments = appointments.filter(
        (appt) =>
          appt.status !== "completed" &&
          appt.status !== "cancelled"
      );

      // Finished Appointments
      const finishedAppointments = appointments.filter(
        (appt) =>
          appt.status === "completed" ||
          appt.status === "cancelled"
      );

      res.render("doctor/dashboard", {
        doctor,
        activeAppointments,
        finishedAppointments,
      });
    } catch (err) {
      console.error("Doctor Dashboard Error:", err);
      res.redirect("/doctor/login-view");
    }
  }

  async updateAppointmentStatus(req, res) {
    try {
      const { id } = req.params;
      const { status } = req.body;

      const appt = await AppointmentModel.findOne({
        _id: id,
        doctor: req.doctor.userId,
      });

      if (appt) {
        appt.status = status;
        await appt.save();

        // Emit live notification to the patient
        const patientId = appt.patient.toString();
        const doctorData = await UserModel.findById(req.doctor.userId).select("name");
        const doctorName = doctorData ? doctorData.name : "Your Doctor";
        const statusLabel = status.charAt(0).toUpperCase() + status.slice(1);

        await emitNotification(req, patientId, {
          title: `Appointment ${statusLabel}`,
          message: `Dr. ${doctorName} has ${status} your appointment.`,
          type: "appointment",
        });
        req.flash('success', `Appointment status updated to ${status}.`);
      } else {
        req.flash('error', 'Appointment not found.');
      }

      res.redirect("/doctor/dashboard");
    } catch (err) {
      req.flash('error', 'An error occurred while updating the appointment.');
      res.redirect("/doctor/dashboard");
    }
  }

  async completeAppointment(req, res) {
    try {
      const { id } = req.params;
      const { prescription } = req.body;

      const appt = await AppointmentModel.findOne({
        _id: id,
        doctor: req.doctor.userId,
      });

      if (appt) {
        appt.status = "completed";
        appt.prescription = prescription;

        await appt.save();

        // Emit live notification to the patient
        const patientId = appt.patient.toString();
        const doctorData = await UserModel.findById(req.doctor.userId).select("name");
        const doctorName = doctorData ? doctorData.name : "Your Doctor";

        await emitNotification(req, patientId, {
          title: "Consultation Completed",
          message: `Dr. ${doctorName} has completed your consultation and issued a prescription.`,
          type: "appointment",
        });
        req.flash('success', 'Appointment completed successfully.');
      } else {
        req.flash('error', 'Appointment not found.');
      }

      res.redirect("/doctor/dashboard");
    } catch (err) {
      req.flash('error', 'An error occurred while completing the appointment.');
      res.redirect("/doctor/dashboard");
    }
  }
  async uploadMedicalReport(req, res) {
    try {
      const { id } = req.params;
      const appt = await AppointmentModel.findOne({
        _id: id,
        doctor: req.doctor.userId,
      });

      if (appt && req.file) {
        appt.medicalReport = req.file.path;
        await appt.save();

        // Emit live notification to the patient
        const patientId = appt.patient.toString();
        const doctorData = await UserModel.findById(req.doctor.userId).select("name");
        const doctorName = doctorData ? doctorData.name : "Your Doctor";

        await emitNotification(req, patientId, {
          title: "Medical Report Uploaded",
          message: `Dr. ${doctorName} has uploaded a medical report for your consultation.`,
          type: "appointment",
        });
        req.flash('success', 'Medical report uploaded successfully.');
      } else if (!req.file) {
        req.flash('error', 'No file was uploaded.');
      } else {
        req.flash('error', 'Appointment not found or you are not authorized.');
      }

      res.redirect("/doctor/dashboard");
    } catch (err) {
      console.error("Doctor Upload Medical Report Error:", err);
      req.flash('error', 'An error occurred while uploading the report.');
      res.redirect("/doctor/dashboard");
    }
  }
}

module.exports = new doctorController();