const mongoose = require("mongoose");
const https = require("https");
const http = require("http");
const UserModel = require("../model/user.model");
const ClinicModel = require("../model/clinic.model");
const AppointmentModel = require("../model/appointment.model");
const FeedbackModel = require("../model/feedback.model");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { emitNotification } = require("../utils/socketEmitter");
const otpService = require("../services/otpService");
const { sendEmail } = require("../config/emailconfig");
const { welcomeEmailTemplate } = require("../services/emailTemplates");
const PaymentModel = require("../model/payment.model");
const { generateInvoicePDF } = require("../utils/pdfGenerator");

class patientController {
  viewLoginPage(req, res) {
    res.render("patient/login");
  }

  viewRegisterPage(req, res) {
    res.render("patient/register");
  }
  // Render live chat page for a specific appointment
  viewLiveChat(req, res) {
    const { appointmentId } = req.params;
    res.render("patient/live-chat", { appointmentId });
  }

  async patientRegister(req, res) {
    try {
      const { name, email, phone, password, gender, age } = req.body;

      const exists = await UserModel.findOne({ email });

      if (exists) {
        return res.redirect("/patient/register-view");
      }

      const hashed = await bcrypt.hash(password, 10);

      const newUser = await UserModel.create({
        name,
        email,
        phone,
        password: hashed,
        gender,
        age: age ? parseInt(age) : null,
        role: "patient",
        profilePicture: req.file
          ? req.file.path
          : "https://placehold.co/150x150?text=Patient",
      });

      // Trigger OTP verification flow
      const plainOtp = await otpService.createAndSaveOtp(newUser._id);
      await otpService.sendOtpEmail(email, name, plainOtp);

      req.flash('success', 'Registration successful. Please verify your email.');
      req.flash('requiresVerification', email);
      res.redirect("/patient/login-view");
    } catch (err) {
      console.error("Patient Register Error:", err);
      req.flash('error', 'Registration failed. Please try again.');
      res.redirect("/patient/register-view");
    }
  }

