const express = require("express");
const { apiAuthCheck, restrictTo } = require("../middleware/apiAuthMiddleware");
const doctorAuthCheck = require("../middleware/doctorAuthMiddleware");
const {
  requireEmailVerified,
} = require("../middleware/emailVerifiedMiddleware");
const upload = require("../utils/CloudinaryStorage");
const { otpLimiter, loginLimiter } = require("../utils/rateLimiter");

// Import Controllers
const apiAuthController = require("../controller/apiAuthController");
const apiClinicController = require("../controller/apiClinicController");
const apiDoctorController = require("../controller/apiDoctorController");
const apiPatientController = require("../controller/apiPatientController");
const apiAppointmentController = require("../controller/apiAppointmentController");
const apiFeedbackController = require("../controller/apiFeedbackController");
const apiPaymentController = require("../controller/apiPaymentController");
const apiNotificationController = require("../controller/apiNotificationController");
const apiAIController = require("../controller/apiAIController");
const apiChatController = require("../controller/apiChatController");
const apiSlotController = require("../controller/apiSlotController");

const router = express.Router();

//AUTHENTICATION ENDPOINTS
router.post(
  "/auth/register",
  upload.single("profilePicture"),
  apiAuthController.apiRegister,
);
router.post("/auth/login", loginLimiter, apiAuthController.apiLogin);
router.post("/auth/verify-otp", otpLimiter, apiAuthController.apiVerifyOtp);
router.post("/auth/resend-otp", otpLimiter, apiAuthController.apiResendOtp);
router.post("/auth/forgot-password", apiAuthController.apiForgotPassword);
router.post("/auth/reset-password", apiAuthController.apiResetPassword);
router.get("/auth/profile", apiAuthCheck, apiAuthController.apiGetProfile);
router.put(
  "/auth/update-profile",
  apiAuthCheck,
  upload.single("profilePicture"),
  apiAuthController.apiUpdateProfile,
);

// Dynamic view rendering support for reset password link
router.get("/auth/reset-password-view", (req, res) => {
  const { token } = req.query;
  res.render("auth/reset-password", { token }); // We'll verify this view matches
});

//CLINICS ENDPOINTS
router.post(
  "/clinics",
  apiAuthCheck,
  restrictTo("super_admin"),
  upload.single("logo"),
  apiClinicController.createClinic,
);
router.post(
  "/clinics/sync-geocodes",
  apiAuthCheck,
  restrictTo("super_admin"),
  apiClinicController.syncGeocodes,
);
router.get("/clinics", apiClinicController.getAllClinics);
router.get("/clinics/nearby", apiClinicController.getNearByClinics); // Must be before /:id
router.get("/clinics/:id", apiClinicController.getClinicById);
router.put(
  "/clinics/:id",
  apiAuthCheck,
  upload.single("logo"),
  apiClinicController.updateClinic,
);
router.delete(
  "/clinics/:id",
  apiAuthCheck,
  restrictTo("super_admin"),
  apiClinicController.deleteClinic,
);

//DOCTORS ENDPOINTS
router.post(
  "/doctors",
  apiAuthCheck,
  restrictTo("super_admin", "clinic_admin"),
  upload.single("profilePicture"),
  apiDoctorController.createDoctor,
);
router.get("/doctors", apiDoctorController.getAllDoctors);
router.get("/doctors/:id", apiDoctorController.getDoctorById);
router.put(
  "/doctors/:id",
  apiAuthCheck,
  upload.single("profilePicture"),
  apiDoctorController.updateDoctor,
);
router.delete(
  "/doctors/:id",
  apiAuthCheck,
  restrictTo("super_admin", "clinic_admin"),
  apiDoctorController.deleteDoctor,
);

//PATIENT ENDPOINTS
router.get(
  "/patients/profile",
  apiAuthCheck,
  restrictTo("patient"),
  apiPatientController.getPatientProfile,
);
router.put(
  "/patients/profile",
  apiAuthCheck,
  restrictTo("patient"),
  upload.single("profilePicture"),
  apiPatientController.updatePatientProfile,
);
router.post(
  "/patients/reports/upload",
  apiAuthCheck,
  restrictTo("patient"),
  upload.reportUpload.single("report"),
  apiPatientController.uploadReport,
);
router.get(
  "/patients/appointments",
  apiAuthCheck,
  restrictTo("patient"),
  apiPatientController.getPatientAppointments,
);

