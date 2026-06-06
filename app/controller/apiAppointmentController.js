const AppointmentModel = require("../model/appointment.model");
const UserModel = require("../model/user.model");
const ClinicModel = require("../model/clinic.model");
const NotificationModel = require("../model/notification.model");
const PaymentModel = require("../model/payment.model");
const mongoose = require("mongoose");
const crypto = require("crypto");
const { sendEmail } = require("../config/emailconfig");
const { appointmentConfirmEmailTemplate, appointmentStatusEmailTemplate } = require("../services/emailTemplates");

class apiAppointmentController {
  // async bookAppointment(req, res) {
  //   try {
  //     const {
  //       doctor,
  //       clinic,
  //       department,
  //       appointmentDate,
  //       appointmentTimeSlot,
  //       symptoms,
  //       razorpay_order_id,
  //       razorpay_payment_id,
  //       razorpay_signature,
  //     } = req.body;
  //     const patientId = req.user.userId;

  //     if (
  //       !doctor ||
  //       !clinic ||
  //       !department ||
  //       !appointmentDate ||
  //       !appointmentTimeSlot
  //     ) {
  //       return res
  //         .status(400)
  //         .json({
  //           success: false,
  //           message: "Missing required appointment booking details",
  //         });
  //     }

  //     // Check doctor availability slot double booking
  //     const conflict = await AppointmentModel.findOne({
  //       doctor,
  //       appointmentDate,
  //       appointmentTimeSlot,
  //       status: { $nin: ["cancelled", "completed"] },
  //     });

  //     if (conflict) {
  //       return res
  //         .status(409)
  //         .json({
  //           success: false,
  //           message: "This slot is already booked for the selected doctor",
  //         });
  //     }

  //     // Fetch doctor details to verify consultation fee
  //     const docUser = await UserModel.findById(doctor);
  //     const consultationFee = docUser?.consultationFee || 500;

  //     // Verify Razorpay payment signature
  //     if (razorpay_order_id && razorpay_payment_id && razorpay_signature) {
  //       const text = razorpay_order_id + "|" + razorpay_payment_id;
  //       const generated_signature = crypto
  //         .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
  //         .update(text)
  //         .digest("hex");

  //       if (generated_signature !== razorpay_signature) {
  //         return res
  //           .status(400)
  //           .json({
  //             success: false,
  //             message: "Appointment prepayment verification failed",
  //           });
  //       }
  //     } else {
  //       return res
  //         .status(402)
  //         .json({
  //           success: false,
  //           message: "Consultation prepayment is required to book appointments",
  //         });
  //     }

  //     const appointment = await AppointmentModel.create({
  //       patient: patientId,
  //       doctor,
  //       clinic,
  //       department,
  //       appointmentDate,
  //       appointmentTimeSlot,
  //       symptoms: symptoms || "",
  //       status: "pending",
  //       paymentStatus: "paid",
  //     });

  //     // Save Payment record
  //     await PaymentModel.create({
  //       patient: patientId,
  //       appointment: appointment._id,
  //       amount: consultationFee,
  //       currency: "INR",
  //       orderId: razorpay_order_id,
  //       paymentId: razorpay_payment_id,
  //       status: "paid",
  //     });

  //     // Aggregate doctor, patient, and clinic names to send custom email notifications
  //     const details = await AppointmentModel.aggregate([
  //       { $match: { _id: appointment._id } },
  //       {
  //         $lookup: {
  //           from: "users",
  //           localField: "patient",
  //           foreignField: "_id",
  //           as: "p",
  //         },
  //       },
  //       { $unwind: "$p" },
  //       {
  //         $lookup: {
  //           from: "users",
  //           localField: "doctor",
  //           foreignField: "_id",
  //           as: "d",
  //         },
  //       },
  //       { $unwind: "$d" },
  //       {
  //         $lookup: {
  //           from: "clinics",
  //           localField: "clinic",
  //           foreignField: "_id",
  //           as: "c",
  //         },
  //       },
  //       { $unwind: "$c" },
  //     ]);

