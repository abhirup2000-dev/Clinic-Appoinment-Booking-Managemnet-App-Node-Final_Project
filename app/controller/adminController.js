const UserModel = require("../model/user.model");
const ClinicModel = require("../model/clinic.model");
const AppointmentModel = require("../model/appointment.model");
const FeedbackModel = require("../model/feedback.model");
const NotificationModel = require("../model/notification.model");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cloudinary = require("cloudinary").v2;
const { emitNotification, emitBroadcast } = require("../utils/socketEmitter");

class adminAuthController {
  async adminRegister(req, res) {
    try {
      const { name, email, password, phone } = req.body;
      const exists = await UserModel.findOne({ email });
      if (exists) {
        return res.redirect("/admin/register-view");
      }

      const hashed = await bcrypt.hash(password, 10);

      await UserModel.create({
        name,
        email,
        password: hashed,
        phone,
        profilePicture: req.file ? req.file.path : "",
        publicId: req.file ? req.file.filename : "",
        role: "super_admin",
      });

      res.redirect("/admin/login-view");
    } catch (err) {
      console.log(err);
      res.redirect("/admin/register-view");
    }
  }

  async adminLogin(req, res) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.redirect("/admin/login-view");
      }

      const user = await UserModel.findOne({ email });

      if (!user || user.role !== "super_admin") {
        return res.redirect("/admin/login-view");
      }

      const isMatch = await bcrypt.compare(password, user.password);

      if (!isMatch) {
        return res.redirect("/admin/login-view");
      }

      const adminAccessToken = jwt.sign(
        {
          adminName: user.name,
          userId: user._id,
          email: user.email,
          phone: user.phone,
          role: user.role,
          profilePicture: user.profilePicture,
        },
        process.env.JWT_SECRET_KEY,
        { expiresIn: "1h" }, // Let's use 1 hour for smooth UX
      );

      const adminRefreshToken = jwt.sign(
        { userId: user._id },
        process.env.JWT_REFRESH_SECRET_KEY,
        { expiresIn: "7d" },
      );

      user.refreshToken = adminRefreshToken;
      await user.save();

      res.cookie("adminAccessToken", adminAccessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "Strict",
        maxAge: 60 * 60 * 1000,
      });

      res.cookie("adminRefreshToken", adminRefreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "Strict",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      return res.redirect("/admin/dashboard");
    } catch (error) {
      console.error("Admin Login Error:", error);
      return res.redirect("/admin/login-view");
    }
  }

  async updateProfile(req, res) {
    try {
      const { name, email, phone } = req.body;
      const admin = await UserModel.findById(req.admin.userId);

      if (!admin) {
        return res.status(404).json({
          success: false,
          message: "Admin not found",
        });
      }

      admin.name = name || admin.name;
      admin.email = email || admin.email;
      admin.phone = phone || admin.phone;

      if (req.file) {
        if (admin.publicId) {
          await cloudinary.uploader.destroy(admin.publicId);
        }
        admin.profilePicture = req.file.path;
        admin.publicId = req.file.filename;
      }

      await admin.save();

      // Clear cookies and redirect to login, or just reload admin access token
      const adminAccessToken = jwt.sign(
        {
          adminName: admin.name,
          userId: admin._id,
          email: admin.email,
          phone: admin.phone,
          role: admin.role,
          profilePicture: admin.profilePicture,
        },
        process.env.JWT_SECRET_KEY,
        { expiresIn: "1h" },
      );

      res.cookie("adminAccessToken", adminAccessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "Strict",
        maxAge: 60 * 60 * 1000,
      });

      return res.redirect("/admin/dashboard");
    } catch (error) {
      console.log(error);
      return res.redirect("/admin/profile");
    }
  }

  async updatePassword(req, res) {
    try {
      const { currentPassword, newPassword, confirmPassword } = req.body;
      const admin = await UserModel.findById(req.admin.userId);

      if (!admin) {
        return res.redirect("/admin/profile");
      }

      const isMatch = await bcrypt.compare(currentPassword, admin.password);

      if (!isMatch) {
        return res.redirect("/admin/profile");
      }

      if (newPassword !== confirmPassword) {
        return res.redirect("/admin/profile");
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      admin.password = hashedPassword;
      await admin.save();

      return res.redirect("/admin/profile");
    } catch (error) {
      console.log(error.message);
      return res.redirect("/admin/profile");
    }
  }

  async adminLogout(req, res) {
    try {
      const refreshToken = req.cookies.adminRefreshToken;

      if (refreshToken) {
        const admin = await UserModel.findOne({ refreshToken });
        if (admin) {
          admin.refreshToken = null;
          await admin.save();
        }
      }

      res.clearCookie("adminAccessToken");
      res.clearCookie("adminRefreshToken");
      res.redirect("/admin/login-view");
    } catch (error) {
      console.log("LOGOUT ERROR:", error);
      res.redirect("/admin/login-view");
    }
  }

  // CLINICS MANAGEMENT
  async addClinic(req, res) {
    try {
      const {
        clinicName,
        email,
        phone,
        address,
        departments,
        subscriptionPlan,
        latitude,
        longitude,
      } = req.body;
      const deptArray = departments
        ? departments
            .split(",")
            .map((d) => d.trim())
            .filter(Boolean)
        : [];

      const newClinic = await ClinicModel.create({
        clinicName,
        email,
        phone,
        address,
        departments: deptArray,
        subscriptionPlan,
        logo: req.file
          ? req.file.path
          : "https://placehold.co/150x150?text=Clinic+Logo",
        publicId: req.file.filename,

        location: {
          type: "Point",
          coordinates: [parseFloat(longitude), parseFloat(latitude)],
        },
      });

      // Broadcast new clinic to all connected clients
      emitBroadcast(req, "clinic-update", {
        action: "added",
        title: "New Clinic Added",
        message: `${clinicName} is now available on CareConnect.`,
        clinicId: newClinic._id,
        clinicName: clinicName,
      });

      res.redirect("/admin/clinics");
    } catch (err) {
      console.error("Add Clinic Error:", err);
      res.redirect("/admin/clinics");
    }
  }

  async editClinic(req, res) {
    try {
      const { id } = req.params;
      const {
        clinicName,
        email,
        phone,
        address,
        departments,
        subscriptionPlan,
        latitude,
        longitude,
      } = req.body;
      const deptArray = departments
        ? departments
            .split(",")
            .map((d) => d.trim())
            .filter(Boolean)
        : [];

      const clinic = await ClinicModel.findById(id);
      if (!clinic) return res.redirect("/admin/clinics");

      clinic.clinicName = clinicName;
      clinic.email = email;
      clinic.phone = phone;
      clinic.address = address;
      clinic.departments = deptArray;
      clinic.subscriptionPlan = subscriptionPlan;
      clinic.location = {
        type: "Point",
        coordinates: [Number(longitude) || 0, Number(latitude) || 0],
      };

      if (req.file) {
        if (clinic.publicId) {
          cloudinary.uploader.destroy(clinic.publicId);
        }

        clinic.logo = req.file.path;
        clinic.publicId = req.file.filename;
      }

      await clinic.save();

      // Broadcast clinic update to all connected clients
      emitBroadcast(req, "clinic-update", {
        action: "updated",
        title: "Clinic Updated",
        message: `${clinic.clinicName} details have been updated.`,
        clinicId: clinic._id,
        clinicName: clinic.clinicName,
      });

      res.redirect("/admin/clinics");
    } catch (err) {
      console.error("Edit Clinic Error:", err);
      res.redirect("/admin/clinics");
    }
  }

  async deleteClinic(req, res) {
    try {
      const { id } = req.params;
      const clinic = await ClinicModel.findById(id);
      const clinicName = clinic ? clinic.clinicName : "A clinic";
      await ClinicModel.findByIdAndDelete(id);

      // Broadcast clinic removal to all connected clients
      emitBroadcast(req, "clinic-update", {
        action: "removed",
        title: "Clinic Removed",
        message: `${clinicName} has been removed from CareConnect.`,
        clinicId: id,
      });

      res.redirect("/admin/clinics");
    } catch (err) {
      console.error("Delete Clinic Error:", err);
      res.redirect("/admin/clinics");
    }
  }

  // ================= DOCTORS MANAGEMENT =================
  async addDoctor(req, res) {
    try {
      const {
        name,
        email,
        phone,
        password,
        clinic,
        specialization,
        gender,
        age,
      } = req.body;

      const exists = await UserModel.findOne({ email });
      if (exists) {
        return res.redirect("/admin/doctors");
      }

      const hashed = await bcrypt.hash(password, 10);

      await UserModel.create({
        name,
        email,
        password: hashed,
        phone,
        clinic,
        specialization,
        gender,
        age: age ? parseInt(age) : null,
        role: "doctor",
        profilePicture: req.file
          ? req.file.path
          : "https://placehold.co/150x150?text=Doctor",
        publicId: req.file ? req.file.filename : "",
      });

      // Broadcast new doctor to all connected clients
      emitBroadcast(req, "doctor-availability", {
        action: "added",
        title: "New Doctor Available",
        message: `Dr. ${name} (${specialization}) is now available for consultations.`,
      });

      res.redirect("/admin/doctors");
    } catch (err) {
      console.error("Add Doctor Error:", err);
      res.redirect("/admin/doctors");
    }
  }

  async seedDoctors(req, res) {
    try {
      const doctors = req.body.doctors;

      if (!Array.isArray(doctors) || doctors.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Doctors array is required",
        });
      }

      const existingEmails = await UserModel.find({
        email: { $in: doctors.map((d) => d.email) },
      }).select("email");

      const existingSet = new Set(
        existingEmails.map((d) => d.email.toLowerCase()),
      );

      const doctorDocs = [];

      for (const doctor of doctors) {
        if (existingSet.has(doctor.email.toLowerCase())) continue;

        const hashedPassword = await bcrypt.hash(
          doctor.password || "Doctor@123",
          10,
        );

        doctorDocs.push({
          name: doctor.name,
          email: doctor.email,
          password: hashedPassword,
          phone: doctor.phone,
          clinic: doctor.clinic,
          specialization: doctor.specialization,
          gender: doctor.gender,
          age: doctor.age,
          role: "doctor",
          profilePicture:
            doctor.profilePicture || "https://placehold.co/150x150?text=Doctor",
          publicId: "",
        });
      }

      const insertedDoctors =
        doctorDocs.length > 0
          ? await UserModel.insertMany(doctorDocs, { ordered: false })
          : [];

      return res.status(201).json({
        success: true,
        totalReceived: doctors.length,
        inserted: insertedDoctors.length,
        skipped: doctors.length - insertedDoctors.length,
        message: `${insertedDoctors.length} doctors inserted successfully`,
      });
    } catch (error) {
      console.error("Seed Doctors Error:", error);

      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  async editDoctor(req, res) {
    try {
      const { id } = req.params;
      const { name, email, phone, clinic, specialization, gender, age } =
        req.body;

      const doctor = await UserModel.findById(id);
      if (!doctor || doctor.role !== "doctor")
        return res.redirect("/admin/doctors");

      doctor.name = name;
      doctor.email = email;
      doctor.phone = phone;
      doctor.clinic = clinic || null;
      doctor.specialization = specialization;
      doctor.gender = gender;
      doctor.age = age ? parseInt(age) : null;

      if (req.file) {
        if (doctor.publicId) {
          await cloudinary.uploader.destroy(doctor.publicId).catch(() => {});
        }
        doctor.profilePicture = req.file.path;
        doctor.publicId = req.file.filename;
      }

      await doctor.save();

      // Broadcast doctor profile update to all connected clients
      emitBroadcast(req, "doctor-availability", {
        action: "updated",
        title: "Doctor Profile Updated",
        message: `Dr. ${doctor.name}'s profile has been updated.`,
      });

      res.redirect("/admin/doctors");
    } catch (err) {
      console.error("Edit Doctor Error:", err);
      res.redirect("/admin/doctors");
    }
  }

  async deleteDoctor(req, res) {
    try {
      const { id } = req.params;
      const doctor = await UserModel.findById(id);
      const doctorName = doctor ? doctor.name : "A doctor";
      if (doctor && doctor.publicId) {
        await cloudinary.uploader.destroy(doctor.publicId).catch(() => {});
      }
      await UserModel.findByIdAndDelete(id);

      // Broadcast doctor removal to all connected clients
      emitBroadcast(req, "doctor-availability", {
        action: "removed",
        title: "Doctor Removed",
        message: `Dr. ${doctorName} is no longer available.`,
      });

      res.redirect("/admin/doctors");
    } catch (err) {
      console.error("Delete Doctor Error:", err);
      res.redirect("/admin/doctors");
    }
  }

  // ================= PATIENTS MANAGEMENT =================
  async togglePatientStatus(req, res) {
    try {
      const { id } = req.params;
      const patient = await UserModel.findById(id);
      if (!patient || patient.role !== "patient")
        return res.redirect("/admin/patients");

      patient.status = patient.status === "active" ? "blocked" : "active";
      await patient.save();

      // Notify the patient about their account status change
      await emitNotification(req, patient._id.toString(), {
        title: `Account ${patient.status === "active" ? "Activated" : "Blocked"}`,
        message:
          patient.status === "active"
            ? "Your account has been reactivated by the administrator."
            : "Your account has been blocked by the administrator. Contact support for assistance.",
        type: "system",
      });

      res.redirect("/admin/patients");
    } catch (err) {
      console.error("Toggle Patient Status Error:", err);
      res.redirect("/admin/patients");
    }
  }

  async deletePatient(req, res) {
    try {
      const { id } = req.params;
      await UserModel.findByIdAndDelete(id);
      res.redirect("/admin/patients");
    } catch (err) {
      console.error("Delete Patient Error:", err);
      res.redirect("/admin/patients");
    }
  }

  // ================= APPOINTMENTS MANAGEMENT =================
  async updateAppointmentStatus(req, res) {
    try {
      const { id } = req.params;
      const { status } = req.body;

      const appt = await AppointmentModel.findById(id);
      if (!appt) return res.redirect("/admin/appointments");

      appt.status = status;
      await appt.save();

      // Notify both patient and doctor about the status change
      const statusLabel = status.charAt(0).toUpperCase() + status.slice(1);
      if (appt.patient) {
        await emitNotification(req, appt.patient.toString(), {
          title: `Appointment ${statusLabel}`,
          message: `Your appointment has been ${status} by the administrator.`,
          type: "appointment",
        });
      }
      if (appt.doctor) {
        await emitNotification(req, appt.doctor.toString(), {
          title: `Appointment ${statusLabel}`,
          message: `An appointment has been ${status} by the administrator.`,
          type: "appointment",
        });
      }

      res.redirect("/admin/appointments");
    } catch (err) {
      console.error("Update Appointment Status Error:", err);
      res.redirect("/admin/appointments");
    }
  }
}

module.exports = new adminAuthController();
