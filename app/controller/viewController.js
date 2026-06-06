const mongoose = require("mongoose");

const UserModel = require("../model/user.model");
const ClinicModel = require("../model/clinic.model");
const AppointmentModel = require("../model/appointment.model");
const FeedbackModel = require("../model/feedback.model");
const PaymentModel = require("../model/payment.model");

class viewController {
  adminLoginPage(req, res) {
    return res.render("admin/login");
  }

  adminRegisterPage(req, res) {
    return res.render("admin/register");
  }

  async adminDashboardPage(req, res) {
    try {
      // Dashboard Counts using Aggregation
      const [
        appointmentsCount,
        doctorsCount,
        patientsCount,
        clinicsCount,
        revenueData,
      ] = await Promise.all([
        AppointmentModel.aggregate([
          {
            $count: "total",
          },
        ]),

        UserModel.aggregate([
          {
            $match: {
              role: "doctor",
            },
          },
          {
            $count: "total",
          },
        ]),

        UserModel.aggregate([
          {
            $match: {
              role: "patient",
            },
          },
          {
            $count: "total",
          },
        ]),

        ClinicModel.aggregate([
          {
            $count: "total",
          },
        ]),

        PaymentModel.aggregate([
          {
            $match: {
              status: "paid",
            },
          },
          {
            $group: {
              _id: null,
              total: {
                $sum: "$amount",
              },
            },
          },
        ]),
      ]);

      // Recent Appointments
      const recentAppointments = await AppointmentModel.aggregate([
        // Patient Lookup
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

        {
          $project: {
            appointmentDate: 1,
            appointmentTimeSlot: 1,
            status: 1,
            createdAt: 1,

            patient: {
              _id: "$patient._id",
              name: "$patient.name",
            },

            doctor: {
              _id: "$doctor._id",
              name: "$doctor.name",
            },
          },
        },

        {
          $sort: {
            createdAt: -1,
          },
        },

        {
          $limit: 5,
        },
      ]);

      return res.render("admin/dashboard", {
        admin: req.admin,

        appointmentsCount: appointmentsCount[0]?.total || 0,

        doctorsCount: doctorsCount[0]?.total || 0,

        patientsCount: patientsCount[0]?.total || 0,

        clinicsCount: clinicsCount[0]?.total || 0,

        revenue: revenueData[0]?.total || 0,

        recentAppointments,
      });
    } catch (err) {
      console.error(err);

      return res.render("admin/dashboard", {
        admin: req.admin,
        appointmentsCount: 0,
        doctorsCount: 0,
        patientsCount: 0,
        clinicsCount: 0,
        revenue: 0,
        recentAppointments: [],
      });
    }
  }

  async adminProfilePage(req, res) {
    try {
      const adminId = new mongoose.Types.ObjectId(req.admin.userId);

      const adminData = await UserModel.aggregate([
        {
          $match: {
            _id: adminId,
          },
        },

        {
          $project: {
            password: 0,
            refreshToken: 0,
          },
        },
      ]);

      const admin = adminData[0];

      return res.render("admin/profile", {
        admin,
      });
    } catch (err) {
      console.error(err);

      return res.redirect("/admin/dashboard");
    }
  }

  async adminClinicsPage(req, res) {
    try {
      // Clinics + Clinic Admin
      const clinics = await ClinicModel.aggregate([
        {
          $lookup: {
            from: "users",
            localField: "clinicAdmin",
            foreignField: "_id",
            as: "clinicAdmin",
          },
        },

        {
          $unwind: {
            path: "$clinicAdmin",
            preserveNullAndEmptyArrays: true,
          },
        },

        {
          $project: {
            clinicName: 1,
            email: 1,
            phone: 1,
            address: 1,
            logo: 1,
            subscriptionPlan: 1,
            averageRating: 1,
            isVerified: 1,
            createdAt: 1,

            clinicAdmin: {
              _id: "$clinicAdmin._id",
              name: "$clinicAdmin.name",
            },
          },
        },

        {
          $sort: {
            createdAt: -1,
          },
        },
      ]);

      // Clinic Admins
      const clinicAdmins = await UserModel.aggregate([
        {
          $match: {
            role: "clinic_admin",
          },
        },

        {
          $project: {
            name: 1,
            email: 1,
          },
        },
      ]);

      return res.render("admin/clinicspage", {
        admin: req.admin,
        clinics,
        clinicAdmins,
      });
    } catch (err) {
      console.error(err);

      return res.redirect("/admin/dashboard");
    }
  }