  //     if (details.length > 0) {
  //       const item = details[0];
  //       // Create system notifications
  //       await NotificationModel.create([
  //         {
  //           recipient: item.patient,
  //           title: "Booking Confirmed",
  //           message: `Your consultation booking at ${item.c.clinicName} with ${item.d.name} is paid and registered.`,
  //           type: "appointment",
  //         },
  //         {
  //           recipient: item.doctor,
  //           title: "New Appointment Booked",
  //           message: `You have a new checkup request from ${item.p.name} for ${new Date(appointmentDate).toLocaleDateString()} at ${appointmentTimeSlot}.`,
  //           type: "appointment",
  //         },
  //       ]);

  //       // Send Email to patient
  //       sendEmail({
  //         to: item.p.email,
  //         subject: "Appointment Registered & Paid - CareConnect",
  //         html: `
  //           <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
  //             <h3 style="color: #10b981;">Appointment Booked Successfully!</h3>
  //             <p>Hi ${item.p.name}, your appointment with <strong>${item.d.name}</strong> at <strong>${item.c.clinicName}</strong> has been registered and paid.</p>
  //             <ul>
  //               <li><strong>Department:</strong> ${department}</li>
  //               <li><strong>Date:</strong> ${new Date(appointmentDate).toLocaleDateString()}</li>
  //               <li><strong>Slot:</strong> ${appointmentTimeSlot}</li>
  //               <li><strong>Amount Paid:</strong> INR ${consultationFee.toFixed(2)}</li>
  //             </ul>
  //             <p>We will notify you once the clinic admin confirms your consultation slot.</p>
  //           </div>
  //         `,
  //       });

  //       // Trigger live Socket.IO push
  //       const io = req.app.get("io");
  //       if (io) {
  //         io.to(`user_${item.patient}`).emit("notification", {
  //           title: "Booking Registered",
  //           message: `Your booking at ${item.c.clinicName} has been successfully paid and registered.`,
  //         });
  //         io.to(`user_${item.doctor}`).emit("notification", {
  //           title: "New Appointment Request",
  //           message: `Patient ${item.p.name} has booked a session on ${new Date(appointmentDate).toLocaleDateString()} at ${appointmentTimeSlot}.`,
  //         });
  //       }
  //     }

  //     return res.status(201).json({
  //       success: true,
  //       message: "Appointment successfully booked",
  //       data: appointment,
  //     });
  //   } catch (error) {
  //     console.error("Book Appointment Error:", error);
  //     return res
  //       .status(500)
  //       .json({
  //         success: false,
  //         message: "Appointment booking failed",
  //         error: error.message,
  //       });
  //   }
  // }