  async patientLogin(req, res) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.redirect("/patient/login-view");
      }

      const user = await UserModel.findOne({ email });

      if (!user || user.role !== "patient") {
        req.flash('error', 'Invalid email credentials');
        return res.redirect("/patient/login-view");
      }

      if (user.status === "blocked") {
        req.flash('error', 'Your account has been blocked by the administrator.');
        return res.redirect("/patient/login-view");
      }

      if (!user.isVerified) {
        req.flash('error', 'Please verify your email address before logging in.');
        req.flash('requiresVerification', user.email);
        return res.redirect("/patient/login-view");
      }

      const isMatch = await bcrypt.compare(password, user.password);

      if (!isMatch) {
        req.flash('error', 'Invalid password credentials');
        return res.redirect("/patient/login-view");
      }

      const patientAccessToken = jwt.sign(
        {
          patientName: user.name,
          userId: user._id,
          email: user.email,
          phone: user.phone,
          role: user.role,
          profilePicture: user.profilePicture,
        },
        process.env.JWT_SECRET_KEY,
        {
          expiresIn: "1h",
        },
      );

      const patientRefreshToken = jwt.sign(
        {
          userId: user._id,
        },
        process.env.JWT_REFRESH_SECRET_KEY,
        {
          expiresIn: "7d",
        },
      );

      user.refreshToken = patientRefreshToken;

      await user.save();

      res.cookie("patientAccessToken", patientAccessToken, {
        httpOnly: false,
        secure: process.env.NODE_ENV === "production",
        sameSite: "Strict",
        maxAge: 60 * 60 * 1000,
      });

      res.cookie("patientRefreshToken", patientRefreshToken, {
        httpOnly: false,
        secure: process.env.NODE_ENV === "production",
        sameSite: "Strict",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      res.redirect("/patient/dashboard");
    } catch (err) {
      console.error("Patient Login Error:", err);
      req.flash('error', 'Login failed. Please try again.');
      res.redirect("/patient/login-view");
    }
  }

  async patientVerifyOTP(req, res) {
    try {
      const { email, otp } = req.body;
      if (!email || !otp) {
        req.flash('error', 'Email and OTP are required');
        req.flash('requiresVerification', email || '');
        return res.redirect("/patient/login-view");
      }

      const user = await UserModel.findOne({ email });
      if (!user) {
        req.flash('error', 'User not found');
        return res.redirect("/patient/login-view");
      }

      const verificationResult = await otpService.verifyUserOtp(user._id, otp);
      if (!verificationResult.valid) {
        req.flash('error', verificationResult.reason);
        req.flash('requiresVerification', email);
        return res.redirect("/patient/login-view");
      }

      user.isVerified = true;
      await user.save();

      // Send Welcome Email
      sendEmail({
        to: user.email,
        subject: "Welcome to CareConnect!",
        html: welcomeEmailTemplate(user.name, user.role),
      });

      req.flash('success', 'Email verified successfully. You can now log in.');
      return res.redirect("/patient/login-view");
    } catch (error) {
      console.error("Verify OTP Error:", error);
      req.flash('error', 'OTP verification failed');
      return res.redirect("/patient/login-view");
    }
  }

  async patientLogout(req, res) {
    try {
      const refreshToken = req.cookies.patientRefreshToken;

      if (refreshToken) {
        const user = await UserModel.findOne({ refreshToken });

        if (user) {
          user.refreshToken = null;
          await user.save();
        }
      }

      res.clearCookie("patientAccessToken");
      res.clearCookie("patientRefreshToken");

      res.redirect("/patient/login-view");
    } catch (err) {
      console.error("Logout Error:", err);
      res.redirect("/patient/login-view");
    }
  }

  async viewDashboard(req, res) {
    try {
      const patientId = new mongoose.Types.ObjectId(req.patient.userId);

      // Patient Details
      const patientData = await UserModel.aggregate([
        {
          $match: {
            _id: patientId,
          },
        },

        {
          $project: {
            password: 0,
            refreshToken: 0,
          },
        },
      ]);

      const patient = patientData[0];

      // Clinics
      const clinics = await ClinicModel.aggregate([
        {
          $match: {
            isDeleted: {
              $ne: true,
            },
          },
        },

        {
          $project: {
            clinicName: 1,
            address: 1,
            logo: 1,
            averageRating: 1,
            departments: 1,
          },
        },
      ]);

      // Doctors + Clinic
      const doctors = await UserModel.aggregate([
        {
          $match: {
            role: "doctor",
            isDeleted: {
              $ne: true,
            },
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
            name: 1,
            specialization: 1,
            profilePicture: 1,
            consultationFee: 1,

            clinic: {
              _id: "$clinic._id",
              clinicName: "$clinic.clinicName",
              address: "$clinic.address",
            },
          },
        },
      ]);

      // Patient Appointments
      const appointments = await AppointmentModel.aggregate([
        {
          $match: {
            patient: patientId,
          },
        },

        // Doctor Lookup
        {
          $lookup: {
            from: "users",
            localField: "doctor",
            foreignField: "_id",
            as: "doctor",
          },
        },

        {
          $unwind: "$doctor",
        },

        // Clinic Lookup
        {
          $lookup: {
            from: "clinics",
            localField: "clinic",
            foreignField: "_id",
            as: "clinic",
          },
        },

        {
          $unwind: "$clinic",
        },

        {
          $project: {
            appointmentDate: 1,
            appointmentTimeSlot: 1,
            department: 1,
            status: 1,
            symptoms: 1,
            prescription: 1,
            paymentStatus: 1,
            medicalReport: 1,
            createdAt: 1,

            doctor: {
              _id: "$doctor._id",
              name: "$doctor.name",
              specialization: "$doctor.specialization",
              profilePicture: "$doctor.profilePicture",
            },

            clinic: {
              _id: "$clinic._id",
              clinicName: "$clinic.clinicName",
              address: "$clinic.address",
            },
          },
        },

        {
          $sort: {
            appointmentDate: -1,
          },
        },
      ]);

      // Feedback Submitted Appointment IDs
      const feedbackedAppointments = await FeedbackModel.aggregate([
        {
          $match: {
            patient: patientId,
          },
        },

        {
          $project: {
            appointment: 1,
          },
        },
      ]);

      const feedbackedApptIds = feedbackedAppointments.map((item) =>
        item.appointment.toString(),
      );

      const freeRemaining = Math.max(
        0,
        2 - (patient.freeAppointmentsUsed || 0),
      );

      res.render("patient/dashboard", {
        patient,
        clinics,
        doctors,
        appointments,
        feedbackedApptIds,
        freeRemaining,
      });
    } catch (err) {
      console.error("Patient Dashboard Error:", err);
      res.redirect("/patient/login-view");
    }
  }

  async bookAppointment(req, res) {
    try {
      const {
        doctor,
        clinic,
        department,
        appointmentDate,
        appointmentTimeSlot,
        symptoms,
      } = req.body;

      // Prevent Double Booking
      const existingAppointment = await AppointmentModel.findOne({
        doctor,
        appointmentDate,
        appointmentTimeSlot,
        status: {
          $nin: ["cancelled", "completed"],
        },
      });

      if (existingAppointment) {
        return res.send("This appointment slot is already booked.");
      }

      await AppointmentModel.create({
        patient: req.patient.userId,
        doctor,
        clinic,
        department,
        appointmentDate,
        appointmentTimeSlot,
        symptoms,
        status: "pending",
      });

      // Notify the doctor
      await emitNotification(req, doctor, {
        title: "New Appointment Request",
        message: `A patient has requested an appointment on ${appointmentDate} at ${appointmentTimeSlot}.`,
        type: "appointment",
      });

      res.redirect("/patient/dashboard");
    } catch (err) {
      console.error("Book Appointment Error:", err);
      res.redirect("/patient/dashboard");
    }
  }

  async submitFeedback(req, res) {
    try {
      const { appointment, rating, comments } = req.body;

      const appointmentId = new mongoose.Types.ObjectId(appointment);

      // Appointment Details
      const appointmentData = await AppointmentModel.aggregate([
        {
          $match: {
            _id: appointmentId,
          },
        },
      ]);

      const appt = appointmentData[0];

      if (!appt) {
        return res.redirect("/patient/dashboard");
      }

      // Prevent Duplicate Feedback
      const alreadySubmitted = await FeedbackModel.findOne({
        appointment,
      });

      if (alreadySubmitted) {
        return res.redirect("/patient/dashboard");
      }

      await FeedbackModel.create({
        appointment,
        patient: req.patient.userId,
        doctor: appt.doctor,
        clinic: appt.clinic,
        rating: parseInt(rating),
        comments,
      });

      // Average Rating Aggregation
      const ratingStats = await FeedbackModel.aggregate([
        {
          $match: {
            clinic: appt.clinic,
          },
        },

        {
          $group: {
            _id: "$clinic",
            averageRating: {
              $avg: "$rating",
            },
            totalReviews: {
              $sum: 1,
            },
          },
        },
      ]);

      if (ratingStats.length > 0) {
        await ClinicModel.findByIdAndUpdate(appt.clinic, {
          averageRating: Math.round(ratingStats[0].averageRating * 10) / 10,

          totalReviews: ratingStats[0].totalReviews,
        });
      }

      res.redirect("/patient/dashboard");
    } catch (err) {
      console.error("Submit Feedback Error:", err);
      res.redirect("/patient/dashboard");
    }
  }

  async viewPaymentPage(req, res) {
    try {
      const patientId = req.patient.userId;
      const patient = await UserModel.findById(patientId);

      if (!patient || patient.role !== "patient") {
        return res.redirect("/patient/login-view");
      }

      res.render("patient/payment", {
        razorpayKeyId: process.env.RAZORPAY_KEY_ID,
        patientName: patient.name,
        patientEmail: patient.email,
        patientPhone: patient.phone,
      });
    } catch (err) {
      console.error("Payment Page Error:", err);
      res.redirect("/patient/dashboard");
    }
  }

  async downloadInvoice(req, res) {
    try {
      const { paymentId } = req.params;
      const patientId = req.patient.userId;

      let query = { patient: patientId, status: "paid" };
      if (mongoose.Types.ObjectId.isValid(paymentId)) {
        // Find payment by its document ID OR by its linked appointment ID
        query.$or = [
          { _id: paymentId },
          { appointment: paymentId }
        ];
      } else {
        query.paymentId = paymentId;
      }

      const payment = await PaymentModel.findOne(query);

      if (!payment) {
        req.flash('error', 'Invoice not found or payment not completed.');
        return res.redirect("/patient/dashboard");
      }

      const patientInfo = await PaymentModel.aggregate([
        { $match: { _id: payment._id } },
        { $lookup: { from: "users", localField: "patient", foreignField: "_id", as: "p" } },
        { $unwind: "$p" },
        { $lookup: { from: "appointments", localField: "appointment", foreignField: "_id", as: "a" } },
        { $unwind: "$a" },
        { $lookup: { from: "users", localField: "a.doctor", foreignField: "_id", as: "d" } },
        { $unwind: { path: "$d", preserveNullAndEmptyArrays: true } },
      ]);

      if (patientInfo.length === 0) {
        req.flash('error', 'Invoice data is incomplete.');
        return res.redirect("/patient/dashboard");
      }

      const pdfBuffer = await generateInvoicePDF(payment, patientInfo[0]);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=invoice_${payment.paymentId}.pdf`);
      res.send(pdfBuffer);
    } catch (err) {
      console.error("Download Invoice Error:", err);
      req.flash('error', 'Failed to download invoice.');
      res.redirect("/patient/dashboard");
    }
  }

  async downloadMedicalReport(req, res) {
    try {
      const { appointmentId } = req.params;
      const patientId = req.patient.userId;

      // Verify the appointment belongs to this patient
      const appt = await AppointmentModel.findOne({
        _id: appointmentId,
        patient: patientId,
        status: "completed",
      });

      if (!appt || !appt.medicalReport) {
        req.flash('error', 'Medical report not found.');
        return res.redirect("/patient/dashboard");
      }

      const fileUrl = appt.medicalReport;

      // Helper function to resolve extension from content-type header
      const getExtensionFromContentType = (contentType, defaultExt) => {
        const mimeToExt = {
          'application/pdf': 'pdf',
          'image/png': 'png',
          'image/jpeg': 'jpg',
          'image/jpg': 'jpg',
          'image/gif': 'gif',
          'image/webp': 'webp',
        };
        return mimeToExt[contentType] || defaultExt;
      };

      // Stream the file from Cloudinary through our server
      const protocol = fileUrl.startsWith('https') ? https : http;
      protocol.get(fileUrl, (remoteRes) => {
        // Follow redirects (Cloudinary may redirect)
        if (remoteRes.statusCode === 301 || remoteRes.statusCode === 302) {
          const redirectUrl = remoteRes.headers.location;
          const redirectProtocol = redirectUrl.startsWith('https') ? https : http;
          redirectProtocol.get(redirectUrl, (redirectedRes) => {
            const contentType = redirectedRes.headers['content-type'] || 'application/pdf';
            const ext = getExtensionFromContentType(contentType, 'pdf');
            res.setHeader('Content-Type', contentType);
            res.setHeader('Content-Disposition', `attachment; filename="medical_report_${appointmentId}.${ext}"`);
            redirectedRes.pipe(res);
          }).on('error', (err) => {
            console.error('Redirect stream error:', err);
            req.flash('error', 'Failed to download report.');
            res.redirect("/patient/dashboard");
          });
          return;
        }

        const contentType = remoteRes.headers['content-type'] || 'application/pdf';
        const ext = getExtensionFromContentType(contentType, 'pdf');
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `attachment; filename="medical_report_${appointmentId}.${ext}"`);
        remoteRes.pipe(res);
      }).on('error', (err) => {
        console.error('Medical report download error:', err);
        req.flash('error', 'Failed to download report.');
        res.redirect("/patient/dashboard");
      });

    } catch (err) {
      console.error("Download Medical Report Error:", err);
      req.flash('error', 'Failed to download medical report.');
      res.redirect("/patient/dashboard");
    }
  }
}

module.exports = new patientController();
