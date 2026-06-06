const express = require("express");
const patientController = require("../controller/patientController");
const patientAuthCheck = require("../middleware/patientAuthMiddleware");
const apiChatController = require("../controller/apiChatController");
const upload = require("../utils/CloudinaryStorage");

const router = express.Router();

// Public auth routes
router.get("/login-view", patientController.viewLoginPage);
router.get("/register-view", patientController.viewRegisterPage);
router.get("/verify-otp-view", (req, res) => {
  res.render("auth/verify-otp");
});
router.post(
  "/register",
  upload.single("profilePicture"),
  patientController.patientRegister,
);
router.post("/login", patientController.patientLogin);
router.post("/verify-otp", patientController.patientVerifyOTP);
router.get("/logout", patientController.patientLogout);

// Protected patient portal routes
router.get("/dashboard", patientAuthCheck, patientController.viewDashboard);
router.get("/payment", patientAuthCheck, patientController.viewPaymentPage);
router.get("/invoice/:paymentId", patientAuthCheck, patientController.downloadInvoice);
router.get("/report/:appointmentId", patientAuthCheck, patientController.downloadMedicalReport);
router.post(
  "/appointments/book",
  patientAuthCheck,
  patientController.bookAppointment,
);
router.post(
  "/feedback/submit",
  patientAuthCheck,
  patientController.submitFeedback,
);

router.get(
  "/live-chat/:appointmentId",
  patientAuthCheck,
  patientController.viewLiveChat,
);
router.post(
  "/live-chat/:appointmentId/send",
  patientAuthCheck,
  apiChatController.sendMessage,
);
router.post(
  "/live-chat/:appointmentId/upload",
  patientAuthCheck,
  upload.single("file"),
  apiChatController.uploadFile,
);

module.exports = router;
