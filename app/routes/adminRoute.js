const express = require("express");

const adminController = require("../controller/adminController");
const viewController = require("../controller/viewController");
const adminAuthCheck = require("../middleware/adminAuthMiddleware");
const upload = require("../utils/CloudinaryStorage");

const router = express.Router();

// Authentication views & submissions
router.get("/login-view", viewController.adminLoginPage);
router.get("/register-view", viewController.adminRegisterPage);
router.post("/register", upload.single("profilePicture"), adminController.adminRegister);
router.post("/login", adminController.adminLogin);
router.get("/logout", adminController.adminLogout);

// Authenticated admin view routes
router.get("/dashboard", adminAuthCheck, viewController.adminDashboardPage);
router.get("/profile", adminAuthCheck, viewController.adminProfilePage);

// Profile and password updates
router.post("/update-profile", adminAuthCheck, upload.single("profilePicture"), adminController.updateProfile);
router.post("/update-password", adminAuthCheck, adminController.updatePassword);

// Clinics management routes
router.get("/clinics", adminAuthCheck, viewController.adminClinicsPage);
router.post("/clinics/add", adminAuthCheck, upload.single("logo"), adminController.addClinic);
router.post("/clinics/edit/:id", adminAuthCheck, upload.single("logo"), adminController.editClinic);
router.post("/clinics/delete/:id", adminAuthCheck, adminController.deleteClinic);

// Doctors management routes
router.get("/doctors", adminAuthCheck, viewController.adminDoctorsPage);
router.post("/doctors/add", adminAuthCheck, upload.single("profilePicture"), adminController.addDoctor);
router.post("/seed-doctors", adminController.seedDoctors);
router.post("/doctors/edit/:id", adminAuthCheck, upload.single("profilePicture"), adminController.editDoctor);
router.post("/doctors/delete/:id", adminAuthCheck, adminController.deleteDoctor);

// Patients management routes
router.get("/patients", adminAuthCheck, viewController.adminPatientsPage);
router.post("/patients/toggle-status/:id", adminAuthCheck, adminController.togglePatientStatus);
router.post("/patients/delete/:id", adminAuthCheck, adminController.deletePatient);

// Appointments management routes
router.get("/appointments", adminAuthCheck, viewController.adminAppointmentsPage);
router.post("/appointments/update/:id", adminAuthCheck, adminController.updateAppointmentStatus);

// Feedbacks overview route
router.get("/feedback", adminAuthCheck, viewController.adminFeedbackPage);

module.exports = router;