//APPOINTMENTS ENDPOINTS
router.post(
  "/appointments",
  apiAuthCheck,
  restrictTo("patient"),
  apiAppointmentController.bookAppointment,
);
router.get(
  "/appointments/check-free",
  apiAuthCheck,
  restrictTo("patient"),
  apiAppointmentController.checkFreeAppointment,
);
router.get(
  "/appointments",
  apiAuthCheck,
  apiAppointmentController.getAllAppointments,
);
router.get(
  "/appointments/:id",
  apiAuthCheck,
  apiAppointmentController.getAppointmentById,
);
router.put(
  "/appointments/:id",
  apiAuthCheck,
  apiAppointmentController.updateAppointment,
);
router.delete(
  "/appointments/:id",
  apiAuthCheck,
  apiAppointmentController.deleteAppointment,
);
router.put(
  "/appointments/:id/status",
  apiAuthCheck,
  apiAppointmentController.updateAppointmentStatus,
);
router.put(
  "/appointments/:id/cancel",
  apiAuthCheck,
  apiAppointmentController.cancelAppointment,
);

// SMART FORM SLOT ENDPOINTS
router.get("/departments/:clinicId", apiSlotController.getDepartmentsByClinic);
router.get(
  "/doctors/:clinicId/:departmentName",
  apiSlotController.getDoctorsByDepartment,
);
router.get("/slots/:doctorId", apiSlotController.getAvailableSlots);

//FEEDBACK ENDPOINTS
router.post(
  "/feedbacks",
  apiAuthCheck,
  restrictTo("patient"),
  apiFeedbackController.submitFeedback,
);
router.get("/feedbacks", apiFeedbackController.getAllFeedbacks);
router.get("/feedbacks/:id", apiFeedbackController.getFeedbackById);
router.delete(
  "/feedbacks/:id",
  apiAuthCheck,
  restrictTo("super_admin", "clinic_admin"),
  apiFeedbackController.deleteFeedback,
);

//PAYMENT ENDPOINTS
router.post(
  "/payments/create-order",
  apiAuthCheck,
  restrictTo("patient"),
  apiPaymentController.createOrder,
);
router.post(
  "/payments/verify",
  apiAuthCheck,
  apiPaymentController.verifyPayment,
);
router.get("/payments", apiAuthCheck, apiPaymentController.getAllPayments);
router.post(
  "/payments/refund/:id",
  apiAuthCheck,
  apiPaymentController.refundPayment,
);

//NOTIFICATION ENDPOINTS
router.get(
  "/notifications/unread-count",
  apiAuthCheck,
  apiNotificationController.getUnreadCount,
);
router.put(
  "/notifications/read-all",
  apiAuthCheck,
  apiNotificationController.markAllAsRead,
);
router.post(
  "/notifications/send",
  apiAuthCheck,
  apiNotificationController.sendNotification,
);
router.get(
  "/notifications",
  apiAuthCheck,
  apiNotificationController.getMyNotifications,
);
router.put(
  "/notifications/:id/read",
  apiAuthCheck,
  apiNotificationController.markAsRead,
);

// AI
router.post("/ai/recommend-doctor", apiAIController.recommendDoctor);
router.post("/ai/predict-waiting-time", apiAIController.predictWaitingTime);
router.post("/ai/recommend-slot", apiAIController.recommendSlot);
router.post("/ai/chat", apiAIController.chatWithBot);
router.get("/ai/chat-history", apiAuthCheck, apiAIController.getChatHistory);

// LIVE CHAT ENDPOINTS
router.get(
  "/live-chat/:appointmentId",
  apiAuthCheck,
  apiChatController.getChatMessages,
);
router.post(
  "/live-chat/:appointmentId/send",
  doctorAuthCheck,
  apiChatController.sendMessage,
);
router.post(
  "/live-chat/:appointmentId/upload",
  doctorAuthCheck,
  upload.single("file"),
  apiChatController.uploadFile,
);

module.exports = router;
