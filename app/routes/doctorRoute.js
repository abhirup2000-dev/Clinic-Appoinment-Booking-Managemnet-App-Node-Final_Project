const express = require("express");
const doctorController = require("../controller/doctorController");
const doctorAuthCheck = require("../middleware/doctorAuthMiddleware");
const { requirePasswordReset } = require("../middleware/forcePasswordResetMiddleware");

const router = express.Router();

// Public auth routes
router.get("/login-view", doctorController.viewLoginPage);
router.post("/login", doctorController.doctorLogin);
router.get("/logout", doctorController.doctorLogout);

// Password reset route (Unprotected by force reset)
router.get("/change-password", doctorAuthCheck, doctorController.viewChangePassword);

// Protected doctor portal routes (Requires auth and password reset)
router.use(doctorAuthCheck, requirePasswordReset);

const upload = require("../utils/CloudinaryStorage");

router.get("/dashboard", doctorAuthCheck, doctorController.viewDashboard);
router.post("/appointments/update/:id", doctorAuthCheck, doctorController.updateAppointmentStatus);
router.post("/appointments/complete/:id", doctorAuthCheck, doctorController.completeAppointment);
router.post("/appointments/upload-report/:id", doctorAuthCheck, upload.single("report"), doctorController.uploadMedicalReport);
router.get("/live-chat/:appointmentId", doctorAuthCheck, doctorController.viewLiveChat);

module.exports = router;