  async bookAppointment(req, res) {
    try {
      const {
        doctor,
        clinic,
        department,
        appointmentDate,
        appointmentTimeSlot,
        symptoms,
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
      } = req.body;

      const patientId = req.user.userId;

      // Validation
      if (
        !doctor ||
        !clinic ||
        !department ||
        !appointmentDate ||
        !appointmentTimeSlot
      ) {
        return res.status(400).json({
          success: false,
          message: "Missing required appointment booking details",
        });
      }

      // Check doctor slot conflict
      const conflict = await AppointmentModel.findOne({
        doctor,
        appointmentDate,
        appointmentTimeSlot,
        status: { $nin: ["cancelled", "completed"] },
      });

      if (conflict) {
        return res.status(409).json({
          success: false,
          message: "This slot is already booked for the selected doctor",
        });
      }

      // Get patient details to check free appointment count
      const patient = await UserModel.findById(patientId);
      if (!patient) {
        return res.status(404).json({
          success: false,
          message: "Patient not found",
        });
      }

      // Get consultation fee
      const doctor_info = await UserModel.findById(doctor);
      const consultationFee = doctor_info?.consultationFee || 500;

      // Check if this is a free appointment (first 2 are free)
      const FREE_APPOINTMENTS_LIMIT = 2;
      const isFreeTier = patient.freeAppointmentsUsed < FREE_APPOINTMENTS_LIMIT;

      // If NOT free tier and payment is required, verify payment
      if (!isFreeTier) {
        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
          return res.status(402).json({
            success: false,
            message: "Payment is required for this appointment",
            requiresPayment: true,
            consultationFee: consultationFee,
          });
        }

        // Verify Razorpay payment signature
        const text = razorpay_order_id + "|" + razorpay_payment_id;
        const generated_signature = crypto
          .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
          .update(text)
          .digest("hex");

        if (generated_signature !== razorpay_signature) {
          return res.status(400).json({
            success: false,
            message: "Payment signature verification failed",
          });
        }
      }

      // Create appointment
      const appointment = await AppointmentModel.create({
        patient: patientId,
        doctor,
        clinic,
        department,
        appointmentDate,
        appointmentTimeSlot,
        symptoms: symptoms || "",
        status: "pending",
        paymentStatus: isFreeTier ? "free" : "paid",
        consultationFee: consultationFee,
        isFreeTier: isFreeTier,
      });

      // Update patient's free appointment count
      if (isFreeTier) {
        await UserModel.findByIdAndUpdate(patientId, {
          $inc: { freeAppointmentsUsed: 1 },
        });
      } else {
        // Save Payment record
        await PaymentModel.create({
          patient: patientId,
          appointment: appointment._id,
          amount: consultationFee,
          currency: "INR",
          orderId: razorpay_order_id,
          paymentId: razorpay_payment_id,
          status: "paid",
        });
      }

      // =========================
      // GET DETAILS
      // =========================
      const details = await AppointmentModel.aggregate([
        {
          $match: {
            _id: appointment._id,
          },
        },

        {
          $lookup: {
            from: "users",
            localField: "patient",
            foreignField: "_id",
            as: "p",
          },
        },

        {
          $unwind: "$p",
        },

        {
          $lookup: {
            from: "users",
            localField: "doctor",
            foreignField: "_id",
            as: "d",
          },
        },

        {
          $unwind: "$d",
        },

        {
          $lookup: {
            from: "clinics",
            localField: "clinic",
            foreignField: "_id",
            as: "c",
          },
        },

        {
          $unwind: "$c",
        },
      ]);

      if (details.length > 0) {
        const item = details[0];

        // =========================
        // NOTIFICATIONS
        // =========================
        const notificationMessage = isFreeTier 
          ? `Your free appointment at ${item.c.clinicName} with ${item.d.name} has been booked successfully.`
          : `Your paid appointment at ${item.c.clinicName} with ${item.d.name} has been booked successfully. Amount: INR ${consultationFee.toFixed(2)}.`;

        await NotificationModel.create([
          {
            recipient: item.patient,
            title: "Booking Confirmed",
            message: notificationMessage,
            type: "appointment",
          },

          {
            recipient: item.doctor,
            title: "New Appointment",
            message: `${item.p.name} booked an appointment on ${new Date(
              appointmentDate
            ).toLocaleDateString()} at ${appointmentTimeSlot}.`,
            type: "appointment",
          },
        ]);

        // =========================
        const emailSubject = isFreeTier 
          ? "Free Appointment Confirmed! - CareConnect"
          : "Paid Appointment Confirmed! - CareConnect";
        
        const emailHtml = isFreeTier
          ? `<div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
              <h3 style="color: #10b981;">Appointment Booked Successfully!</h3>
              <p>Hi ${item.p.name}, your <strong>FREE</strong> appointment with <strong>${item.d.name}</strong> at <strong>${item.c.clinicName}</strong> has been confirmed.</p>
              <ul>
                <li><strong>Department:</strong> ${department}</li>
                <li><strong>Date:</strong> ${new Date(appointmentDate).toLocaleDateString()}</li>
                <li><strong>Time:</strong> ${appointmentTimeSlot}</li>
                <li><strong>Status:</strong> Free Tier (1 of 2 free appointments used)</li>
              </ul>
              <p style="color: #f59e0b; font-weight: bold;">Note: You have 1 more free appointment remaining. After that, consultation fees will apply.</p>
              <p>We will notify you once the clinic admin confirms your slot.</p>
            </div>`
          : `<div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
              <h3 style="color: #10b981;">Appointment Booked & Paid Successfully!</h3>
              <p>Hi ${item.p.name}, your appointment with <strong>${item.d.name}</strong> at <strong>${item.c.clinicName}</strong> has been confirmed and paid.</p>
              <ul>
                <li><strong>Department:</strong> ${department}</li>
                <li><strong>Date:</strong> ${new Date(appointmentDate).toLocaleDateString()}</li>
                <li><strong>Time:</strong> ${appointmentTimeSlot}</li>
                <li><strong>Amount Paid:</strong> INR ${consultationFee.toFixed(2)}</li>
              </ul>
              <p>We will notify you once the clinic admin confirms your slot.</p>
            </div>`;

        sendEmail({
          to: item.p.email,
          subject: emailSubject,
          html: emailHtml,
        });

        // Trigger live Socket.IO push
        const io = req.app.get("io");
        if (io) {
          io.to(`user_${item.patient}`).emit("notification", {
            title: "Booking Confirmed",
            message: notificationMessage,
          });
          io.to(`user_${item.doctor}`).emit("notification", {
            title: "New Appointment Request",
            message: `Patient ${item.p.name} has booked a session on ${new Date(appointmentDate).toLocaleDateString()} at ${appointmentTimeSlot}.`,
          });
        }
      }

      return res.status(201).json({
        success: true,
        message: isFreeTier 
          ? "Appointment successfully booked (Free Tier)" 
          : "Appointment successfully booked (Paid)",
        data: appointment,
        isFreeTier: isFreeTier,
      });
    } catch (error) {
      console.error("Book Appointment Error:", error);
      return res.status(500).json({
        success: false,
        message: "Appointment booking failed",
        error: error.message,
      });
    }
  }

  async checkFreeAppointment(req, res) {
    try {
      const patientId = req.user.userId;
      const patient = await UserModel.findById(patientId);

      if (!patient) {
        return res.status(404).json({
          success: false,
          message: "Patient not found",
        });
      }

      const FREE_APPOINTMENTS_LIMIT = 2;
      const freeAppointmentsRemaining = FREE_APPOINTMENTS_LIMIT - patient.freeAppointmentsUsed;
      const requiresPayment = freeAppointmentsRemaining <= 0;

      return res.status(200).json({
        success: true,
        freeAppointmentsUsed: patient.freeAppointmentsUsed,
        freeAppointmentsRemaining: Math.max(0, freeAppointmentsRemaining),
        requiresPayment: requiresPayment,
      });
    } catch (error) {
      console.error("Check Free Appointment Error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to check free appointment status",
        error: error.message,
      });
    }
  }

  async getAllAppointments(req, res) {
    try {
      const { doctor, clinic, patient, status } = req.query;
      const matchCriteria = {};

      if (doctor) matchCriteria.doctor = new mongoose.Types.ObjectId(doctor);
      if (clinic) matchCriteria.clinic = new mongoose.Types.ObjectId(clinic);
      if (patient) matchCriteria.patient = new mongoose.Types.ObjectId(patient);
      if (status) matchCriteria.status = status;

      // Strictly use MongoDB Aggregation
      const appointments = await AppointmentModel.aggregate([
        { $match: matchCriteria },
        {
          $lookup: {
            from: "users",
            localField: "patient",
            foreignField: "_id",
            as: "patient",
          },
        },
        { $unwind: "$patient" },
        {
          $lookup: {
            from: "users",
            localField: "doctor",
            foreignField: "_id",
            as: "doctor",
          },
        },
        { $unwind: "$doctor" },
        {
          $lookup: {
            from: "clinics",
            localField: "clinic",
            foreignField: "_id",
            as: "clinic",
          },
        },
        { $unwind: "$clinic" },
        {
          $project: {
            appointmentDate: 1,
            appointmentTimeSlot: 1,
            department: 1,
            status: 1,
            symptoms: 1,
            prescription: 1,
            createdAt: 1,
            patient: {
              _id: "$patient._id",
              name: "$patient.name",
              phone: "$patient.phone",
              email: "$patient.email",
            },
            doctor: {
              _id: "$doctor._id",
              name: "$doctor.name",
              specialization: "$doctor.specialization",
            },
            clinic: {
              _id: "$clinic._id",
              clinicName: "$clinic.clinicName",
              address: "$clinic.address",
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
      console.error("Get All Appointments Error:", error);
      return res
        .status(500)
        .json({
          success: false,
          message: "Failed to load appointments",
          error: error.message,
        });
    }
  }

  async getAppointmentById(req, res) {
    try {
      const appointmentId = new mongoose.Types.ObjectId(req.params.id);

      const data = await AppointmentModel.aggregate([
        { $match: { _id: appointmentId } },
        {
          $lookup: {
            from: "users",
            localField: "patient",
            foreignField: "_id",
            as: "patient",
          },
        },
        { $unwind: "$patient" },
        {
          $lookup: {
            from: "users",
            localField: "doctor",
            foreignField: "_id",
            as: "doctor",
          },
        },
        { $unwind: "$doctor" },
        {
          $lookup: {
            from: "clinics",
            localField: "clinic",
            foreignField: "_id",
            as: "clinic",
          },
        },
        { $unwind: "$clinic" },
        {
          $project: {
            appointmentDate: 1,
            appointmentTimeSlot: 1,
            department: 1,
            status: 1,
            symptoms: 1,
            prescription: 1,
            createdAt: 1,
            patient: {
              _id: "$patient._id",
              name: "$patient.name",
              phone: "$patient.phone",
              email: "$patient.email",
            },
            doctor: {
              _id: "$doctor._id",
              name: "$doctor.name",
              specialization: "$doctor.specialization",
            },
            clinic: {
              _id: "$clinic._id",
              clinicName: "$clinic.clinicName",
              address: "$clinic.address",
            },
          },
        },
      ]);

      if (data.length === 0) {
        return res
          .status(404)
          .json({ success: false, message: "Appointment not found" });
      }

      return res.status(200).json({
        success: true,
        data: data[0],
      });
    } catch (error) {
      console.error("Get Appointment By Id Error:", error);
      return res
        .status(500)
        .json({
          success: false,
          message: "Failed to load appointment details",
          error: error.message,
        });
    }
  }

  async updateAppointment(req, res) {
    try {
      const { id } = req.params;
      const { appointmentDate, appointmentTimeSlot, symptoms, prescription } =
        req.body;

      const appt = await AppointmentModel.findById(id);
      if (!appt) {
        return res
          .status(404)
          .json({ success: false, message: "Appointment not found" });
      }

      appt.appointmentDate = appointmentDate || appt.appointmentDate;
      appt.appointmentTimeSlot =
        appointmentTimeSlot || appt.appointmentTimeSlot;
      appt.symptoms = symptoms || appt.symptoms;
      appt.prescription = prescription || appt.prescription;

      await appt.save();

      return res.status(200).json({
        success: true,
        message: "Appointment details successfully modified",
        data: appt,
      });
    } catch (error) {
      console.error("Update Appointment Error:", error);
      return res
        .status(500)
        .json({
          success: false,
          message: "Failed to update appointment",
          error: error.message,
        });
    }
  }

  async updateAppointmentStatus(req, res) {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!status) {
        return res
          .status(400)
          .json({ success: false, message: "Status is required" });
      }

      const appt = await AppointmentModel.findById(id);
      if (!appt) {
        return res
          .status(404)
          .json({ success: false, message: "Appointment not found" });
      }

      appt.status = status;
      await appt.save();

      // Trigger notification and emails on confirmation or completion
      const details = await AppointmentModel.aggregate([
        { $match: { _id: appt._id } },
        {
          $lookup: {
            from: "users",
            localField: "patient",
            foreignField: "_id",
            as: "p",
          },
        },
        { $unwind: "$p" },
        {
          $lookup: {
            from: "users",
            localField: "doctor",
            foreignField: "_id",
            as: "d",
          },
        },
        { $unwind: "$d" },
        {
          $lookup: {
            from: "clinics",
            localField: "clinic",
            foreignField: "_id",
            as: "c",
          },
        },
        { $unwind: "$c" },
      ]);

      if (details.length > 0) {
        const item = details[0];
        await NotificationModel.create({
          recipient: item.patient,
          title: `Consultation ${status.charAt(0).toUpperCase() + status.slice(1)}`,
          message: `Your checkup appointment with ${item.d.name} at ${item.c.clinicName} has been marked as ${status}.`,
          type: "appointment",
        });

        // Email Alert
        sendEmail({
          to: item.p.email,
          subject: `CareConnect Appointment Status Update: ${status.toUpperCase()}`,
          html: appointmentStatusEmailTemplate(
            item.p.name,
            item.d.name,
            item.c.clinicName,
            status
          ),
        });

        // Live Socket.IO push
        const io = req.app.get("io");
        if (io) {
          io.to(`user_${item.patient}`).emit("notification", {
            title: `Appointment ${status.charAt(0).toUpperCase() + status.slice(1)}`,
            message: `Your consultation with ${item.d.name} has been marked as ${status}.`,
          });
        }
      }

      return res.status(200).json({
        success: true,
        message: `Appointment status successfully updated to ${status}`,
        data: appt,
      });
    } catch (error) {
      console.error("Update Status Error:", error);
      return res
        .status(500)
        .json({
          success: false,
          message: "Failed to update appointment status",
          error: error.message,
        });
    }
  }

  async cancelAppointment(req, res) {
    try {
      const { id } = req.params;

      const appt = await AppointmentModel.findById(id);
      if (!appt) {
        return res
          .status(404)
          .json({ success: false, message: "Appointment not found" });
      }

      appt.status = "cancelled";
      await appt.save();

      const details = await AppointmentModel.aggregate([
        { $match: { _id: appt._id } },
        {
          $lookup: {
            from: "users",
            localField: "patient",
            foreignField: "_id",
            as: "p",
          },
        },
        { $unwind: "$p" },
        {
          $lookup: {
            from: "users",
            localField: "doctor",
            foreignField: "_id",
            as: "d",
          },
        },
        { $unwind: "$d" },
        {
          $lookup: {
            from: "clinics",
            localField: "clinic",
            foreignField: "_id",
            as: "c",
          },
        },
        { $unwind: "$c" },
      ]);

      if (details.length > 0) {
        const item = details[0];
        // Notifications
        await NotificationModel.create([
          {
            recipient: item.patient,
            title: "Appointment Cancelled",
            message: `Your appointment with ${item.d.name} at ${item.c.clinicName} has been cancelled.`,
            type: "appointment",
          },
          {
            recipient: item.doctor,
            title: "Appointment Cancelled",
            message: `The session request with ${item.p.name} for ${new Date(item.appointmentDate).toLocaleDateString()} has been cancelled.`,
            type: "appointment",
          },
        ]);

        // Email Alert
        sendEmail({
          to: item.p.email,
          subject: "Appointment Cancelled - CareConnect",
          html: `
            <div style="font-family: Arial, sans-serif; padding: 20px; color: #d32f2f;">
              <h3>Consultation Cancelled</h3>
              <p>Hi ${item.p.name}, your appointment booking with <strong>${item.d.name}</strong> at <strong>${item.c.clinicName}</strong> has been cancelled.</p>
              <p>Feel free to select and book a different timeslot from the patient portal dashboard.</p>
            </div>
          `,
        });

        // Live Socket.IO push
        const io = req.app.get("io");
        if (io) {
          io.to(`user_${item.patient}`).emit("notification", {
            title: "Appointment Cancelled",
            message: `Your appointment with ${item.d.name} has been cancelled.`,
          });
          io.to(`user_${item.doctor}`).emit("notification", {
            title: "Appointment Cancelled",
            message: `Patient ${item.p.name} cancelled the appointment for ${new Date(item.appointmentDate).toLocaleDateString()}.`,
          });
        }
      }

      return res.status(200).json({
        success: true,
        message: "Appointment successfully cancelled",
        data: appt,
      });
    } catch (error) {
      console.error("Cancel Appointment Error:", error);
      return res
        .status(500)
        .json({
          success: false,
          message: "Failed to cancel appointment",
          error: error.message,
        });
    }
  }

  async deleteAppointment(req, res) {
    try {
      const { id } = req.params;
      const appt = await AppointmentModel.findByIdAndDelete(id);

      if (!appt) {
        return res
          .status(404)
          .json({ success: false, message: "Appointment not found" });
      }

      return res.status(200).json({
        success: true,
        message: "Appointment successfully deleted from ledger",
      });
    } catch (error) {
      console.error("Delete Appointment Error:", error);
      return res
        .status(500)
        .json({
          success: false,
          message: "Failed to delete appointment",
          error: error.message,
        });
    }
  }
}

module.exports = new apiAppointmentController();