  async adminDoctorsPage(req, res) {
    try {
      // Doctors + Clinic
      const doctors = await UserModel.aggregate([
        {
          $match: {
            role: "doctor",
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
            email: 1,
            phone: 1,
            specialization: 1,
            qualification: 1,
            experience: 1,
            consultationFee: 1,
            status: 1,
            profilePicture: 1,
            gender: 1,
            age: 1,

            clinic: {
              _id: "$clinic._id",
              clinicName: "$clinic.clinicName",
            },
          },
        },

        {
          $sort: {
            createdAt: -1,
          },
        },
      ]);

      const clinics = await ClinicModel.aggregate([
        {
          $project: {
            clinicName: 1,
          },
        },
      ]);

      return res.render("admin/doctorspage", {
        admin: req.admin,
        doctors,
        clinics,
      });
    } catch (err) {
      console.error(err);

      return res.redirect("/admin/dashboard");
    }
  }

  async adminPatientsPage(req, res) {
    try {
      const patients = await UserModel.aggregate([
        {
          $match: {
            role: "patient",
          },
        },

        {
          $project: {
            name: 1,
            email: 1,
            phone: 1,
            gender: 1,
            age: 1,
            profilePicture: 1,
            status: 1,
            createdAt: 1,
          },
        },

        {
          $sort: {
            createdAt: -1,
          },
        },
      ]);

      return res.render("admin/patientpage", {
        admin: req.admin,
        patients,
      });
    } catch (err) {
      console.error(err);

      return res.redirect("/admin/dashboard");
    }
  }

  async adminAppointmentsPage(req, res) {
    try {
      // Appointments
      const appointments = await AppointmentModel.aggregate([
        // Patient Lookup
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
            createdAt: 1,

            patient: {
              _id: "$patient._id",
              name: "$patient.name",
              phone: "$patient.phone",
            },

            doctor: {
              _id: "$doctor._id",
              name: "$doctor.name",
              specialization: "$doctor.specialization",
            },

            clinic: {
              _id: "$clinic._id",
              clinicName: "$clinic.clinicName",
            },
          },
        },

        {
          $sort: {
            appointmentDate: -1,
          },
        },
      ]);

      // Doctors
      const doctors = await UserModel.aggregate([
        {
          $match: {
            role: "doctor",
          },
        },

        {
          $project: {
            name: 1,
            specialization: 1,
          },
        },
      ]);

      // Patients
      const patients = await UserModel.aggregate([
        {
          $match: {
            role: "patient",
          },
        },

        {
          $project: {
            name: 1,
          },
        },
      ]);

      // Clinics
      const clinics = await ClinicModel.aggregate([
        {
          $project: {
            clinicName: 1,
          },
        },
      ]);

      return res.render("admin/appointmentpage", {
        admin: req.admin,
        appointments,
        doctors,
        patients,
        clinics,
      });
    } catch (err) {
      console.error(err);

      return res.redirect("/admin/dashboard");
    }
  }

  async adminFeedbackPage(req, res) {
    try {
      const feedbacks = await FeedbackModel.aggregate([
        // Patient Lookup
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
            rating: 1,
            comments: 1,
            createdAt: 1,

            patient: {
              _id: "$patient._id",
              name: "$patient.name",
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
            },
          },
        },

        {
          $sort: {
            createdAt: -1,
          },
        },
      ]);

      return res.render("admin/feedback", {
        admin: req.admin,
        feedbacks,
      });
    } catch (err) {
      console.error(err);

      return res.redirect("/admin/dashboard");
    }
  }

  async clinicsPage(req, res) {
    try {
      const clinics = await ClinicModel.aggregate([
        {
          $project: {
            clinicName: 1,
            email: 1,
            phone: 1,
            address: 1,
            logo: 1,
            departments: 1,
            averageRating: 1,
            isVerified: 1,
          },
        },
        {
          $sort: {
            clinicName: 1,
          },
        },
      ]);

      const doctorsCountRes = await UserModel.aggregate([
        {
          $match: {
            role: "doctor",
            status: "active",
          },
        },
        {
          $count: "total",
        },
      ]);
      const doctorsCount = doctorsCountRes[0]?.total || 0;

      return res.render("pages/clinics", {
        clinics,
        doctorsCount,
      });
    } catch (err) {
      console.error(err);
      return res.render("pages/clinics", {
        clinics: [],
        doctorsCount: 0,
      });
    }
  }

  async doctorsPage(req, res) {
    try {
      const doctors = await UserModel.aggregate([
        {
          $match: {
            role: "doctor",
            status: "active",
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
            email: 1,
            phone: 1,
            specialization: 1,
            qualification: 1,
            experience: 1,
            consultationFee: 1,
            status: 1,
            profilePicture: 1,
            gender: 1,
            age: 1,
            clinic: {
              _id: "$clinic._id",
              clinicName: "$clinic.clinicName",
            },
          },
        },
        {
          $sort: {
            name: 1,
          },
        },
      ]);

      return res.render("pages/doctors", {
        doctors,
      });
    } catch (err) {
      console.error(err);
      return res.render("pages/doctors", {
        doctors: [],
      });
    }
  }

  servicesPage(req, res) {
    return res.render("pages/services");
  }

  aboutPage(req, res) {
    return res.render("pages/about");
  }

  contactPage(req, res) {
    return res.render("pages/contact");
  }
}

module.exports = new viewController();

